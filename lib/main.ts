/* eslint-disable @typescript-eslint/no-var-requires */
import { Editor, MarkdownView, Notice, Platform, Plugin, requestUrl } from 'obsidian';
import { StreamManager } from './stream';
import { createFolderModal, unfinishedCodeBlock, writeInferredTitleToEditor } from 'lib/helpers';
import { SettingsTab } from './settings';
import { ChatTemplatesHandler } from './chatTemplates';
import { CerebroGPTSettings, ChatFrontMatter } from './types';
import { DEFAULT_SETTINGS, DEFAULT_URL } from './constants';
import pino from 'pino';
import { OpenAIClient } from './openAIClient';
import { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import OpenAI from 'openai';
import ChatCompletion = OpenAI.ChatCompletion;
import { ChatCompletionChunk } from 'openai/resources';

const logger = pino({
	level: 'debug',
});

export default class CerebroGPT extends Plugin {
	settings: CerebroGPTSettings;
	openAIClient: OpenAIClient;

	async callOpenAiApi(
		streamManager: StreamManager,
		editor: Editor,
		messages: ChatCompletionMessageParam[],
		model = 'gpt-3.5-turbo',
		max_tokens = 250,
		temperature = 0.3,
		top_p = 1,
		presence_penalty = 0.5,
		frequency_penalty = 0.5,
		stream = true,
		stop: string[] | null = null,
		n = 1,
		logit_bias: any | null = null,
		user: string | null = null,
		url = DEFAULT_URL,
	) {
		try {
			logger.info('[CerebroGPT] Calling OpenAI API');

			if (stream) {
				const options = {
					model: model,
					messages: messages,
					max_tokens: max_tokens,
					temperature: temperature,
					top_p: top_p,
					presence_penalty: presence_penalty,
					frequency_penalty: frequency_penalty,
					stream: stream,
					stop: stop,
					n: n,
					// logit_bias: logit_bias, // not yet supported
					// user: user, // not yet supported
				};

				const response = await streamManager.streamSSE(
					editor,
					this.settings.apiKey,
					url,
					options,
					this.settings.generateAtCursor,
					this.getHeadingPrefix(),
				);

				logger.info('Response from stream', response);

				return { fullstr: response, mode: 'streaming' };
			} else {
				const responseUrl = await requestUrl({
					url: url,
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.settings.apiKey}`,
						'Content-Type': 'application/json',
					},
					contentType: 'application/json',
					body: JSON.stringify({
						model: model,
						messages: messages,
						max_tokens: max_tokens,
						temperature: temperature,
						top_p: top_p,
						presence_penalty: presence_penalty,
						frequency_penalty: frequency_penalty,
						stream: stream,
						stop: stop,
						n: n,
						// logit_bias: logit_bias, // not yet supported
						// user: user, // not yet supported
					}),
					throw: false,
				});

				try {
					const json = responseUrl.json;

					if (json && json.error) {
						new Notice(`[CerebroGPT] Stream = False Error :: ${json.error.message}`);
						throw new Error(JSON.stringify(json.error));
					}
				} catch (err) {
					// continue we got a valid str back
					if (err instanceof SyntaxError) {
						// continue
					} else {
						throw new Error(err);
					}
				}

				const response = responseUrl.text;
				const responseJSON = JSON.parse(response);
				return responseJSON.choices[0].message.content;
			}
		} catch (err) {
			if (err instanceof Object) {
				if (err.error) {
					new Notice(`[CerebroGPT] Error :: ${err.error.message}`);
					throw new Error(JSON.stringify(err.error));
				} else {
					if (url !== DEFAULT_URL) {
						new Notice('[CerebroGPT] Issue calling specified url: ' + url);
						throw new Error('[CerebroGPT] Issue calling specified url: ' + url);
					} else {
						new Notice(`[CerebroGPT] Error :: ${JSON.stringify(err)}`);
						throw new Error(JSON.stringify(err));
					}
				}
			}

			new Notice('issue calling OpenAI API, see console for more details');
			throw new Error('issue calling OpenAI API, see error for more details: ' + err);
		}
	}

	addHR(editor: Editor, role: string) {
		const newLine = `\n\n<hr class="__chatgpt_plugin">\n\n${this.getHeadingPrefix()}role::${role}\n\n`;
		editor.replaceRange(newLine, editor.getCursor());

		// move cursor to end of file
		const cursor = editor.getCursor();
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + newLine.length,
		};
		editor.setCursor(newCursor);
	}

	getFrontmatter(view: MarkdownView): ChatFrontMatter {
		/**
		 * Retrieves the frontmatter from a markdown file
		 */
		try {
			// Retrieve frontmatter
			const noteFile = app.workspace.getActiveFile();

			if (!noteFile) {
				throw new Error('No active file');
			}

			const metaMatter = app.metadataCache.getFileCache(noteFile)?.frontmatter;

			const shouldStream =
				metaMatter?.stream !== undefined
					? metaMatter.stream // If defined in frontmatter, use its value.
					: this.settings.stream !== undefined
						? this.settings.stream // If not defined in frontmatter but exists globally, use its value.
						: true; // Otherwise fallback on true.

			const temperature =
				metaMatter?.temperature !== undefined ? metaMatter.temperature : 0.3;

			return {
				title: metaMatter?.title || view.file?.basename,
				tags: metaMatter?.tags || [],
				model: metaMatter?.model || 'gpt-3.5-turbo',
				temperature: temperature,
				top_p: metaMatter?.top_p || 1,
				presence_penalty: metaMatter?.presence_penalty || 0,
				frequency_penalty: metaMatter?.frequency_penalty || 0,
				stream: shouldStream,
				max_tokens: metaMatter?.max_tokens || 512,
				stop: metaMatter?.stop || null,
				n: metaMatter?.n || 1,
				logit_bias: metaMatter?.logit_bias || null,
				user: metaMatter?.user || null,
				system_commands: metaMatter?.system_commands || null,
			};
		} catch (err) {
			throw new Error('Error getting frontmatter');
		}
	}

	splitMessages(text: string) {
		/**
		 * Splits a string based on the separator
		 */
		try {
			// <hr class="__chatgpt_plugin">
			return text.split('<hr class="__chatgpt_plugin">');
		} catch (err) {
			throw new Error('Error splitting messages' + err);
		}
	}

	clearConversationExceptFrontmatter(editor: Editor) {
		try {
			// get frontmatter
			const YAMLFrontMatter = /---\s*[\s\S]*?\s*---/g;
			const frontmatter = editor.getValue().match(YAMLFrontMatter);

			if (!frontmatter) {
				throw new Error('no frontmatter found');
			}

			// clear editor
			editor.setValue('');

			// add frontmatter
			editor.replaceRange(frontmatter[0], editor.getCursor());

			// get length of file
			const length = editor.lastLine();

			// move cursor to end of file https://davidwalsh.name/codemirror-set-focus-line
			const newCursor = {
				line: length + 1,
				ch: 0,
			};

			editor.setCursor(newCursor);

			return newCursor;
		} catch (err) {
			throw new Error('Error clearing conversation' + err);
		}
	}

	moveCursorToEndOfFile(editor: Editor) {
		try {
			// get length of file
			const length = editor.lastLine();

			// move cursor to end of file https://davidwalsh.name/codemirror-set-focus-line
			const newCursor = {
				line: length + 1,
				ch: 0,
			};
			editor.setCursor(newCursor);

			return newCursor;
		} catch (err) {
			throw new Error('Error moving cursor to end of file' + err);
		}
	}

	removeYMLFromMessage(message: string) {
		/**
		 * Removes any YAML content from a message
		 */
		try {
			const YAMLFrontMatter = /---\s*[\s\S]*?\s*---/g;
			const newMessage = message.replace(YAMLFrontMatter, '');
			return newMessage;
		} catch (err) {
			throw new Error('Error removing YML from message' + err);
		}
	}

	extractRoleAndMessage(message: string): ChatCompletionMessageParam {
		try {
			if (message.includes('role::')) {
				const role = message.split('role::')[1].split('\n')[0].trim();
				const content = message.split('role::')[1].split('\n').slice(1).join('\n').trim();

				if (role === 'assistant' || role === 'system' || role === 'user') {
					return { role, content };
				}
				throw new Error('Unknown role ' + role);
			} else {
				return { role: 'user', content: message };
			}
		} catch (err) {
			throw new Error('Error extracting role and message' + err);
		}
	}

	getHeadingPrefix() {
		const headingLevel = this.settings.headingLevel;
		if (headingLevel === 0) {
			return '';
		} else if (headingLevel > 6) {
			return '#'.repeat(6) + ' ';
		}
		return '#'.repeat(headingLevel) + ' ';
	}

	appendMessage(editor: Editor, role: string, message: string) {
		/*
		 append to bottom of editor file:
		 	const newLine = `<hr class="__chatgpt_plugin">\n${this.getHeadingPrefix()}role::${role}\n\n${message}`;
		*/

		const newLine = `\n\n<hr class="__chatgpt_plugin">\n\n${this.getHeadingPrefix()}role::${role}\n\n${message}\n\n<hr class="__chatgpt_plugin">\n\n${this.getHeadingPrefix()}role::user\n\n`;
		editor.replaceRange(newLine, editor.getCursor());
	}

	removeCommentsFromMessages(message: string) {
		/**
		 * Removes any comments from the messages
		 */
		try {
			// Comment block in form of =begin-chatgpt-md-comment and =end-chatgpt-md-comment
			const commentBlock = /=begin-chatgpt-md-comment[\s\S]*?=end-chatgpt-md-comment/g;

			// Remove comment block
			return message.replace(commentBlock, '');
		} catch (err) {
			throw new Error('Error removing comments from messages' + err);
		}
	}

	async inferTitleFromMessages(messages: string[]) {
		logger.info('[CerebroGPT] Inferring Title');
		new Notice('[CerebroGPT] Inferring title from messages...');

		try {
			if (messages.length < 2) {
				new Notice('Not enough messages to infer title. Minimum 2 messages.');
				return;
			}

			const prompt = `Infer title from the summary of the content of these messages. The title **cannot** contain any of the following characters: colon, back slash or forward slash. Just return the title. Write the title in ${
				this.settings.inferTitleLanguage
			}. \nMessages:\n\n${JSON.stringify(messages)}`;

			const titleMessage = [
				{
					role: 'user',
					content: prompt,
				},
			];

			const responseUrl = await requestUrl({
				url: `https://api.openai.com/v1/chat/completions`,
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.settings.apiKey}`,
					'Content-Type': 'application/json',
				},
				contentType: 'application/json',
				body: JSON.stringify({
					model: 'gpt-3.5-turbo',
					messages: titleMessage,
					max_tokens: 50,
					temperature: 0.0,
				}),
				throw: false,
			});

			const response = responseUrl.text;
			const responseJSON = JSON.parse(response);
			return responseJSON.choices[0].message.content
				.replace(/[:/\\]/g, '')
				.replace('Title', '')
				.replace('title', '')
				.trim();
		} catch (err) {
			new Notice('[CerebroGPT] Error inferring title from messages');
			throw new Error('[CerebroGPT] Error inferring title from messages' + err);
		}
	}

	// only proceed to infer title if the title is in timestamp format
	isTitleTimestampFormat(title: string) {
		try {
			const format = this.settings.dateFormat;
			const pattern = this.generateDatePattern(format);

			return title.length == format.length && pattern.test(title);
		} catch (err) {
			throw new Error('Error checking if title is in timestamp format' + err);
		}
	}

	generateDatePattern(format: string) {
		const pattern = format
			.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') // Escape any special characters
			.replace('YYYY', '\\d{4}') // Match exactly four digits for the year
			.replace('MM', '\\d{2}') // Match exactly two digits for the month
			.replace('DD', '\\d{2}') // Match exactly two digits for the day
			.replace('hh', '\\d{2}') // Match exactly two digits for the hour
			.replace('mm', '\\d{2}') // Match exactly two digits for the minute
			.replace('ss', '\\d{2}'); // Match exactly two digits for the second

		return new RegExp(`^${pattern}$`);
	}

	// get date from format
	getDate(date: Date, format = 'YYYYMMDDhhmmss') {
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const hour = date.getHours();
		const minute = date.getMinutes();
		const second = date.getSeconds();

		const paddedMonth = month.toString().padStart(2, '0');
		const paddedDay = day.toString().padStart(2, '0');
		const paddedHour = hour.toString().padStart(2, '0');
		const paddedMinute = minute.toString().padStart(2, '0');
		const paddedSecond = second.toString().padStart(2, '0');

		return format
			.replace('YYYY', year.toString())
			.replace('MM', paddedMonth)
			.replace('DD', paddedDay)
			.replace('hh', paddedHour)
			.replace('mm', paddedMinute)
			.replace('ss', paddedSecond);
	}

	async onload(): Promise<void> {
		logger.debug('[CerebroGPT] Adding status bar');

		const statusBarItemEl = this.addStatusBarItem();

		logger.debug('[CerebroGPT] Loading settings');
		await this.loadSettings();

		const streamManager = new StreamManager();

		this.openAIClient = new OpenAIClient(this.settings.apiKey);

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'call-chatgpt-api',
			name: 'Chat',
			icon: 'message-circle',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
				statusBarItemEl.setText('[CerebroGPT] Calling API...');

				// Retrieve frontmatter
				const frontmatter = this.getFrontmatter(view);

				// Retrieve messages
				const bodyWithoutYML = this.removeYMLFromMessage(editor.getValue());
				let messages = this.splitMessages(bodyWithoutYML);
				messages = messages.map((message) => this.removeCommentsFromMessages(message));

				const chatCompletionMessages = messages.map((message) =>
					this.extractRoleAndMessage(message),
				);

				if (frontmatter.system_commands) {
					const systemCommands = frontmatter.system_commands;
					// Prepend system commands to messages
					chatCompletionMessages.unshift(
						...systemCommands.map((command): ChatCompletionMessageParam => {
							return {
								role: 'system',
								content: command,
							};
						}),
					);
				}

				// Move cursor to end of file if generateAtCursor is false
				if (!this.settings.generateAtCursor) {
					this.moveCursorToEndOfFile(editor);
				}

				if (Platform.isMobile) {
					new Notice('[CerebroGPT] Calling API');
				}

				if (frontmatter.stream) {
				} else {
					this.openAIClient
						.createChatCompletion(chatCompletionMessages, frontmatter)
						.then((response: ChatCompletion) => {
							if (frontmatter.stream) {
							} else {
								const responseChatCompletion: ChatCompletion = response;
								let responseStr =
									responseChatCompletion.choices[0].message.content ||
									'No response';
								logger.info('[CerebroGPT] Model stopped generating', {
									finish_reason: responseChatCompletion.choices[0].finish_reason,
								});
								if (unfinishedCodeBlock(responseStr))
									responseStr = responseStr + '\n```';
								this.appendMessage(editor, 'assistant', responseStr);
							}

							statusBarItemEl.setText('');
						});
				}

				// this.callOpenAiApi(
				// 	streamManager,
				// 	editor,
				// 	chatCompletionMessages,
				// 	frontmatter.model,
				// 	frontmatter.max_tokens,
				// 	frontmatter.temperature,
				// 	frontmatter.top_p,
				// 	frontmatter.presence_penalty,
				// 	frontmatter.frequency_penalty,
				// 	frontmatter.stream,
				// 	frontmatter.stop,
				// 	frontmatter.n,
				// 	frontmatter.logit_bias,
				// 	frontmatter.user,
				// 	frontmatter.url
				// )
				// 	.then((response) => {
				// 		let responseStr = response;
				// 		if (response.mode === "streaming") {
				// 			responseStr = response.fullstr;
				// 			logger.info(responseStr);
				// 			// append \n\n<hr class="__chatgpt_plugin">\n\n${this.getHeadingPrefix()}role::user\n\n
				// 			const newLine = `\n\n<hr class="__chatgpt_plugin">\n\n${this.getHeadingPrefix()}role::user\n\n`;
				// 			editor.replaceRange(newLine, editor.getCursor());
				//
				// 			// move cursor to end of completion
				// 			const cursor = editor.getCursor();
				// 			const newCursor = {
				// 				line: cursor.line,
				// 				ch: cursor.ch + newLine.length,
				// 			};
				// 			editor.setCursor(newCursor);
				// 		} else {
				// 			if (unfinishedCodeBlock(responseStr)) {
				// 				responseStr = responseStr + "\n```";
				// 			}
				//
				// 			this.appendMessage(
				// 				editor,
				// 				"assistant",
				// 				responseStr
				// 			);
				// 		}
				//
				// 		if (this.settings.autoInferTitle) {
				// 			const title = view.file.basename;
				//
				// 			let messagesWithResponse = messages.concat(responseStr);
				// 			messagesWithResponse = messagesWithResponse.map((message) => {
				// 				return this.removeCommentsFromMessages(message);
				// 			});
				//
				// 			if (
				// 				this.isTitleTimestampFormat(title) &&
				// 				messagesWithResponse.length >= 4
				// 			) {
				// 				logger.info(
				// 					"[CerebroGPT] Auto inferring title from messages"
				// 				);
				//
				// 				statusBarItemEl.setText(
				// 					"[CerebroGPT] Calling API..."
				// 				);
				// 				this.inferTitleFromMessages(
				// 					messagesWithResponse
				// 				)
				// 					.then(async (title) => {
				// 						if (title) {
				// 							logger.info(
				// 								`[CerebroGPT] Automatically inferred title: ${title}. Changing file name...`
				// 							);
				// 							statusBarItemEl.setText("");
				//
				// 							await writeInferredTitleToEditor(
				// 								this.app.vault,
				// 								view,
				// 								this.app.fileManager,
				// 								this.settings.chatFolder,
				// 								title
				// 							);
				// 						} else {
				// 							new Notice(
				// 								"[CerebroGPT] Could not infer title",
				// 								5000
				// 							);
				// 						}
				// 					})
				// 					.catch((err) => {
				// 						logger.info(err);
				// 						statusBarItemEl.setText("");
				// 						if (Platform.isMobile) {
				// 							new Notice(
				// 								"[CerebroGPT] Error inferring title. " +
				// 									err,
				// 								5000
				// 							);
				// 						}
				// 					});
				// 			}
				// 		}
				//
				// 		statusBarItemEl.setText("");
				// 	})
				// 	.catch((err) => {
				// 		if (Platform.isMobile) {
				// 			new Notice(
				// 				"[CerebroGPT Mobile] Full error calling API." +
				// 					err,
				// 				9000
				// 			);
				// 		}
				// 		statusBarItemEl.setText("");
				// 		logger.info(err);
				// 	});
			},
		});

		this.addCommand({
			id: 'add-hr',
			name: 'Add divider',
			icon: 'minus',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.addHR(editor, 'user');
			},
		});

		this.addCommand({
			id: 'add-comment-block',
			name: 'Add comment block',
			icon: 'comment',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// add a comment block at cursor in format: =begin-chatgpt-md-comment and =end-chatgpt-md-comment
				const cursor = editor.getCursor();
				const line = cursor.line;
				const ch = cursor.ch;

				const commentBlock = `=begin-chatgpt-md-comment\n\n=end-chatgpt-md-comment`;
				editor.replaceRange(commentBlock, cursor);

				// move cursor to middle of comment block
				const newCursor = {
					line: line + 1,
					ch: ch,
				};
				editor.setCursor(newCursor);
			},
		});

		this.addCommand({
			id: 'stop-streaming',
			name: 'Stop streaming',
			icon: 'octagon',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				streamManager.stopStreaming();
			},
		});

		this.addCommand({
			id: 'infer-title',
			name: 'Infer title',
			icon: 'subtitles',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				// get messages
				const bodyWithoutYML = this.removeYMLFromMessage(editor.getValue());
				let messages = this.splitMessages(bodyWithoutYML);
				messages = messages.map((message) => {
					return this.removeCommentsFromMessages(message);
				});

				statusBarItemEl.setText('[CerebroGPT] Calling API...');
				const title = await this.inferTitleFromMessages(messages);
				statusBarItemEl.setText('');

				if (title) {
					await writeInferredTitleToEditor(
						this.app.vault,
						view,
						this.app.fileManager,
						this.settings.chatFolder,
						title,
					);
				}
			},
		});

		// grab highlighted text and move to new file in default chat format
		this.addCommand({
			id: 'move-to-chat',
			name: 'Create new chat with highlighted text',
			icon: 'highlighter',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					const selectedText = editor.getSelection();

					if (!this.settings.chatFolder || this.settings.chatFolder.trim() === '') {
						new Notice(
							`[CerebroGPT] No chat folder value found. Please set one in settings.`,
						);
						return;
					}

					if (!(await this.app.vault.adapter.exists(this.settings.chatFolder))) {
						const result = await createFolderModal(
							this.app,
							this.app.vault,
							'chatFolder',
							this.settings.chatFolder,
						);
						if (!result) {
							new Notice(
								`[CerebroGPT] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.`,
							);
							return;
						}
					}

					const newFile = await this.app.vault.create(
						`${this.settings.chatFolder}/${this.getDate(
							new Date(),
							this.settings.dateFormat,
						)}.md`,
						`${this.settings.defaultChatFrontmatter}\n\n${selectedText}`,
					);

					// open new file
					await this.app.workspace.openLinkText(newFile.basename, '', true, {
						state: { mode: 'source' },
					});
					const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

					if (!activeView) {
						new Notice('No active markdown editor found.');
						return;
					}

					activeView.editor.focus();
					this.moveCursorToEndOfFile(activeView.editor);
				} catch (err) {
					logger.error(
						`[CerebroGPT] Error in Create new chat with highlighted text`,
						err,
					);
					new Notice(
						`[CerebroGPT] Error in Create new chat with highlighted text, check console`,
					);
				}
			},
		});

		this.addCommand({
			id: 'choose-chat-template',
			name: 'Create new chat from template',
			icon: 'layout-template',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (!this.settings.chatFolder || this.settings.chatFolder.trim() === '') {
					new Notice(
						`[CerebroGPT] No chat folder value found. Please set one in settings.`,
					);
					return;
				}

				if (!(await this.app.vault.adapter.exists(this.settings.chatFolder))) {
					const result = await createFolderModal(
						this.app,
						this.app.vault,
						'chatFolder',
						this.settings.chatFolder,
					);
					if (!result) {
						new Notice(
							`[CerebroGPT] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.`,
						);
						return;
					}
				}

				if (
					!this.settings.chatTemplateFolder ||
					this.settings.chatTemplateFolder.trim() === ''
				) {
					new Notice(
						`[CerebroGPT] No chat template folder value found. Please set one in settings.`,
					);
					return;
				}

				if (!(await this.app.vault.adapter.exists(this.settings.chatTemplateFolder))) {
					const result = await createFolderModal(
						this.app,
						this.app.vault,
						'chatTemplateFolder',
						this.settings.chatTemplateFolder,
					);
					if (!result) {
						new Notice(
							`[CerebroGPT] No chat template folder found. One must be created to use plugin. Set one in settings and make sure it exists.`,
						);
						return;
					}
				}

				new ChatTemplatesHandler(
					this.app,
					this.settings,
					this.getDate(new Date(), this.settings.dateFormat),
				).open();
			},
		});

		this.addCommand({
			id: 'clear-chat',
			name: 'Clear chat (except frontmatter)',
			icon: 'trash',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				this.clearConversationExceptFrontmatter(editor);
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	private async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		logger.debug('Loaded settings', this.settings);
	}

	private async saveSettings() {
		await this.saveData(this.settings);
	}
}
