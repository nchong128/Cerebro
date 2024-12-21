import Anthropic from '@anthropic-ai/sdk';
import {
	ChatFrontmatter,
	ImageMessageContent,
	Message,
	MessageContent,
	DocumentMessageContent,
	TextMessageContent,
} from 'lib/types';
import { Notice } from 'obsidian';
import { LLMClient } from './client';
import ChatInterface from 'lib/chatInterface';
import { getTextOnlyContent, unfinishedCodeBlock } from 'lib/helpers';
import pino from 'pino';
import {
	Base64PDFSource,
	ImageBlockParam,
	InputJSONDelta,
	RawMessageStreamEvent,
	TextBlock,
	TextDelta,
	MessageParam,
	ContentBlockParam,
} from '@anthropic-ai/sdk/resources';
import { Stream } from '@anthropic-ai/sdk/streaming';
import { CerebroMessages } from 'lib/constants';

const logger = pino({
	level: 'info',
});

const formatMessageContent = (content: MessageContent): ContentBlockParam[] => {
	if (typeof content === 'string') {
		return [{ type: 'text', text: content }];
	}

	return content.map((block) => {
		switch (block.type) {
			case 'text':
				return {
					type: 'text',
					text: block.text,
				};
			case 'document':
				return {
					type: 'document',
					source: block.source as Base64PDFSource,
				};
			case 'image':
				return {
					type: 'image',
					source: block.source as ImageBlockParam.Source,
				};
			default:
				throw new Error(`Unknown message content type: ${block}`);
		}
	});
};

export class AnthropicClient implements LLMClient {
	private client: Anthropic;

	constructor(apiKey: string) {
		this.client = new Anthropic({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
	}

	private async sendCreateMessageRequest(
		messages: Message[],
		{ max_tokens, model, stream, system_commands, temperature }: ChatFrontmatter,
	) {
		const system = system_commands.join('\n');
		const formattedMessages: MessageParam[] = messages.map((msg) => ({
			role: msg.role === 'user' ? 'user' : 'assistant',
			content: formatMessageContent(msg.content),
		}));

		return this.client.messages.create({
			messages: formattedMessages,
			model,
			max_tokens,
			stream,
			system,
			temperature,
		});
	}

	public async chat(
		messages: Message[],
		frontmatter: ChatFrontmatter,
		chatInterface: ChatInterface,
	): Promise<Message> {
		const messageResponse = await this.sendCreateMessageRequest(messages, frontmatter);

		let responseStr;
		// Handle non-streaming case
		if (!frontmatter.stream) {
			const message = messageResponse as Anthropic.Message;
			const content = (message.content[0] as TextBlock).text;
			responseStr = content;

			logger.info('[Cerebro] Model finished generating', {
				finish_reason: message.stop_reason,
			});

			if (unfinishedCodeBlock(content)) responseStr = responseStr + '\n```';
			chatInterface.appendNonStreamingMessage(responseStr);
		} else {
			const { fullResponse, finishReason } = await this.streamMessage(
				messageResponse as Stream<RawMessageStreamEvent>,
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

	private async streamMessage(
		messageStream: Stream<RawMessageStreamEvent>,
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
		for await (const streamEvent of messageStream) {
			if (streamEvent.type === 'content_block_start') {
				const chunkText = (streamEvent.content_block as TextBlock).text;

				// If text undefined, then do nothing
				if (!chunkText) continue;

				const shouldContinue = chatInterface.addStreamedChunk(chunkText);
				if (!shouldContinue) {
					break;
				}

				// Add chunk to full response
				fullResponse += chunkText;
			} else if (streamEvent.type === 'content_block_delta') {
				const chunkText =
					(streamEvent.delta as TextDelta).text ||
					(streamEvent.delta as InputJSONDelta).partial_json;

				// If text undefined, then do nothing
				if (!chunkText) continue;

				const shouldContinue = chatInterface.addStreamedChunk(chunkText);
				if (!shouldContinue) {
					break;
				}

				// Add chunk to full response
				fullResponse += chunkText;
			} else if (streamEvent.type === 'message_delta') {
				finishReason = streamEvent.delta.stop_reason;
			}
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

	public async inferTitle(messages: Message[], inferTitleLanguage: string): Promise<string> {
		if (messages.length < 2) {
			new Notice(CerebroMessages.INFER_TITLE_MESSAGE_TOO_SHORT_FAILURE);
		}

		const textMessages = getTextOnlyContent(messages);

		const textJson = JSON.stringify(textMessages);

		const INFER_TITLE_PROMPT = `Infer title from the summary of the content of these messages. The title **cannot** contain any of the following characters: colon, back slash or forward slash. Just return the title. Write the title in ${inferTitleLanguage}. \nMessages:\n\n${textJson}`;

		const titleMessage: MessageParam[] = [
			{
				role: 'user',
				content: INFER_TITLE_PROMPT,
			},
		];

		const response = await this.client.messages.create({
			messages: titleMessage,
			model: 'claude-3-5-haiku-latest',
			max_tokens: 50,
			temperature: 0.0,
			stream: false,
		});

		const message = response as Anthropic.Message;
		const title = (message.content[0] as TextBlock).text;
		if (!title) throw new Error(CerebroMessages.INFER_TITLE_UNKNOWN_FAILURE);
		return title;
	}
}
