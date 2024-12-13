import { Command, Editor, MarkdownView, Notice } from 'obsidian';
import Cerebro from '../main';
import ChatInterface from '../chatInterface';

export const clearChatCommand = (plugin: Cerebro): Command => ({
  id: 'cerebro-clear-chat',
  name: 'Clear chat (except frontmatter)',
  icon: 'trash',
  editorCallback: async (editor: Editor, view: MarkdownView) => {
    const chatInterface = new ChatInterface(plugin.settings, editor, view);
    try {
      chatInterface.clearConversationExceptFrontmatter(editor);
    } catch (e) {
      new Notice('[Cerebro] Error clearing chat');
    }
  }
});
