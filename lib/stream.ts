import { Editor, EditorPosition, Notice, Platform } from 'obsidian';
import { unfinishedCodeBlock } from 'lib/helpers';
import pino from 'pino';
import { ChatCompletionChunk } from 'openai/src/resources/chat/completions';
import { Stream } from 'openai/src/streaming';

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
		// Initial setup
		let txt = '';
		const { ch: initialCh, line: initialLine } = position;

		// Process through each text chunk and paste
		for await (const chunk of chatCompletionStream) {
			if (this.manualClose) {
				logger.info('Stopping stream...');
				return txt;
			}
			if (chunk.choices[0].delta.content) {
				const text = chunk.choices[0].delta.content;

				// If text undefined, then do nothing
				if (!text) {
					continue;
				}

				const cursor = editor.getCursor();

				editor.replaceRange(text, cursor);

				txt += text;

				const newCursor = {
					line: cursor.line,
					ch: cursor.ch + text.length,
				};

				editor.setCursor(newCursor);
			}
		}

		// Cleanup
		if (unfinishedCodeBlock(txt)) {
			txt += '\n```';
		}

		// Set cursor to end of replacement text
		const newCursor = {
			line: initialLine,
			ch: initialCh + txt.length,
		};
		editor.setCursor(newCursor);

		// remove the text after the cursor
		editor.replaceRange('', newCursor, {
			line: Infinity,
			ch: Infinity,
		});

		return txt;
	}
}
