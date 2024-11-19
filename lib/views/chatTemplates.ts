import { App, Notice, SuggestModal, TFile, TFolder } from 'obsidian';
import { CerebroSettings } from '../types';

interface ChatTemplates {
	title: string;
	file: TFile;
}

export class ChatTemplatesHandler extends SuggestModal<ChatTemplates> {
	readonly #settings: CerebroSettings;
	readonly #titleDate: string;

	constructor(app: App, settings: CerebroSettings, titleDate: string) {
		super(app);
		this.#settings = settings;
		this.#titleDate = titleDate;
	}

	public getFilesInChatFolder(): TFile[] {
		const folder = this.app.vault.getAbstractFileByPath(
			this.#settings.chatTemplateFolder,
		) as TFolder;
		if (folder != null) {
			return folder.children as TFile[];
		} else {
			new Notice(`Error getting folder: ${this.#settings.chatTemplateFolder}`);
			throw new Error(`Error getting folder: ${this.#settings.chatTemplateFolder}`);
		}
	}

	// Returns all available suggestions.
	public getSuggestions(query: string): ChatTemplates[] {
		const chatTemplateFiles = this.getFilesInChatFolder();

		if (query == '') {
			return chatTemplateFiles.map((file) => {
				return {
					title: file.basename,
					file: file,
				};
			});
		}

		return chatTemplateFiles
			.filter((file) => {
				return file.basename.toLowerCase().includes(query.toLowerCase());
			})
			.map((file) => {
				return {
					title: file.basename,
					file: file,
				};
			});
	}

	// Renders each suggestion item.
	public renderSuggestion(template: ChatTemplates, el: HTMLElement) {
		el.createEl('div', { text: template.title });
	}

	// Perform action on the selected suggestion.
	public async onChooseSuggestion(template: ChatTemplates, evt: MouseEvent | KeyboardEvent) {
		new Notice(`Selected ${template.title}`);
		const templateText = await this.app.vault.read(template.file);
		// use template text to create new file in chat folder
		const file = await this.app.vault.create(
			`${this.#settings.chatFolder}/${this.#titleDate}.md`,
			templateText,
		);

		// open new file
		this.app.workspace.openLinkText(file.basename, '', true);
	}
}
