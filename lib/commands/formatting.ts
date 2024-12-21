import { Command, Editor, MarkdownView } from 'obsidian';
import Cerebro from '../main';
import ChatInterface from '../chatInterface';

export const addDividerCommand = (plugin: Cerebro): Command => ({
	id: 'cerebro-add-hr',
	name: 'Add divider',
	icon: 'minus',
	editorCallback: (editor: Editor, view: MarkdownView) => {
		const chatInterface = new ChatInterface(plugin.settings, editor, view);
		chatInterface.addHR();
	},
});

export const addCommentBlockCommand = (plugin: Cerebro): Command => ({
	id: 'cerebro-add-comment-block',
	name: 'Add comment block',
	icon: 'comment',
	editorCallback: (editor: Editor, view: MarkdownView) => {
		const cursor = editor.getCursor();
		const { line, ch } = cursor;

		const commentBlock = `=begin-comment\n\n=end-comment`;
		editor.replaceRange(commentBlock, cursor);

		const newCursor = {
			line: line + 1,
			ch: ch,
		};
		editor.setCursor(newCursor);
	},
});
