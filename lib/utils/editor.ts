import { Editor, EditorPosition } from 'obsidian';

export const completeUserResponse = (editor: Editor, headingPrefix: string): EditorPosition => {
	/**
	 * 1. Places divider
	 * 2. Completes the user's response by placing the assistant's header
	 * 3. Moves cursor to end of line
	 */
	const newLine = `\n\n<hr class="__chatgpt_plugin">\n\n${headingPrefix}role::assistant\n\n`;
	editor.replaceRange(newLine, editor.getCursor());
	return moveCursorToEol(editor, newLine);
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
	const newLine = `\n\n<hr class="__chatgpt_plugin">\n\n${headingPrefix}role::user\n\n`;
	editor.replaceRange(newLine, editor.getCursor());
	return moveCursorToEol(editor, newLine);
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

	// const newLine = `\n\n<hr class="__chatgpt_plugin">\n\n${headingPrefix}role::assistant\n\n${message}\n\n`;
	editor.replaceRange(message, editor.getCursor());
	return moveCursorToEol(editor, message);
};

export const moveCursorToEol = (editor: Editor, change: string): EditorPosition => {
	// Move cursor to end of line
	const cursor = editor.getCursor();
	const newCursor: EditorPosition = {
		line: cursor.line,
		ch: cursor.ch + change.length,
	};
	editor.setCursor(newCursor);
	return newCursor;
};
