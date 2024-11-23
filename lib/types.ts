import Anthropic from '@anthropic-ai/sdk';
import { FrontMatterCache } from 'obsidian';
import OpenAI from 'openai';

export type LLM = 'OpenAI' | 'Anthropic';

export type ChatFrontmatter = Omit<
	OpenAI.ChatCompletionCreateParams & Anthropic.MessageCreateParams,
	'messages'
> & {
	title: string;
	tags: FrontMatterCache;
	llm: LLM;
	system_commands: string[] | null;
};

export type Message = { role: string; content: string };
