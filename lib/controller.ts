import { CerebroSettings } from 'lib/types';
import { Editor, EditorPosition } from 'obsidian';
import pino from 'pino';

const logger = pino({
	level: 'info',
});

export default class ChatController {
	private settings: CerebroSettings;
	private headingPrefix: string;

	constructor(settings: CerebroSettings) {
		this.settings = settings;
		this.headingPrefix = this.getHeadingPrefix(this.settings.headingLevel);
	}

	public addHR(editor: Editor): void {
		const newLine = `\n\n<hr class="__cerebro_plugin">\n\n${this.headingPrefix}role::user\n\n`;
		editor.replaceRange(newLine, editor.getCursor());

		// Move cursor to end of file
		const cursor = editor.getCursor();
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + newLine.length,
		};
		editor.setCursor(newCursor);
	}

	public completeUserResponse(editor: Editor): EditorPosition {
		/**
		 * 1. Moves cursor to end of line
		 * 2. Places divider
		 * 3. Completes the user's response by placing the assistant's header
		 */
		this.moveCursorToEndOfFile(editor);
		const newLine = `\n<hr class="__cerebro_plugin">\n\n${this.headingPrefix}role::assistant\n\n`;
		editor.replaceRange(newLine, editor.getCursor());
		return this.moveCursorToEndOfLine(editor, newLine);
	}

	public completeAssistantResponse(editor: Editor): EditorPosition {
		/**
		 * 1. Places divider
		 * 2. Completes the assistants response by placing the user's header
		 * 3. Moves cursor to end of line
		 */
		const newLine = `\n<hr class="__cerebro_plugin">\n\n${this.headingPrefix}role::user\n\n`;
		editor.replaceRange(newLine, editor.getCursor());
		return this.moveCursorToEndOfLine(editor, newLine);
	}

	public appendNonStreamingMessage = (editor: Editor, message: string): EditorPosition => {
		/**
		 * 1. Places assistant's response
		 * 2. Moves cursor to end of line
		 */

		// const newLine = `\n\n<hr class="__cerebro_plugin">\n\n${headingPrefix}role::assistant\n\n${message}\n\n`;
		editor.replaceRange(message, editor.getCursor());
		return this.moveCursorToEndOfLine(editor, message);
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
		logger.info("Saving settings in ChatController");
		this.settings = settings;
		this.headingPrefix = this.getHeadingPrefix(this.settings.headingLevel);	
	}
}
