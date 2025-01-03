import { MarkdownView, Notice, TFile } from 'obsidian';
import Cerebro from '../main';
import ChatInterface from '../chatInterface';
import { createFolderModal, getDate } from '../helpers';
import { getFrontmatter as getFrontmatterFromSettings } from '../settings';

export async function validateAndCreateChatFolder(plugin: Cerebro): Promise<boolean> {
	if (!plugin.settings.chatFolder || plugin.settings.chatFolder.trim() === '') {
		new Notice('[Cerebro] No chat folder value found. Please set one in settings.');
		return false;
	}

	if (!(await plugin.app.vault.adapter.exists(plugin.settings.chatFolder))) {
		const result = await createFolderModal(
			plugin.app,
			plugin.app.vault,
			'chatFolder',
			plugin.settings.chatFolder,
		);
		if (!result) {
			new Notice(
				'[Cerebro] No chat folder found. One must be created to use plugin. Set one in settings and make sure it exists.',
			);
			return false;
		}
	}
	return true;
}

export async function createNewChatFile(
	plugin: Cerebro,
	selectedText: string,
): Promise<TFile | null> {
	const folderValid = await validateAndCreateChatFolder(plugin);
	if (!folderValid) return null;

	const filePath = `${plugin.settings.chatFolder}/${getDate(
		new Date(),
		plugin.settings.dateFormat,
	)}.md`;

	const frontmatter = getFrontmatterFromSettings(plugin.settings);
	const fileContent = `${frontmatter}\n\n${selectedText}`;
	return plugin.app.vault.create(filePath, fileContent);
}

export async function openInMainEditor(
	plugin: Cerebro,
	newFile: TFile,
	chatInterface: ChatInterface,
): Promise<void> {
	await plugin.app.workspace.openLinkText(newFile.basename, '', true, {
		state: { mode: 'source' },
	});

	const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeView) {
		new Notice('No active markdown editor found.');
		return;
	}

	activeView.editor.focus();
	chatInterface.moveCursorToEndOfFile(activeView.editor);
}

export async function openInSidebar(
	plugin: Cerebro,
	newFile: TFile,
	chatInterface: ChatInterface,
): Promise<void> {
	const leaf = plugin.app.workspace.getRightLeaf(false);
	if (!leaf) return;

	await leaf.setViewState({
		type: 'markdown',
		state: {
			file: newFile.path,
			mode: 'source',
		},
	});

	plugin.app.workspace.revealLeaf(leaf);

	const sidebarView = leaf.view as MarkdownView;
	if (sidebarView && sidebarView.editor) {
		sidebarView.editor.focus();
		chatInterface.moveCursorToEndOfFile(sidebarView.editor);
	}
}
