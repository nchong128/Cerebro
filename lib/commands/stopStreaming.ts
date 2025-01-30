import { Command, Editor, MarkdownView, Notice } from 'obsidian';
import { ERROR_NOTICE_TIMEOUT_MILLISECONDS } from 'lib/constants';
import { logger } from 'lib/logger';
import Cerebro from 'lib/main';

export const stopStreamingCommand = (plugin: Cerebro): Command => ({
	id: 'cerebro-stop-streaming',
	name: 'Stop streaming',
	icon: 'square',
	editorCallback: async (editor: Editor, view: MarkdownView) => {
		try {
			const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) {
				throw new Error('No active markdown view');
			}

			if (!view.file) {
				throw new Error('No active file');
			}

			const chatInterface = plugin.chatInterfaces.get(view.file);
			if (!chatInterface) {
				throw new Error('No active chat found for this file');
			}

			chatInterface.stopStreaming = true;
		} catch (e) {
			logger.error(`[Cerebro] Error when stopping stream`, e);
			new Notice(
				`[Cerebro] Error while stopping stream. See console for more details. ${e.message}`,
				ERROR_NOTICE_TIMEOUT_MILLISECONDS,
			);
		}
	},
});
