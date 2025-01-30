import { FileManager, MarkdownView, Notice, Vault, App } from 'obsidian';
import pino from 'pino';
import { FolderCreationModal } from './views/folderCreation';
import {
	ImageExtension,
	ImageExtensionToMimeType,
	ImageMessageContent,
	Message,
	PDFFileExtension,
	DocumentMessageContent,
	TextFileExtension,
	TextMessageContent,
} from './types';
import { CerebroSettings } from './settings';
import { logger } from './logger';

export const sanitizeTitle = (title: string): string => {
	return title
		.replace(/[:/\\]/g, '')
		.replace('Title', '')
		.replace('title', '')
		.trim();
};

export const unfinishedCodeBlock = (txt: string) => {
	/**
	 * Check for unclosed code block in MD (three backticks), string should contain three backticks in a row
	 */
	const matcher = txt.match(/```/g);
	if (!matcher) return false;
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

// Helper function to check if a filepath is an image
export const isValidImageExtension = (ext: string): ext is ImageExtension => {
	return Object.keys(ImageExtensionToMimeType).includes(ext.toUpperCase());
};

// Helper function to check if a filepath is a text file
export const isValidFileExtension = (ext: string): ext is TextFileExtension => {
	return Object.keys(TextFileExtension).includes(ext.toUpperCase());
};

// Helper function to check if a filepath is a pdf file
export const isValidPDFExtension = (ext: string | undefined): ext is PDFFileExtension => {
	if (!ext) return false;
	return Object.keys(PDFFileExtension).includes(ext.toUpperCase());
};

// only proceed to infer title if the title is in timestamp format
export const isTitleTimestampFormat = (title: string, dateFormat: string): boolean => {
	try {
		const pattern = generateDatePattern(dateFormat);

		return title.length == dateFormat.length && pattern.test(title);
	} catch (err) {
		throw new Error('Error checking if title is in timestamp format' + err);
	}
};

const generateDatePattern = (format: string): RegExp => {
	const pattern = format
		.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') // Escape any special characters
		.replace('YYYY', '\\d{4}') // Match exactly four digits for the year
		.replace('MM', '\\d{2}') // Match exactly two digits for the month
		.replace('DD', '\\d{2}') // Match exactly two digits for the day
		.replace('hh', '\\d{2}') // Match exactly two digits for the hour
		.replace('mm', '\\d{2}') // Match exactly two digits for the minute
		.replace('ss', '\\d{2}'); // Match exactly two digits for the second

	return new RegExp(`^${pattern}$`);
};

// get date from format
export const getDate = (date: Date, format = 'YYYYMMDDhhmmss'): string => {
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
};

export const getCerebroBaseSystemPrompts = (settings: CerebroSettings): string[] => {
	return [
		// Formalities
		`Your name is ${settings.assistantName}. You are speaking to ${settings.username}.`,

		// Obsidian Context
		'You are speaking through an Obsidian markdown document. You understand markdown syntax and can interpret double-bracketed links to files and images. When referenced, focus on content rather than the file nature.',
	];
};

export const isTextContent = (
	mc: TextMessageContent | ImageMessageContent | DocumentMessageContent,
): mc is TextMessageContent => {
	return mc.type === 'text';
};

export const getTextOnlyContent = (messages: Message[]): Message[] => {
	return messages.map((message) => {
		if (typeof message.content === 'string') {
			return message;
		}
		return {
			...message,
			content: message.content
				.filter(isTextContent)
				.map((content) => content.text)
				.join('\n'),
		};
	});
};
