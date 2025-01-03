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
	system_commands: string[];
};

export enum TextFileExtension {
	MD = 'md',
	TXT = 'txt',
}

export type TextMessageContent = {
	type: 'text';
	text: string;
	originalPath?: string;
	resolvedContent?: (TextMessageContent | ImageMessageContent | DocumentMessageContent)[];
};

export enum ImageExtensionToMimeType {
	PNG = 'image/png',
	JPG = 'image/jpeg',
	JPEG = 'image/jpeg',
	GIF = 'image/gif',
}
export type ImageExtension = keyof typeof ImageExtensionToMimeType;

export type ImageSource = {
	type: 'base64';
	media_type: string;
	data: string;
};

export type ImageMessageContent = {
	type: 'image';
	source: ImageSource;
	originalPath?: string;
};

export enum PDFFileExtension {
	PDF = 'pdf',
}

export type PDFSource = {
	type: 'base64';
	media_type: 'application/pdf';
	data: string;
};

export type DocumentMessageContent = {
	type: 'document';
	source: PDFSource;
	originalPath?: string;
};

export type MessageContent =
	| string
	| Array<TextMessageContent | ImageMessageContent | DocumentMessageContent>;

export type Message = { role: string; content: MessageContent };
