import { LLM } from './types';

export interface LLMSettings {
	apiKey: string;
	defaultChatFrontmatter: string;
	model: string;
}

export interface CerebroSettings {
	defaultLLM: LLM;
	llmSettings: Record<LLM, LLMSettings>;
	username: string;
	assistantName: string;
	stream: boolean;
	chatTemplateFolder: string;
	chatFolder: string;
	autoInferTitle: boolean;
	dateFormat: string;
	headingLevel: number;
	inferTitleLanguage: string;
}

export const DEFAULT_SETTINGS: CerebroSettings = {
	llmSettings: {
		OpenAI: {
			apiKey: 'default',
			defaultChatFrontmatter:
				"---\nsystem_commands: ['I am a helpful assistant.']\ntemperature: 0\ntop_p: 1\nmax_tokens: 1024\npresence_penalty: 1\nfrequency_penalty: 1\nstream: true\nstop: null\nn: 1\nmodel: gpt-3.5-turbo\nllm: OpenAI\n---",
			model: 'gpt-3.5-turbo',
		},
		Anthropic: {
			apiKey: 'default',
			defaultChatFrontmatter:
				'---\nsystem: []\ntemperature: 1.0\nmax_tokens: 1024\nstream: true\nstop: null\nmodel: claude-3-5-haiku-latest\nllm: Anthropic\n---',
			model: 'claude-3-5-haiku-latest',
		},
	},
	username: 'User',
	assistantName: 'Cerebro',
	defaultLLM: 'Anthropic',
	stream: true,
	chatTemplateFolder: 'Cerebro/Templates',
	chatFolder: 'Cerebro/Chats',
	autoInferTitle: true,
	dateFormat: 'YYYY-MM-DD-hhmmss',
	headingLevel: 3,
	inferTitleLanguage: 'English',
};

export const getFrontmatter = (settings: CerebroSettings) => {
	return settings.llmSettings[settings.defaultLLM].defaultChatFrontmatter;
};
