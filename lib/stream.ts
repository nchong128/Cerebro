import { Editor, EditorPosition, Notice, Platform } from 'obsidian';
import { unfinishedCodeBlock } from 'lib/helpers';
import pino from 'pino';
import { ChatCompletionChunk } from 'openai/src/resources/chat/completions';
import { Stream } from 'openai/src/streaming';
import { text } from 'stream/consumers';

const logger = pino({
	level: 'info',
});

export class StreamManager {
	private manualClose = false;

	stopStreaming = () => {
		if (Platform.isMobile) {
			new Notice('[CerebroGPT] Mobile not supported.');
			return;
		}
		this.manualClose = true;
	};

	public async streamOpenAiResponse(
		chatCompletionStream: Stream<ChatCompletionChunk>,
		editor: Editor,
		position: EditorPosition,
	): Promise<string> {
		let fullResponse = '';

		// Save initial cursor
		const { ch: initialCh, line: initialLine } = position;

		// Process through each text chunk and paste
		for await (const chunk of chatCompletionStream) {
			const chunkText = chunk.choices[0].delta.content;
			// If text undefined, then do nothing
			if (!chunkText) {
				continue;
			}

			if (this.manualClose) {
				logger.info('Stopping stream...');
				break;
			}

			// Add chunk of text
			const cursor = editor.getCursor();
			editor.replaceRange(chunkText, cursor);

			fullResponse += chunkText;

			const newCursor = {
				line: cursor.line,
				ch: cursor.ch + chunkText.length,
			};

			editor.setCursor(newCursor);
		}

		// Cleanup
		if (unfinishedCodeBlock(fullResponse)) {
			fullResponse += '\n```';
		}

		// Replace text from initialCursor to fix any formatting issues
		const endCursor = editor.getCursor();
		editor.replaceRange(
			fullResponse,
			{
				line: initialLine,
				ch: initialCh,
			},
			endCursor,
		);

		// Set cursor to end of replacement text
		const newCursor = {
			line: initialLine,
			ch: initialCh + fullResponse.length,
		};
		editor.setCursor(newCursor);

		// Remove the text after the cursor
		editor.replaceRange('', newCursor, {
			line: Infinity,
			ch: Infinity,
		});

		return fullResponse;
	}
}
