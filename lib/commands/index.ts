import { Command } from 'obsidian';
import Cerebro from '../main';
import { createNewChatCommand } from './newChat';
import { chatCommand } from './chat';
import { addDividerCommand } from './formatting';
import { addCommentBlockCommand } from './formatting';
import { inferTitleCommand } from './title';
import { chooseChatTemplateCommand } from './template';
import { clearChatCommand } from './clear';
import { createNewChatInSidebarCommand } from './newChatInSidebar';
import { inlineAssistCommand } from './inline';

export const getCommands = (plugin: Cerebro): Command[] => [
	createNewChatCommand(plugin),
	createNewChatInSidebarCommand(plugin),
	chatCommand(plugin),
	addDividerCommand(plugin),
	addCommentBlockCommand(plugin),
	inferTitleCommand(plugin),
	chooseChatTemplateCommand(plugin),
	clearChatCommand(plugin),
	inlineAssistCommand(plugin),
];
