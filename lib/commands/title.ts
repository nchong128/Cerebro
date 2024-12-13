import { Command, Editor, MarkdownView } from 'obsidian';
import Cerebro from '../main';
import ChatInterface from '../chatInterface';
import { writeInferredTitleToEditor } from '../helpers';

export const inferTitleCommand = (plugin: Cerebro): Command => ({
  id: 'cerebro-infer-title',
  name: 'Infer title',
  icon: 'subtitles',
  editorCallback: async (editor: Editor, view: MarkdownView) => {
    const chatInterface = new ChatInterface(plugin.settings, editor, view);
    const frontmatter = chatInterface.getFrontmatter(plugin.app);
    const client = plugin.getLLMClient(frontmatter.llm);
    const messages = await chatInterface.getMessages(plugin.app);
    const title = await plugin.inferTitleFromMessages(messages, client);

    if (title) {
      await writeInferredTitleToEditor(
        plugin.app.vault,
        view,
        plugin.app.fileManager,
        plugin.settings.chatFolder,
        title
      );
    }
  }
});
