import { CerebroGPTSettings } from './types';

export const PLUGIN_NAME = 'CerebroGPT';

export const DEFAULT_URL = `https://api.openai.com/v1/chat/completions`;

export const YAML_FRONTMATTER_REGEX = /---\s*[\s\S]*?\s*---/g;

export const DEFAULT_SETTINGS: CerebroGPTSettings = {
	apiKey: 'default',
	defaultChatFrontmatter:
		"---\nsystem_commands: ['I am a helpful assistant.']\ntemperature: 0\ntop_p: 1\nmax_tokens: 512\npresence_penalty: 1\nfrequency_penalty: 1\nstream: true\nstop: null\nn: 1\nmodel: gpt-3.5-turbo\n---",
	stream: true,
	chatTemplateFolder: 'CerebroGPT/templates',
	chatFolder: 'CerebroGPT/chats',
	generateAtCursor: false,
	autoInferTitle: false,
	dateFormat: 'YYYYMMDDhhmmss',
	headingLevel: 0,
	inferTitleLanguage: 'English',
};
