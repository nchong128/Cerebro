/* eslint-disable @typescript-eslint/no-var-requires */
import { Editor, MarkdownView, Notice, Platform, Plugin } from 'obsidian';
import { StreamManager } from './stream';
import { createFolderModal, unfinishedCodeBlock, writeInferredTitleToEditor } from 'lib/helpers';
import { SettingsTab } from './views/settings';
import { ChatTemplatesHandler } from './views/chatTemplates';
import { YAML_FRONTMATTER_REGEX } from './constants';
import { CerebroSettings, DEFAULT_SETTINGS } from './settings';
import { getFrontmatter as getFrontmatterFromSettings } from './settings';
import pino from 'pino';
import { OpenAIClient } from './models/openAIClient';
import OpenAI from 'openai';
import { Stream } from 'openai/src/streaming';
import ChatController from './controller';
import { AnthropicClient } from './models/anthropicClient';
import { ChatFrontmatter } from './types';

const logger = pino({
	level: 'info',
});

export default class Cerebro extends Plugin {
	public settings: CerebroSettings;
	private openAIClient: OpenAIClient;
	private anthropicClient: AnthropicClient;
	private chatController: ChatController;

	async onload(): Promise<void> {
		logger.debug('[Cerebro] Adding status bar');
		const statusBarItemEl = this.addStatusBarItem();

		logger.debug('[Cerebro] Loading settings');
		await this.loadSettings();

		const streamManager = new StreamManager();

		this.openAIClient = new OpenAIClient(this.settings.LLMSpecificSettings['OpenAI'].apiKey);
		this.anthropicClient = new AnthropicClient(
			this.settings.LLMSpecificSettings['Anthropic'].apiKey,
		);
		this.chatController = new ChatController(this.settings);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));

		// Grab highlighted text and move to new file in default chat format. If no text highlighted, creates an empty chat.
		this.addCommand({
			id: 'cerebro-create-new-chat',
			name: 'Create new chat',
			icon: 'highlighter',
			// TODO: make callback to allow creating new chat without being in an editor
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					const selectedText = editor.getSelection();

					if (!this.settings.chatFolder || this.settings.chatFolder.trim() === '') {
						new Notice(
							'[Cerebro] No chat folder value found. Please set one in settings.',
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
								`[Cerebro] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.`,
							);
							return;
						}
					}

					const filePath = `${this.settings.chatFolder}/${this.getDate(
						new Date(),
						this.settings.dateFormat,
					)}.md`;

					const frontmatter = getFrontmatterFromSettings(this.settings);
					const fileContent = `${frontmatter}\n\n${selectedText}`;
					const newFile = await this.app.vault.create(filePath, fileContent);

					// Open new file
					await this.app.workspace.openLinkText(newFile.basename, '', true, {
						state: { mode: 'source' },
					});
					const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (!activeView) {
						new Notice('No active markdown editor found.');
						return;
					}

					activeView.editor.focus();
					this.chatController.moveCursorToEndOfFile(activeView.editor);
				} catch (err) {
					logger.error(`[Cerebro] Error in Create new chat with highlighted text`, err);
					new Notice(
						`[Cerebro] Error in Create new chat with highlighted text, check console`,
					);
				}
			},
		});

		// Adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'cerebro-chat',
			name: 'Chat',
			icon: 'message-circle',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
				statusBarItemEl.setText('[Cerebro] Calling API...');

				if (Platform.isMobile) new Notice('[Cerebro] Calling API');

				// Retrieve frontmatter
				const frontmatter = this.getFrontmatter(view);

				// Retrieve and process messages
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
						...systemCommands.map((command): OpenAI.Chat.ChatCompletionMessageParam => {
							return {
								role: 'system',
								content: command,
							};
						}),
					);
				}

				const position = this.chatController.completeUserResponse(editor);

				const chatCompletion = await this.openAIClient.createChatCompletion(
					chatCompletionMessages,
					frontmatter,
				);

				let responseStr;
				if (frontmatter.stream) {
					const chatCompletionStream =
						chatCompletion as unknown as Stream<OpenAI.Chat.ChatCompletion>;

					const { fullResponse, finishReason } = await streamManager.streamOpenAIResponse(
						chatCompletionStream,
						editor,
						position,
					);
					responseStr = fullResponse;
					logger.info('[Cerebro] Model finished generating', {
						finish_reason: finishReason,
					});
				} else {
					const response = chatCompletion as OpenAI.ChatCompletion;
					responseStr = response.choices[0].message.content || 'No response';
					logger.info('[Cerebro] Model finished generating', {
						finish_reason: response.choices[0].finish_reason,
					});
					if (unfinishedCodeBlock(responseStr)) responseStr = responseStr + '\n```';
					this.chatController.appendNonStreamingMessage(editor, responseStr);
				}

				this.chatController.completeAssistantResponse(editor);

				statusBarItemEl.setText('');

				if (this.settings.autoInferTitle) {
					const messagesWithResponse = messages.concat(responseStr);

					const title = view?.file?.basename;

					if (
						title &&
						this.isTitleTimestampFormat(title) &&
						messagesWithResponse.length >= 4
					) {
						logger.info('[Cerebro] Auto inferring title from messages');
						statusBarItemEl.setText('[Cerebro] Calling API...');

						try {
							const title = await this.inferTitleFromMessages(messagesWithResponse);
							if (title) {
								logger.info(
									`[Cerebro] Automatically inferred title: ${title}. Changing file name...`,
								);
								statusBarItemEl.setText('');
								await writeInferredTitleToEditor(
									this.app.vault,
									view,
									this.app.fileManager,
									this.settings.chatFolder,
									title,
								);
							} else {
								new Notice('[Cerebro] Could not infer title', 5000);
							}
						} catch (e) {
							logger.info(e);
							statusBarItemEl.setText('');
							if (Platform.isMobile) {
								new Notice(`[Cerebro] Error inferring title. ${e}`, 5000);
							}
						}
					}
				}
			},
		});

		this.addCommand({
			id: 'cerebro-add-hr',
			name: 'Add divider',
			icon: 'minus',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.chatController.addHR(editor);
			},
		});

		this.addCommand({
			id: 'cerebro-add-comment-block',
			name: 'Add comment block',
			icon: 'comment',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// add a comment block at cursor in format: =begin-comment and =end-comment
				const cursor = editor.getCursor();
				const { line, ch } = cursor;

				const commentBlock = `=begin-comment\n\n=end-comment`;
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
			id: 'cerebro-stop-streaming',
			name: 'Stop streaming',
			icon: 'octagon',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				streamManager.stopStreaming();
			},
		});

		this.addCommand({
			id: 'cerebro-infer-title',
			name: 'Infer title',
			icon: 'subtitles',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const bodyWithoutYML = this.removeYMLFromMessage(editor.getValue());
				let messages = this.splitMessages(bodyWithoutYML);
				messages = messages.map((message) => {
					return this.removeCommentsFromMessages(message);
				});

				statusBarItemEl.setText('[Cerebro] Calling API...');
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

		this.addCommand({
			id: 'choose-chat-template',
			name: 'Create new chat from template',
			icon: 'layout-template',
			editorCallback: async (editor: Editor, view: MarkdownView): Promise<void> => {
				if (!this.settings.chatFolder || this.settings.chatFolder.trim() === '') {
					new Notice(`[Cerebro] No chat folder value found. Please set one in settings.`);
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
							`[Cerebro] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.`,
						);
						return;
					}
				}

				if (
					!this.settings.chatTemplateFolder ||
					this.settings.chatTemplateFolder.trim() === ''
				) {
					new Notice(
						`[Cerebro] No chat template folder value found. Please set one in settings.`,
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
							`[Cerebro] No chat template folder found. One must be created to use plugin. Set one in settings and make sure it exists.`,
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
			id: 'cerebro-clear-chat',
			name: 'Clear chat (except frontmatter)',
			icon: 'trash',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				this.clearConversationExceptFrontmatter(editor);
			},
		});
	}

	getFrontmatter(view: MarkdownView): ChatFrontmatter {
		/**
		 * Retrieves the frontmatter from a markdown file
		 */
		try {
			// Retrieve frontmatter
			const noteFile = this.app.workspace.getActiveFile();

			if (!noteFile) {
				throw new Error('No active file');
			}

			const metaMatter = this.app.metadataCache.getFileCache(noteFile)?.frontmatter;

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
			// <hr class="__cerebro_plugin">
			return text.split('<hr class="__cerebro_plugin">');
		} catch (err) {
			throw new Error('Error splitting messages' + err);
		}
	}

	clearConversationExceptFrontmatter(editor: Editor) {
		try {
			// Retrieve frontmatter
			const frontmatter = editor.getValue().match(YAML_FRONTMATTER_REGEX);

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

	removeYMLFromMessage(message: string) {
		/**
		 * Removes any YAML content from a message
		 */
		try {
			return message.replace(YAML_FRONTMATTER_REGEX, '');
		} catch (err) {
			throw new Error('Error removing YML from message' + err);
		}
	}

	extractRoleAndMessage(message: string): OpenAI.Chat.ChatCompletionMessageParam {
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

	removeCommentsFromMessages(message: string) {
		/**
		 * Removes any comments from the messages
		 */
		try {
			// Comment block in form of =begin-comment and =end-comment
			const commentBlock = /=begin-comment[\s\S]*?=end-comment/g;

			// Remove comment block
			return message.replace(commentBlock, '');
		} catch (err) {
			throw new Error('Error removing comments from messages' + err);
		}
	}

	async inferTitleFromMessages(messages: string[]) {
		logger.info('[Cerebro] Inferring Title');
		new Notice('[Cerebro] Inferring title from messages...');

		try {
			return await this.openAIClient.inferTitle(messages, this.settings.inferTitleLanguage);
		} catch (err) {
			new Notice('[Cerebro] Error inferring title from messages');
			throw new Error('[Cerebro] Error inferring title from messages' + err);
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

	private async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		logger.debug('Loaded settings', this.settings);
	}

	public async saveSettings() {
		logger.info('[Cerebro] Saving settings');
		this.chatController.updateSettings(this.settings);
		await this.saveData(this.settings);
	}
}
