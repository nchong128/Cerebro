import { Editor, MarkdownView, Notice, Platform, Plugin } from 'obsidian';
import {
	createFolderModal,
	getDate,
	isTitleTimestampFormat,
	sanitizeTitle,
	writeInferredTitleToEditor,
} from 'lib/helpers';
import { SettingsTab } from './views/settingsTab';
import { ChatTemplatesHandler } from './views/chatTemplates';
import { CerebroMessages, ERROR_NOTICE_TIMEOUT_MILLISECONDS } from './constants';
import { CerebroSettings, DEFAULT_SETTINGS } from './settings';
import { getFrontmatter as getFrontmatterFromSettings } from './settings';
import pino from 'pino';
import { OpenAIClient } from './models/openAIClient';
import ChatInterface from './chatInterface';
import { AnthropicClient } from './models/anthropicClient';
import { LLM, Message } from './types';
import { LLMClient } from './models/client';

const logger = pino({
	level: 'info',
});

export default class Cerebro extends Plugin {
	public settings: CerebroSettings;
	private llmClients: Record<LLM, LLMClient>;

	async onload(): Promise<void> {
		logger.debug('[Cerebro] Adding status bar');
		const statusBarItemEl = this.addStatusBarItem();

		logger.debug('[Cerebro] Loading settings');
		await this.loadSettings();

		this.llmClients = {
			OpenAI: new OpenAIClient(this.settings.llmSettings['OpenAI'].apiKey),
			Anthropic: new AnthropicClient(this.settings.llmSettings['Anthropic'].apiKey),
		};

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));

		// Grab highlighted text and move to new file in default chat format. If no text highlighted, creates an empty chat.
		this.addCommand({
			id: 'cerebro-create-new-chat',
			name: 'Create new chat',
			icon: 'highlighter',
			// TODO: make callback to allow creating new chat without being in an editor
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const chatInterface = new ChatInterface(this.settings, editor, view);

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

					const filePath = `${this.settings.chatFolder}/${getDate(
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
					chatInterface.moveCursorToEndOfFile(activeView.editor);
				} catch (e) {
					logger.error(`[Cerebro] Error in Create new chat with highlighted text`, e);
					new Notice(
						`[Cerebro] Error while creating new chat with highlighted text. See console for more details. ` +
							e.message,
						ERROR_NOTICE_TIMEOUT_MILLISECONDS,
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
				statusBarItemEl.setText(CerebroMessages.CALLING_API);
				if (Platform.isMobile) new Notice(CerebroMessages.CALLING_API);

				// By creating a new ChatInterface in each invocation, we should be able to work with each view better
				const chatInterface = new ChatInterface(this.settings, editor, view);

				// Streaming requires constant work with the editor and the LLM client
				// This is something the plugin should be managing but only the LLM should work with its internals
				// Plugin passes ChatInterface for it to work with the LLM client. LLM retrieves the chunks
				// and passes into the ChatInterface to handle.
				const frontmatter = chatInterface.getFrontmatter(this.app);
				logger.info('[Cerebro] frontmatter', frontmatter);
				const llm = this.llmClients[frontmatter.llm];
				const messages = await chatInterface.getMessages(this.app);
				logger.info('[Cerebro] messages', messages);
				chatInterface.completeUserResponse();

				let response: Message;
				try {
					response = await llm.chat(messages, frontmatter, chatInterface);
					chatInterface.completeAssistantResponse();
				} catch (e) {
					new Notice(
						'[Cerebro] Chat failed: ' + e.message,
						ERROR_NOTICE_TIMEOUT_MILLISECONDS,
					);
				}
				statusBarItemEl.setText(CerebroMessages.EMPTY);

				if (this.settings.autoInferTitle) {
					const messagesWithResponse = messages.concat(response);
					const title = view?.file?.basename;

					if (
						title &&
						isTitleTimestampFormat(title, this.settings.dateFormat) &&
						messagesWithResponse.length >= 4
					) {
						logger.info('[Cerebro] Auto inferring title from messages');
						statusBarItemEl.setText('[Cerebro] Calling API...');

						try {
							const title = await this.inferTitleFromMessages(
								messagesWithResponse,
								llm,
							);
							if (title) {
								logger.info(
									`[Cerebro] Automatically inferred title: ${title}. Changing file name...`,
								);
								statusBarItemEl.setText(CerebroMessages.EMPTY);
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
							statusBarItemEl.setText(CerebroMessages.EMPTY);
							if (Platform.isMobile) {
								new Notice(
									`[Cerebro] Error inferring title: ${e.message}`,
									ERROR_NOTICE_TIMEOUT_MILLISECONDS,
								);
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
				const chatInterface = new ChatInterface(this.settings, editor, view);
				chatInterface.addHR();
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
			id: 'cerebro-infer-title',
			name: 'Infer title',
			icon: 'subtitles',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const chatInterface = new ChatInterface(this.settings, editor, view);
				const frontmatter = chatInterface.getFrontmatter(this.app);
				const client = this.llmClients[frontmatter.llm];
				const messages = await chatInterface.getMessages(this.app);
				const title = await this.inferTitleFromMessages(messages, client);

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
			id: 'cerebro-choose-chat-template',
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
					getDate(new Date(), this.settings.dateFormat),
				).open();
			},
		});

		this.addCommand({
			id: 'cerebro-clear-chat',
			name: 'Clear chat (except frontmatter)',
			icon: 'trash',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const chatInterface = new ChatInterface(this.settings, editor, view);
				try {
					chatInterface.clearConversationExceptFrontmatter(editor);
				} catch (e) {
					new Notice('[Cerebro] Error clearing chat');
				}
			},
		});
	}

	private async inferTitleFromMessages(messages: Message[], client: LLMClient): Promise<string> {
		logger.info('[Cerebro] Inferring title');
		new Notice('[Cerebro] Inferring title from messages...');

		try {
			const title = await client.inferTitle(messages, this.settings.inferTitleLanguage);
			return sanitizeTitle(title);
		} catch (e) {
			new Notice(
				'[Cerebro] Error inferring title from messages',
				ERROR_NOTICE_TIMEOUT_MILLISECONDS,
			);
			throw new Error('[Cerebro] Error inferring title from messages' + e);
		}
	}

	private async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		logger.debug('Loaded settings', this.settings);
	}

	public async saveSettings() {
		logger.info('[Cerebro] Saving settings');
		await this.saveData(this.settings);
	}
}
