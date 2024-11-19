import OpenAI from 'openai';
import { ChatFrontMatter } from '../types';
import { Notice } from 'obsidian';

export class OpenAIClient {
	private client: OpenAI;

	constructor(apiKey: string) {
		this.client = new OpenAI({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
	}

	public async createChatCompletion(
		messages: OpenAI.Chat.ChatCompletionMessageParam[],
		{
			frequency_penalty,
			logit_bias,
			max_tokens,
			model,
			n,
			presence_penalty,
			stop,
			stream,
			temperature,
			user,
		}: ChatFrontMatter,
	) {
		return this.client.chat.completions.create({
			messages,
			model,
			frequency_penalty,
			logit_bias,
			max_tokens,
			n,
			presence_penalty,
			stop,
			temperature,
			user,
			stream,
		});
	}

	public async inferTitle(messages: string[], inferTitleLanguage: string) {
		if (messages.length < 2) {
			new Notice('Not enough messages to infer title. Minimum 2 messages.');
			return;
		}

		const prompt = `Infer title from the summary of the content of these messages. The title **cannot** contain any of the following characters: colon, back slash or forward slash. Just return the title. Write the title in ${inferTitleLanguage}. \nMessages:\n\n${JSON.stringify(messages)}`;

		const titleMessage: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: 'user',
				content: prompt,
			},
		];

		const response = await this.client.chat.completions.create({
			messages: titleMessage,
			model: 'gpt-3.5-turbo',
			max_tokens: 50,
			temperature: 0.0,
			stream: false,
		});

		const title = response.choices[0].message.content;

		if (!title) {
			throw new Error('Title unable to be inferred');
		}

		return title
			.replace(/[:/\\]/g, '')
			.replace('Title', '')
			.replace('title', '')
			.trim();
	}
}
