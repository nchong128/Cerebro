import { FrontMatterCache } from 'obsidian';

import { ChatCompletionCreateParamsBase } from 'openai/src/resources/chat/completions';

export type LLM = 'openAI' | 'anthropic';

export interface CerebroSettings {
	openAIApiKey: string;
	anthropicApiKey: string;
	defaultChatFrontmatter: string;
	defaultLLM: LLM;
	stream: boolean;
	chatTemplateFolder: string;
	chatFolder: string;
	autoInferTitle: boolean;
	dateFormat: string;
	headingLevel: number;
	inferTitleLanguage: string;
}

export type ChatFrontMatter = Omit<ChatCompletionCreateParamsBase, 'messages'> & {
	title: string;
	tags: FrontMatterCache;
	system_commands: string[] | null;
};
