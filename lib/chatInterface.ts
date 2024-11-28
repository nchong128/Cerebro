import {
	ChatFrontmatter,
	ImageSource,
	ImageExtension,
	ImageExtensionToMimeType,
	Message,
	MessageImage,
	MessageText,
} from 'lib/types';
import { Editor, EditorPosition, MarkdownView, TFile } from 'obsidian';
import pino from 'pino';
import { App } from 'obsidian';
import { assistantHeader, CSSAssets, userHeader, YAML_FRONTMATTER_REGEX } from './constants';
import { getCerebroBaseSystemPrompts } from './helpers';
import { CerebroSettings, DEFAULT_SETTINGS } from './settings';
import { isValidFileExtension, isValidImageExtension } from './helpers';

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
		return text.split(`<hr class="${CSSAssets.HR}">`);
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

const escapeRegExp = (text: string): string => {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const extractRoleAndMessage = (
	message: string,
	assistantHeader: string,
	userHeader: string,
): Message => {
	try {
		if (!message.includes(CSSAssets.HEADER)) return { role: 'user', content: message };
		const userAssistantRegex = new RegExp(
			`(?:${escapeRegExp(assistantHeader)}|${escapeRegExp(userHeader)})\\s*([\\s\\S]*)`,
		);
		const match = message.match(userAssistantRegex);

		if (!match) throw new Error('No matching header found');

		const role = message.includes(assistantHeader) ? 'assistant' : 'user';
		const content = match[1].trim();
		if (role === 'assistant' || role === 'user') {
			return { role, content };
		}
		throw new Error('Unknown role ' + role);
	} catch (err) {
		throw new Error('Error extracting role and message' + err);
	}
};

export default class ChatInterface {
	public settings: CerebroSettings;
	private editor: Editor;
	public editorPosition: EditorPosition;
	private view: MarkdownView;
	private stopStreaming = false;

	constructor(settings: CerebroSettings, editor: Editor, view: MarkdownView) {
		this.settings = settings;
		this.editor = editor;
		this.view = view;
	}

	public async getMessages(app: App): Promise<Message[]> {
		// Retrieve and process messages
		const rawEditorVal = this.editor.getValue();
		const bodyWithoutYML = removeYMLFromMessage(rawEditorVal);
		const messages = splitMessages(bodyWithoutYML)
			.map((message) => removeCommentsFromMessages(message))
			.map((message) =>
				extractRoleAndMessage(
					message,
					assistantHeader(this.settings.assistantName, this.settings.headingLevel),
					userHeader(this.settings.username, this.settings.headingLevel),
				),
			);
		return Promise.all(messages.map((message) => this.parseFilesFromMessage(app, message)));
	}

	public addHR(): void {
		const newLine = `\n<hr class="${CSSAssets.HR}">\n${userHeader(this.settings.username, this.settings.headingLevel)}\n`;
		this.editor.replaceRange(newLine, this.editor.getCursor());

		// Move cursor to end of file
		const cursor = this.editor.getCursor();
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + newLine.length,
		};
		this.editor.setCursor(newCursor);
	}

	public completeUserResponse(): void {
		/**
		 * 1. Moves cursor to end of line
		 * 2. Places divider
		 * 3. Completes the user's response by placing the assistant's header
		 */
		this.moveCursorToEndOfFile(this.editor);
		const newLine = `\n\n<hr class="${CSSAssets.HR}">\n${assistantHeader(this.settings.assistantName, this.settings.headingLevel)}\n`;
		this.editor.replaceRange(newLine, this.editor.getCursor());
		this.editorPosition = this.moveCursorToEndOfLine(this.editor, newLine);
	}

	public completeAssistantResponse(): void {
		/**
		 * 1. Places divider
		 * 2. Completes the assistants response by placing the user's header
		 * 3. Moves cursor to end of line
		 */
		const newLine = `\n\n<hr class="${CSSAssets.HR}">\n${userHeader(this.settings.username, this.settings.headingLevel)}\n`;
		this.editor.replaceRange(newLine, this.editor.getCursor());
		this.editorPosition = this.moveCursorToEndOfLine(this.editor, newLine);
	}

	public appendNonStreamingMessage(message: string): void {
		/**
		 * 1. Places assistant's response
		 * 2. Moves cursor to end of line
		 */
		this.editor.replaceRange(message, this.editor.getCursor());
		this.editorPosition = this.moveCursorToEndOfLine(this.editor, message);
	}

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

			const system_commands = [
				...getCerebroBaseSystemPrompts(this.settings),
				metaMatter?.systemCommands || metaMatter?.system || [],
			];

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
				system_commands,
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

	private async parseFilesFromMessage(app: App, message: Message): Promise<Message> {
		/**
		 * Regex to match wiki-style links [[like this]] or [[like this|with description]]
		 * Excludes matches within backtick-delimited code blocks
		 *
		 * @example
		 * "Some [[wiki link]] and `[[not a link]]`"
		 * // Matches: ["[[wiki link]]"]
		 *
		 */
		const fileRegex = /(?<!`[^`]*)\[\[(.*?)(?:\|.*?)?\]\](?![^`]*`)/g;
		const imageSources: ImageSource[] = [];
		const messageText: MessageText[] = [];

		// Find all matches
		const matches = (message.content as string).match(fileRegex);
		if (!matches) return message;

		// Process each match
		for (const match of matches) {
			// Remove brackets to get the path
			const filePath = match.replace(/\[\[|\]\]/g, '').split('|')[0];

			// Get the file from the vault
			const file = app.metadataCache.getFirstLinkpathDest(filePath, '');

			if (file && file instanceof TFile) {
				if (isValidImageExtension(file?.extension)) {
					try {
						imageSources.push(await this.getImageSourceFromFile(app, file));
					} catch (error) {
						console.error(`Failed to process image ${filePath}:`, error);
					}
				} else if (isValidFileExtension(file?.extension)) {
					try {
						messageText.push(await this.getMessageTextFromFile(app, file));
					} catch (error) {
						console.error(`Failed to process file ${filePath}:`, error);
					}
				}
			}
		}

		const messageImages: MessageImage[] = imageSources.map((imageSource) => {
			return {
				type: 'image',
				source: imageSource,
			};
		});

		return {
			...message,
			content: [
				{
					type: 'text',
					text: message.content as string,
				},
				...messageImages,
				...messageText,
			],
		};
	}

	public clearConversationExceptFrontmatter(editor: Editor) {
		try {
			// Retrieve frontmatter text (not the object)
			const frontmatter = editor.getValue().match(YAML_FRONTMATTER_REGEX);

			if (!frontmatter) throw new Error('no frontmatter found');

			// clear editor
			editor.setValue('');

			// add frontmatter back
			editor.replaceRange(frontmatter[0], editor.getCursor());

			// get length of file
			const length = editor.lastLine();

			// move cursor to end of file https://davidwalsh.name/codemirror-set-focus-line
			const newCursor = {
				line: length + 1,
				ch: 0,
			};

			editor.setCursor(newCursor);

			return newCursor;
		} catch (err) {
			throw new Error('Error clearing conversation' + err);
		}
	}

	private async getImageSourceFromFile(app: App, image: TFile): Promise<ImageSource> {
		// Read the file as an array buffer
		const arrayBuffer = await app.vault.readBinary(image);

		// Convert array buffer to base64
		const base64 = Buffer.from(arrayBuffer).toString('base64');

		// Get the file extension
		const fileExtension = image.extension.toLowerCase();

		// Return with proper mime type prefix
		const mimeType = ImageExtensionToMimeType[image.extension.toUpperCase() as ImageExtension];

		return {
			type: 'base64',
			media_type: mimeType,
			data: base64,
		};
	}

	private async getMessageTextFromFile(app: App, textFile: TFile): Promise<MessageText> {
		const text = await app.vault.cachedRead(textFile);

		return {
			type: 'text',
			text,
		};
	}
}
