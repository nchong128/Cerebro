import { isTitleTimestampFormat, sanitizeTitle, writeInferredTitleToEditor } from 'lib/helpers';
import { MarkdownView, Notice, Platform, Plugin, TFile } from 'obsidian';
import { getCommands } from './commands';
import { CerebroMessages, ERROR_NOTICE_TIMEOUT_MILLISECONDS } from './constants';
import { AnthropicClient } from './models/anthropicClient';
import { LLMClient } from './models/client';
import { OpenAIClient } from './models/openAIClient';
import { CerebroSettings, DEFAULT_SETTINGS } from './settings';
import { LLM, Message } from './types';
import { SettingsTab } from './views/settingsTab';
import { logger } from './logger';
import ChatInterface from './chatInterface';

export default class Cerebro extends Plugin {
	public chatInterfaces: Map<TFile, ChatInterface> = new Map();
	public settings: CerebroSettings;
	public statusBar: HTMLElement;
	private llmClients: Record<LLM, LLMClient>;

	async onload(): Promise<void> {
		logger.debug('[Cerebro] Adding status bar');
		this.statusBar = this.addStatusBarItem();

		logger.debug('[Cerebro] Loading settings');
		await this.loadSettings();

		this.initializeLLMClients();
		this.addSettingTab(new SettingsTab(this.app, this));

		// Register all commands
		const commands = getCommands(this);
		commands.forEach((command) => this.addCommand(command));
	}

	private initializeLLMClients(): void {
		this.llmClients = {
			OpenAI: new OpenAIClient(this.settings.llmSettings['OpenAI'].apiKey),
			Anthropic: new AnthropicClient(this.settings.llmSettings['Anthropic'].apiKey),
		};
	}

	public getLLMClient(llm: LLM): LLMClient {
		return this.llmClients[llm];
	}

	public async handleTitleInference(
		messages: Message[],
		view: MarkdownView,
		llm: LLMClient,
	): Promise<void> {
		const title = view?.file?.basename;

		if (
			title &&
			isTitleTimestampFormat(title, this.settings.dateFormat) &&
			messages.length >= 4
		) {
			logger.info('[Cerebro] Auto inferring title from messages');
			this.statusBar.setText('[Cerebro] Calling API...');

			try {
				const newTitle = await this.inferTitleFromMessages(messages, llm);
				if (newTitle) {
					await writeInferredTitleToEditor(
						this.app.vault,
						view,
						this.app.fileManager,
						this.settings.chatFolder,
						newTitle,
					);
				} else {
					new Notice('[Cerebro] Could not infer title', 5000);
				}
			} catch (e) {
				logger.error(e);
				this.statusBar.setText(CerebroMessages.EMPTY);
				if (Platform.isMobile) {
					new Notice(
						`[Cerebro] Error inferring title: ${e.message}`,
						ERROR_NOTICE_TIMEOUT_MILLISECONDS,
					);
				}
			}
		}
	}

	public async inferTitleFromMessages(messages: Message[], client: LLMClient): Promise<string> {
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

	public async onunload() {
		this.chatInterfaces.clear();
	}
}
