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

export type ImageSource = {
	type: 'base64';
	media_type: string;
	data: string;
};

export type MessageImage = {
	type: 'image';
	source: ImageSource;
};

export type MessageText = {
	type: 'text';
	text: string;
};

export type MessageContent = string | Array<MessageText | MessageImage>;

export type Message = { role: string; content: MessageContent };

export enum FileExtensionMimeType {
	PNG = 'image/png',
	JPG = 'image/jpeg',
	JPEG = 'image/jpeg',
	GIF = 'image/gif',
}
export type FileExtension = keyof typeof FileExtensionMimeType;
