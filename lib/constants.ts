import { CerebroSettings } from './types';

export const PLUGIN_NAME = 'Cerebro';

export const YAML_FRONTMATTER_REGEX = /---\s*[\s\S]*?\s*---/g;

export const DEFAULT_SETTINGS: CerebroSettings = {
	openAIApiKey: 'default',
	anthropicApiKey: 'default',
	defaultChatFrontmatter:
		"---\nsystem_commands: ['I am a helpful assistant.']\ntemperature: 0\ntop_p: 1\nmax_tokens: 512\npresence_penalty: 1\nfrequency_penalty: 1\nstream: true\nstop: null\nn: 1\nmodel: gpt-3.5-turbo\n---",
	stream: true,
	chatTemplateFolder: 'Cerebro/Templates',
	chatFolder: 'Cerebro/Chats',
	autoInferTitle: true,
	dateFormat: 'YYYY-MM-DD-hhmmss',
	headingLevel: 3,
	inferTitleLanguage: 'English',
};
