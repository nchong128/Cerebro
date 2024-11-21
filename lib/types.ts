import { FrontMatterCache } from 'obsidian';
import OpenAI from 'openai';

export type LLM = 'OpenAI' | 'Anthropic';

export type ChatFrontmatter = Omit<OpenAI.ChatCompletionCreateParams, 'messages'> & {
	title: string;
	tags: FrontMatterCache;
	system_commands: string[] | null;
};
