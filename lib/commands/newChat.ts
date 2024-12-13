import { Command, Editor, MarkdownView, Notice } from 'obsidian';
import Cerebro from '../main';
import ChatInterface from '../chatInterface';
import { createFolderModal, getDate } from '../helpers';
import { getFrontmatter as getFrontmatterFromSettings } from '../settings';
import { ERROR_NOTICE_TIMEOUT_MILLISECONDS } from '../constants';
import { logger } from '../logger';

export const createNewChatCommand = (plugin: Cerebro): Command => ({
  id: 'cerebro-create-new-chat',
  name: 'Create new chat',
  icon: 'highlighter',
  editorCallback: async (editor: Editor, view: MarkdownView) => {
    const chatInterface = new ChatInterface(plugin.settings, editor, view);

    try {
      const selectedText = editor.getSelection();

      if (!plugin.settings.chatFolder || plugin.settings.chatFolder.trim() === '') {
        new Notice('[Cerebro] No chat folder value found. Please set one in settings.');
        return;
      }

      if (!(await plugin.app.vault.adapter.exists(plugin.settings.chatFolder))) {
        const result = await createFolderModal(
          plugin.app,
          plugin.app.vault,
          'chatFolder',
          plugin.settings.chatFolder
        );
        if (!result) {
          new Notice(
            '[Cerebro] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.'
          );
          return;
        }
      }

      const filePath = `${plugin.settings.chatFolder}/${getDate(
        new Date(),
        plugin.settings.dateFormat
      )}.md`;

      const frontmatter = getFrontmatterFromSettings(plugin.settings);
      const fileContent = `${frontmatter}\n\n${selectedText}`;
      const newFile = await plugin.app.vault.create(filePath, fileContent);

      await plugin.app.workspace.openLinkText(newFile.basename, '', true, {
        state: { mode: 'source' },
      });

      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        new Notice('No active markdown editor found.');
        return;
      }

      activeView.editor.focus();
      chatInterface.moveCursorToEndOfFile(activeView.editor);
    } catch (e) {
      logger.error(`[Cerebro] Error in Create new chat with highlighted text`, e);
      new Notice(
        `[Cerebro] Error while creating new chat with highlighted text. See console for more details. ${e.message}`,
        ERROR_NOTICE_TIMEOUT_MILLISECONDS
      );
    }
  }
});
