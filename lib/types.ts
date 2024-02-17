import {FrontMatterCache} from "obsidian";

import {
	ChatCompletionCreateParamsBase
} from "openai/src/resources/chat/completions";

export interface CerebroGPTSettings {
	apiKey: string;
	defaultChatFrontmatter: string;
	stream: boolean;
	chatTemplateFolder: string;
	chatFolder: string;
	generateAtCursor: boolean;
	autoInferTitle: boolean;
	dateFormat: string;
	headingLevel: number;
	inferTitleLanguage: string;
}

export type ChatFrontMatter = Omit<ChatCompletionCreateParamsBase, "messages"> & {
	title: string;
	tags: FrontMatterCache;
	system_commands: string[] | null;
}

