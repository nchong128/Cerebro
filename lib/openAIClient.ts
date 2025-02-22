import OpenAI from 'openai';
import {
	ChatCompletion,
	ChatCompletionChunk,
	ChatCompletionMessageParam,
} from 'openai/src/resources/chat/completions';
import { ChatFrontMatter } from './types';
import pino from 'pino';
import { APIPromise } from 'openai/core';
import { Stream } from 'openai/src/streaming';

const logger = pino({
	level: 'info',
});

export class OpenAIClient {
	private client: OpenAI;

	constructor(apiKey: string) {
		this.client = new OpenAI({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
	}

	public async createChatCompletion(
		messages: ChatCompletionMessageParam[],
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
}
