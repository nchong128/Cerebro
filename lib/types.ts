import { FrontMatterCache } from 'obsidian';
import OpenAI from 'openai';

export type LLM = 'OpenAI' | 'Anthropic';

type OpenAISettings = {
	apiKey: string;
	defaultChatFrontmatter: string;
};

type AnthropicSettings = {
	apiKey: string;
	defaultChatFrontmatter: string;
};

export interface CerebroSettings {
	defaultLLM: LLM;
	openAISettings: OpenAISettings;
	anthropicSettings: AnthropicSettings;
	stream: boolean;
	chatTemplateFolder: string;
	chatFolder: string;
	autoInferTitle: boolean;
	dateFormat: string;
	headingLevel: number;
	inferTitleLanguage: string;
}

export type ChatFrontmatter = Omit<OpenAI.ChatCompletionCreateParams, 'messages'> & {
	title: string;
	tags: FrontMatterCache;
	system_commands: string[] | null;
};
