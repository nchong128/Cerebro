import { FileManager, MarkdownView, Notice, Vault, App } from 'obsidian';
import pino from 'pino';
import { FolderCreationModal } from './views/folderCreation';

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

	if (matcher.length % 2 !== 0) logger.info('[Cerebro] Unclosed code block detected');

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

		if (file) {
			fileManager.renameFile(file, newFileName);
		}
	} catch (err) {
		new Notice('[Cerebro] Error writing inferred title to editor');
		logger.info('[Cerebro] Error writing inferred title to editor', err);
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
		logger.info('[Cerebro] Creating folder');
		await vault.createFolder(folderPath);
	} else {
		logger.info('[Cerebro] Not creating folder');
	}

	return result;
};
