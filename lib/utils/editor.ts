import { Editor, EditorPosition } from 'obsidian';

export const completeUserResponse = (editor: Editor, headingPrefix: string): EditorPosition => {
	/**
	 * 1. Moves cursor to end of line
	 * 2. Places divider
	 * 3. Completes the user's response by placing the assistant's header
	 */
	moveCursorToEndOfFile(editor);
	const newLine = `\n<hr class="__cerebro_plugin">\n\n${headingPrefix}role::assistant\n\n`;
	editor.replaceRange(newLine, editor.getCursor());
	return moveCursorToEndOfLine(editor, newLine);
};

export const completeAssistantResponse = (
	editor: Editor,
	headingPrefix: string,
): EditorPosition => {
	/**
	 * 1. Places divider
	 * 2. Completes the assistants response by placing the user's header
	 * 3. Moves cursor to end of line
	 */
	const newLine = `\n<hr class="__cerebro_plugin">\n\n${headingPrefix}role::user\n\n`;
	editor.replaceRange(newLine, editor.getCursor());
	return moveCursorToEndOfLine(editor, newLine);
};

export const appendNonStreamingMessage = (
	editor: Editor,
	headingPrefix: string,
	message: string,
): EditorPosition => {
	/**
	 * 1. Places assistant's response
	 * 2. Moves cursor to end of line
	 */

	// const newLine = `\n\n<hr class="__cerebro_plugin">\n\n${headingPrefix}role::assistant\n\n${message}\n\n`;
	editor.replaceRange(message, editor.getCursor());
	return moveCursorToEndOfLine(editor, message);
};

export const moveCursorToEndOfFile = (editor: Editor) => {
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
};

export const moveCursorToEndOfLine = (editor: Editor, change: string): EditorPosition => {
	// Moves cursor to end of line
	const cursor = editor.getCursor();
	const newCursor: EditorPosition = {
		line: cursor.line,
		ch: cursor.ch + change.length,
	};
	editor.setCursor(newCursor);
	return newCursor;
};
