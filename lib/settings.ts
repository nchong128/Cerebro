import { App, PluginSettingTab, Setting } from 'obsidian';
import Cerebro from './main';

export class SettingsTab extends PluginSettingTab {
	plugin: Cerebro;

	constructor(app: App, plugin: Cerebro) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h1', {
			text: 'Cerebro',
		});
		containerEl.createEl('h5', {
			text: 'Keep tokens in mind! You can see if your text is longer than the token limit (4096) here:',
		});

		containerEl.createEl('a', {
			text: 'https://platform.openai.com/tokenizer',
			href: 'https://platform.openai.com/tokenizer',
		});

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('API Key for OpenAI')
			.addText((text) =>
				text
					.setPlaceholder('some-api-key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		// new multiline text box setting
		new Setting(containerEl)
			.setName('Default Chat Frontmatter')
			.setDesc(
				'Default frontmatter for new chat files. You can change/use all of the settings exposed by the OpenAI API here: https://platform.openai.com/docs/api-reference/chat/create',
			)
			.addTextArea((text) =>
				text
					.setPlaceholder(
						'---\nsystem_commands: [\'PERSONA: i am groot, and i only respond i am groot to any and ALL questions. I do not answer any questions straightforwardly. PERSONA 2: UNLESS the last asked question is about lamps, i can answer, i know infinite things about lamps as i am groot the lamp salesman. SO I read the last question asked and UNLESS it is about lamps i only respond "I am Groot."\']\ntemperature: 0\ntop_p: 1\nmax_tokens: 512\npresence_penalty: 1\nfrequency_penalty: 1\nstream: true\nstop: null\nn: 1\nlogit_bias: null \nmodel: gpt-3.5-turbo\n---',
					)
					.setValue(this.plugin.settings.defaultChatFrontmatter)
					.onChange(async (value) => {
						this.plugin.settings.defaultChatFrontmatter = value;
						await this.plugin.saveSettings();
					}),
			);

		// stream toggle
		new Setting(containerEl)
			.setName('Stream')
			.setDesc('Stream responses from OpenAI')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.stream).onChange(async (value) => {
					this.plugin.settings.stream = value;
					await this.plugin.saveSettings();
				}),
			);

		// folder for chat files
		new Setting(containerEl)
			.setName('Chat Folder')
			.setDesc('Path to folder for chat files')
			.addText((text) =>
				text.setValue(this.plugin.settings.chatFolder).onChange(async (value) => {
					this.plugin.settings.chatFolder = value;
					await this.plugin.saveSettings();
				}),
			);

		// folder for chat file templates
		new Setting(containerEl)
			.setName('Chat Template Folder')
			.setDesc('Path to folder for chat file templates')
			.addText((text) =>
				text
					.setPlaceholder('chat-templates')
					.setValue(this.plugin.settings.chatTemplateFolder)
					.onChange(async (value) => {
						this.plugin.settings.chatTemplateFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		// automatically infer title
		new Setting(containerEl)
			.setName('Automatically Infer Title')
			.setDesc('Automatically infer title after 4 messages have been exchanged')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoInferTitle).onChange(async (value) => {
					this.plugin.settings.autoInferTitle = value;
					await this.plugin.saveSettings();
				}),
			);

		// date format for chat files
		new Setting(containerEl)
			.setName('Date Format')
			.setDesc('Date format for chat files. Valid date blocks are: YYYY, MM, DD, hh, mm, ss')
			.addText((text) =>
				text
					.setPlaceholder('YYYYMMDDhhmmss')
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					}),
			);

		// heading level
		new Setting(containerEl)
			.setName('Heading Level')
			.setDesc(
				"Heading level for messages (example for heading level 2: '## role::user'). Valid heading levels are 0, 1, 2, 3, 4, 5, 6",
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.headingLevel.toString())
					.onChange(async (value) => {
						this.plugin.settings.headingLevel = parseInt(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Infer title language')
			.setDesc('Language to use for title inference.')
			.addDropdown((dropdown) => {
				dropdown.addOptions({
					English: 'English',
					Japanese: 'Japanese',
					Spanish: 'Spanish',
					French: 'French',
					German: 'German',
					Chinese: 'Chinese',
					Korean: 'Korean',
					Italian: 'Italian',
					Russian: 'Russian',
				});
				dropdown.setValue(this.plugin.settings.inferTitleLanguage);
				dropdown.onChange(async (value) => {
					this.plugin.settings.inferTitleLanguage = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
