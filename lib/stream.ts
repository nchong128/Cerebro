import { Editor, EditorPosition, Notice, Platform } from 'obsidian';
import { unfinishedCodeBlock } from 'lib/helpers';
import pino from 'pino';

const logger = pino({
	level: 'info',
});

export class StreamManager {
	private manualClose = false;

	stopStreaming = () => {
		if (Platform.isMobile) {
			new Notice('[Cerebro] Mobile not supported.');
			return;
		}
		this.manualClose = true;
	};

	public async streamOpenAIResponse(
		chatCompletionStream: Stream<ChatCompletionChunk>,
		editor: Editor,
		position: EditorPosition,
	): Promise<{
		fullResponse: string;
		finishReason: string | null | undefined;
	}> {
		let fullResponse = '';

		// Save initial cursor
		const { ch: initialCh, line: initialLine } = position;

		// Get finish reason from final chunk
		let finishReason;

		// Process through each text chunk and paste
		for await (const chunk of chatCompletionStream) {
			const chunkText = chunk.choices[0].delta.content;
			const chunkFinishReason = chunk.choices[0].finish_reason;
			finishReason = chunkFinishReason;

			// If text undefined, then do nothing
			if (!chunkText) continue;

			if (this.manualClose) {
				logger.info('Stopping stream...');
				break;
			}

			// Add chunk of text
			const cursor = editor.getCursor();
			editor.replaceRange(chunkText, cursor);

			// Add chunk to full response
			fullResponse += chunkText;

			// Set new cursor position based on chunk text
			const newCursor = {
				line: cursor.line,
				ch: cursor.ch + chunkText.length,
			};
			editor.setCursor(newCursor);
		}

		// Cleanup any unfinished code blocks
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

		// Reset the manual close
		this.manualClose = false;

		return {
			fullResponse,
			finishReason,
		};
	}
}
