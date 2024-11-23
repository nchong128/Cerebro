import OpenAI from 'openai';
import { ChatFrontmatter, Message } from '../types';
import { Notice } from 'obsidian';
import { LLMClient } from './client';
import ChatInterface from 'lib/chatInterface';
import pino from 'pino';
import { unfinishedCodeBlock } from 'lib/helpers';
import { Stream } from 'openai/streaming';

const logger = pino({
	level: 'info',
});

export class OpenAIClient implements LLMClient {
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
		}: ChatFrontmatter,
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

	public async chat(
		messages: Message[],
		frontmatter: ChatFrontmatter,
		chatInterface: ChatInterface,
	): Promise<Message> {
		if (frontmatter.system_commands) {
			this.appendSystemCommands(frontmatter.system_commands, messages);
		}

		const chatResponse = await this.createChatCompletion(
			messages as OpenAI.Chat.ChatCompletionMessageParam[],
			frontmatter,
		);

		let responseStr;
		// Handle non-streaming case
		if (!frontmatter.stream) {
			const chatCompletion = chatResponse as OpenAI.ChatCompletion;
			responseStr = chatCompletion.choices[0].message.content || 'No response';

			logger.info('[Cerebro] Model finished generating', {
				finish_reason: chatCompletion.choices[0].finish_reason,
			});

			if (unfinishedCodeBlock(responseStr)) responseStr = responseStr + '\n```';
			chatInterface.appendNonStreamingMessage(responseStr);
		} else {
			const chatCompletionStream = chatResponse as Stream<OpenAI.Chat.ChatCompletionChunk>;
			const { fullResponse, finishReason } = await this.stream(
				chatCompletionStream,
				chatInterface,
			);
			responseStr = fullResponse;
			logger.info('[Cerebro] Model finished generating', { finish_reason: finishReason });
		}

		return {
			role: 'assistant',
			content: responseStr,
		};
	}

	private async stream(
		chatCompletionStream: Stream<OpenAI.Chat.ChatCompletionChunk>,
		chatInterface: ChatInterface,
	): Promise<{
		fullResponse: string;
		finishReason: string | null | undefined;
	}> {
		let fullResponse = '';

		// Save initial cursor
		const initialCursor = chatInterface.editorPosition;

		// Get finish reason from final chunk
		let finishReason;

		// Process through each text chunk and paste
		for await (const chunk of chatCompletionStream) {
			const chunkText = chunk.choices[0]?.delta?.content;
			const chunkFinishReason = chunk.choices[0].finish_reason;
			finishReason = chunkFinishReason;

			// If text undefined, then do nothing
			if (!chunkText) continue;

			const shouldContinue = chatInterface.addStreamedChunk(chunkText);
			if (!shouldContinue) {
				break;
			}

			// Add chunk to full response
			fullResponse += chunkText;
		}

		// Cleanup any unfinished code blocks
		if (unfinishedCodeBlock(fullResponse)) {
			fullResponse += '\n```';
		}
		chatInterface.finalizeStreamedResponse(fullResponse, initialCursor);

		return {
			fullResponse,
			finishReason,
		};
	}

	private appendSystemCommands(systemCommands: string[], messages: Message[]) {
		// Prepend system commands to messages
		messages.unshift(
			...systemCommands.map((command) => {
				return {
					role: 'system',
					content: command,
				};
			}),
		);
	}

	public async inferTitle(messages: Message[], inferTitleLanguage: string): Promise<string> {
		if (messages.length < 2) {
			new Notice('Not enough messages to infer title. Minimum 2 messages.');
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

		return title;
	}
}
