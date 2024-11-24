import { ChatFrontmatter, Message } from 'lib/types';
import { Editor, EditorPosition, MarkdownView } from 'obsidian';
import pino from 'pino';
import { App } from 'obsidian';
import { assistantHeader, CSSAssets, userHeader, YAML_FRONTMATTER_REGEX } from './constants';
import { CerebroSettings, DEFAULT_SETTINGS } from './settings';

const logger = pino({
	level: 'info',
});
export type ShouldContinue = boolean;

const removeYMLFromMessage = (message: string): string => {
	/**
	 * Removes any YAML content from a message
	 */
	try {
		return message.replace(YAML_FRONTMATTER_REGEX, '');
	} catch (err) {
		throw new Error('Error removing YML from message' + err);
	}
};

const splitMessages = (text: string): string[] => {
	/**
	 * Splits a string based on the separator
	 */
	try {
		// <hr class="${CSSAssets.HR}">
		return text.split('<hr class="${CSSAssets.HR}">');
	} catch (err) {
		throw new Error('Error splitting messages' + err);
	}
};

const removeCommentsFromMessages = (message: string): string => {
	/**
	 * Removes any comments from the messages
	 */
	try {
		// Comment block in form of =begin-comment and =end-comment
		const commentBlock = /=begin-comment[\s\S]*?=end-comment/g;

		// Remove comment block
		return message.replace(commentBlock, '');
	} catch (err) {
		throw new Error('Error removing comments from messages' + err);
	}
};

const extractRoleAndMessage = (message: string): Message => {
	try {
		if (!message.includes('role::')) return { role: 'user', content: message };

		const role = message.split('role::')[1].split('\n')[0].trim();
		const content = message.split('role::')[1].split('\n').slice(1).join('\n').trim();

		if (role === 'assistant' || role === 'user') {
			return { role, content };
		}
		throw new Error('Unknown role ' + role);
	} catch (err) {
		throw new Error('Error extracting role and message' + err);
	}
};

export default class ChatInterface {
	private settings: CerebroSettings;
	private headingPrefix: string;
	private editor: Editor;
	public editorPosition: EditorPosition;
	private view: MarkdownView;
	private stopStreaming = false;

	constructor(settings: CerebroSettings, editor: Editor, view: MarkdownView) {
		this.settings = settings;
		this.editor = editor;
		this.view = view;
		this.headingPrefix = this.getHeadingPrefix(this.settings.headingLevel);
	}

	public getMessages(): Message[] {
		// Retrieve and process messages
		const bodyWithoutYML = removeYMLFromMessage(this.editor.getValue());
		return splitMessages(bodyWithoutYML)
			.map((message) => removeCommentsFromMessages(message))
			.map((message) => extractRoleAndMessage(message));
	}

	public addHR(): void {
		const newLine = `\n<hr class="${CSSAssets.HR}">\n${userHeader(this.settings.headingLevel)}\n`;
		this.editor.replaceRange(newLine, this.editor.getCursor());

		// Move cursor to end of file
		const cursor = this.editor.getCursor();
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + newLine.length,
		};
		this.editor.setCursor(newCursor);
	}

	public completeUserResponse(assistantName: string): void {
		/**
		 * 1. Moves cursor to end of line
		 * 2. Places divider
		 * 3. Completes the user's response by placing the assistant's header
		 */
		this.moveCursorToEndOfFile(this.editor);
		const newLine = `\n\n<hr class="${CSSAssets.HR}">\n${assistantHeader(this.settings.headingLevel, assistantName)}\n`;
		this.editor.replaceRange(newLine, this.editor.getCursor());
		this.editorPosition = this.moveCursorToEndOfLine(this.editor, newLine);
	}

	public completeAssistantResponse(): void {
		/**
		 * 1. Places divider
		 * 2. Completes the assistants response by placing the user's header
		 * 3. Moves cursor to end of line
		 */
		const newLine = `\n\n<hr class="${CSSAssets.HR}">\n${userHeader(this.settings.headingLevel)}\n`;
		this.editor.replaceRange(newLine, this.editor.getCursor());
		this.editorPosition = this.moveCursorToEndOfLine(this.editor, newLine);
	}

	public appendNonStreamingMessage = (message: string) => {
		/**
		 * 1. Places assistant's response
		 * 2. Moves cursor to end of line
		 */
		this.editor.replaceRange(message, this.editor.getCursor());
		this.editorPosition = this.moveCursorToEndOfLine(this.editor, message);
	};

	public moveCursorToEndOfFile(editor: Editor) {
		try {
			// Get length of file
			const length = editor.lastLine();

			// Move cursor to end of file https://davidwalsh.name/codemirror-set-focus-line
			const newCursor = {
				line: length + 1,
				ch: 0,
			};
			editor.setCursor(newCursor);

			return newCursor;
		} catch (err) {
			throw new Error('Error moving cursor to end of file' + err);
		}
	}

	public moveCursorToEndOfLine(editor: Editor, change: string): EditorPosition {
		// Moves cursor to end of line
		const cursor = editor.getCursor();
		const newCursor: EditorPosition = {
			line: cursor.line,
			ch: cursor.ch + change.length,
		};
		editor.setCursor(newCursor);
		return newCursor;
	}

	private getHeadingPrefix(headingLevel: number): string {
		if (headingLevel === 0) {
			return '';
		} else if (headingLevel > 6) {
			return '#'.repeat(6) + ' ';
		}
		return '#'.repeat(headingLevel) + ' ';
	}

	public updateSettings(settings: CerebroSettings) {
		logger.info('Saving settings in ChatController');
		this.settings = settings;
		this.headingPrefix = this.getHeadingPrefix(this.settings.headingLevel);
	}

	public getFrontmatter(app: App): ChatFrontmatter {
		/**
		 * Retrieves the frontmatter from a markdown file
		 */
		try {
			// Retrieve frontmatter
			const noteFile = app.workspace.getActiveFile();

			if (!noteFile) {
				throw new Error('No active file');
			}

			const metaMatter = app.metadataCache.getFileCache(noteFile)?.frontmatter;

			// Checks three layers in decreasing priority - frontmatter, user settings, then default settings
			const stream =
				metaMatter?.stream !== undefined
					? metaMatter.stream // If defined in frontmatter, use its value.
					: this.settings.stream !== undefined
						? this.settings.stream // If not defined in frontmatter but exists globally, use its value.
						: DEFAULT_SETTINGS.stream; // Otherwise fallback on true.

			const llm =
				metaMatter?.llm !== undefined
					? metaMatter.llm
					: this.settings.defaultLLM || DEFAULT_SETTINGS.defaultLLM;

			const model =
				metaMatter?.model !== undefined
					? metaMatter.model
					: this.settings.llmSettings[this.settings.defaultLLM].model;

			return {
				llm,
				model,
				stream,
				title: metaMatter?.title || this.view.file?.basename,
				tags: metaMatter?.tags || [],
				temperature: metaMatter?.temperature || null,
				top_p: metaMatter?.top_p || null,
				presence_penalty: metaMatter?.presence_penalty || null,
				frequency_penalty: metaMatter?.frequency_penalty || null,
				max_tokens: metaMatter?.max_tokens || null,
				stop: metaMatter?.stop || null,
				n: metaMatter?.n || null,
				logit_bias: metaMatter?.logit_bias || null,
				user: metaMatter?.user || null,
				system_commands: metaMatter?.system_commands || null,
			};
		} catch (err) {
			throw new Error('Error getting frontmatter');
		}
	}

	public addStreamedChunk(chunkText: string): ShouldContinue {
		if (this.stopStreaming) {
			logger.info('Stopping stream...');
			return false;
		}
		// Add chunk of text
		const cursor = this.editor.getCursor();
		this.editor.replaceRange(chunkText, cursor);

		// Set new cursor position based on chunk text
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + chunkText.length,
		};
		this.editor.setCursor(newCursor);
		return true;
	}

	public finalizeStreamedResponse(
		fullResponse: string,
		{ line: initialLine, ch: initialCh }: EditorPosition,
	): void {
		// Replace text from initialCursor to fix any formatting issues
		const endCursor = this.editor.getCursor();
		this.editor.replaceRange(
			fullResponse,
			{
				line: initialLine,
				ch: initialCh,
			},
			endCursor,
		);

		// Set cursor to end of replacement text
		const newCursor = {
			line: initialLine,
			ch: initialCh + fullResponse.length,
		};
		this.editor.setCursor(newCursor);

		// Remove the text after the cursor
		this.editor.replaceRange('', newCursor, {
			line: Infinity,
			ch: Infinity,
		});

		this.stopStreaming = false;
	}
}
