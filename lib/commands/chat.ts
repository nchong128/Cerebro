import { Command, Editor, MarkdownView, Notice, Platform } from 'obsidian';
import { CerebroMessages, ERROR_NOTICE_TIMEOUT_MILLISECONDS } from '../constants';
import ChatInterface from '../chatInterface';
import Cerebro from '../main';
import { logger } from '../logger';

export const chatCommand = (plugin: Cerebro): Command => ({
	id: 'cerebro-chat',
	name: 'Chat',
	icon: 'message-circle',
	editorCallback: async (editor: Editor, view: MarkdownView) => {
		plugin.statusBar.setText(CerebroMessages.CALLING_API);
		if (Platform.isMobile) new Notice(CerebroMessages.CALLING_API);

		const chatInterface = new ChatInterface(plugin.settings, editor, view);
		const frontmatter = chatInterface.getFrontmatter(plugin.app);
		const llm = plugin.getLLMClient(frontmatter.llm);
		const messages = await chatInterface.getMessages(plugin.app);
		logger.debug(`[Cerebro] Retrieved messages`, messages);

		chatInterface.completeUserResponse();

		try {
			const response = await llm.chat(messages, frontmatter, chatInterface);
			chatInterface.completeAssistantResponse();

			if (response && plugin.settings.autoInferTitle) {
				await plugin.handleTitleInference(messages.concat(response), view, llm);
			}
		} catch (e) {
			new Notice('[Cerebro] Chat failed: ' + e.message, ERROR_NOTICE_TIMEOUT_MILLISECONDS);
		}

		plugin.statusBar.setText(CerebroMessages.EMPTY);
	},
});
