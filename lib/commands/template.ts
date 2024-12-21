import { Command, Editor, MarkdownView, Notice } from 'obsidian';
import Cerebro from '../main';
import { createFolderModal, getDate } from '../helpers';
import { ChatTemplatesHandler } from '../views/chatTemplates';

export const chooseChatTemplateCommand = (plugin: Cerebro): Command => ({
	id: 'cerebro-choose-chat-template',
	name: 'Create new chat from template',
	icon: 'layout-template',
	editorCallback: async (editor: Editor, view: MarkdownView): Promise<void> => {
		if (!plugin.settings.chatFolder || plugin.settings.chatFolder.trim() === '') {
			new Notice('[Cerebro] No chat folder value found. Please set one in settings.');
			return;
		}

		if (!(await plugin.app.vault.adapter.exists(plugin.settings.chatFolder))) {
			const result = await createFolderModal(
				plugin.app,
				plugin.app.vault,
				'chatFolder',
				plugin.settings.chatFolder,
			);
			if (!result) {
				new Notice(
					'[Cerebro] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.',
				);
				return;
			}
		}

		if (
			!plugin.settings.chatTemplateFolder ||
			plugin.settings.chatTemplateFolder.trim() === ''
		) {
			new Notice(
				'[Cerebro] No chat template folder value found. Please set one in settings.',
			);
			return;
		}

		if (!(await plugin.app.vault.adapter.exists(plugin.settings.chatTemplateFolder))) {
			const result = await createFolderModal(
				plugin.app,
				plugin.app.vault,
				'chatTemplateFolder',
				plugin.settings.chatTemplateFolder,
			);
			if (!result) {
				new Notice(
					'[Cerebro] No chat template folder found. One must be created to use plugin. Set one in settings and make sure it exists.',
				);
				return;
			}
		}

		new ChatTemplatesHandler(
			plugin.app,
			plugin.settings,
			getDate(new Date(), plugin.settings.dateFormat),
		).open();
	},
});
