import { FileManager, MarkdownView, Notice, Vault, Modal, App, Setting } from 'obsidian';
import pino from 'pino';

const logger = pino({
	level: 'info',
});

export const unfinishedCodeBlock = (txt: string) => {
	/**
	 * Check for unclosed code block in MD (three backticks), string should contain three backticks in a row
	 */
	const matcher = txt.match(/```/g);
	if (!matcher) {
		return false;
	}

	if (matcher.length % 2 !== 0) logger.info('[CerebroGPT] Unclosed code block detected');

	return matcher.length % 2 !== 0;
};

export const writeInferredTitleToEditor = async (
	vault: Vault,
	view: MarkdownView,
	fileManager: FileManager,
	chatFolder: string,
	title: string,
) => {
	try {
		// set title of file
		const file = view.file;
		// replace trailing / if it exists
		const folder = chatFolder.replace(/\/$/, '');

		// if new file name exists in directory, append a number to the end
		let newFileName = `${folder}/${title}.md`;
		let i = 1;

		while (await vault.adapter.exists(newFileName)) {
			newFileName = `${folder}/${title} (${i}).md`;
			i++;
		}

		fileManager.renameFile(file, newFileName);
	} catch (err) {
		new Notice('[CerebroGPT] Error writing inferred title to editor');
		logger.info('[CerebroGPT] Error writing inferred title to editor', err);
		throw err;
	}
};

export const createFolderModal = async (
	app: App,
	vault: Vault,
	folderName: string,
	folderPath: string,
) => {
	const folderCreationModal = new FolderCreationModal(app, folderName, folderPath);

	folderCreationModal.open();
	const result = await folderCreationModal.waitForModalValue();

	if (result) {
		logger.info('[CerebroGPT] Creating folder');
		await vault.createFolder(folderPath);
	} else {
		logger.info('[CerebroGPT] Not creating folder');
	}

	return result;
};

class FolderCreationModal extends Modal {
	result: boolean;
	folderName: string;
	folderPath: string;
	modalPromise: Promise<boolean>;
	resolveModalPromise: (value: boolean) => void;

	constructor(app: App, folderName: string, folderPath: string) {
		super(app);
		this.folderName = folderName;
		this.folderPath = folderPath;

		this.result = false;
		this.modalPromise = new Promise((resolve) => {
			this.resolveModalPromise = resolve;
		});
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', {
			text: `[CerebroGPT] No ${this.folderName} folder found.`,
		});

		contentEl.createEl('p', {
			text: `If you choose "Yes, Create", the plugin will automatically create a folder at: ${this.folderPath}. You can change this path in the plugin settings.`,
		});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Yes, Create Folder')
				.setTooltip('Create folder')
				.setCta()
				.onClick(() => {
					this.result = true; // This can be any value the user provides.
					this.resolveModalPromise(this.result);
					this.close();
				}),
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("No, I'll create it myself")
				.setTooltip('Cancel')
				.setCta()
				.onClick(() => {
					this.result = false; // This can be any value the user provides.
					this.resolveModalPromise(this.result);
					this.close();
				}),
		);
	}

	waitForModalValue() {
		return this.modalPromise;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
