import { CerebroSettings } from './types';

export const PLUGIN_NAME = 'Cerebro';

export const YAML_FRONTMATTER_REGEX = /---\s*[\s\S]*?\s*---/g;

export const DEFAULT_SETTINGS: CerebroSettings = {
	openAISettings: {
		apiKey: 'default',
		defaultChatFrontmatter:
			"---\nsystem_commands: ['I am a helpful assistant.']\ntemperature: 0\ntop_p: 1\nmax_tokens: 1024\npresence_penalty: 1\nfrequency_penalty: 1\nstream: true\nstop: null\nn: 1\nmodel: gpt-3.5-turbo\n---",
	},
	anthropicSettings: {
		apiKey: 'default',
		defaultChatFrontmatter:
			'---\nsystem: []\ntemperature: 1.0\nmax_tokens: 1024\nstream: true\nstop: null\nmodel: claude-3-5-haiku-latest\n---',
	},
	defaultLLM: 'anthropic',
	stream: true,
	chatTemplateFolder: 'Cerebro/Templates',
	chatFolder: 'Cerebro/Chats',
	autoInferTitle: true,
	dateFormat: 'YYYY-MM-DD-hhmmss',
	headingLevel: 3,
	inferTitleLanguage: 'English',
};
