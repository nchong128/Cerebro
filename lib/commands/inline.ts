// cerebro/lib/commands/inline.ts
import { InlineAssistSuggestModal } from 'lib/views/inlineAssist';
import { Command, Editor, Notice } from 'obsidian';
import Cerebro from '../main';

export const inlineAssistCommand = (plugin: Cerebro): Command => ({
	id: 'cerebro-inline-assist',
	name: 'Inline assist',
	icon: 'wand',
	editorCallback: (editor: Editor) => {
		if (!editor.getSelection()) {
			new Notice('[Cerebro] Please select some text first');
			return;
		}
		new InlineAssistSuggestModal(plugin.app, editor).open();
	},
});
