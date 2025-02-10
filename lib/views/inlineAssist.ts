import { logger } from 'lib/logger';
import Cerebro from 'lib/main';
import { App, Editor, EditorPosition, Modal, Notice, SuggestModal } from 'obsidian';

interface Action {
	title: string;
	type: 'transform' | 'custom';
	action?: (input: string) => void;
}

export class InlineAssistSuggestModal extends SuggestModal<Action> {
	private editor: Editor;
	private currentInput: string;
	private customAction: ((input: string) => void) | null = null;
	private SUGGESTIONS: Action[] = [{ title: '→ Proofread', type: 'transform' }];

	constructor(app: App, editor: Editor) {
		super(app);
		this.editor = editor;
		this.setPlaceholder('Transform or type a custom command...');

		// Hack: intercept input changes and handle Enter directly
		this.inputEl.addEventListener('input', (e) => {
			this.currentInput = (e.target as HTMLInputElement).value;
		});

		this.scope.register(['Shift'], 'Enter', (evt: KeyboardEvent) => {
			logger.info('key', evt);
		});
	}

	getSuggestions(query: string): Action[] {
		return this.SUGGESTIONS.filter((sugg) =>
			sugg.title.toLowerCase().includes(query.toLowerCase()),
		);
	}

	renderSuggestion(action: Action, el: HTMLElement) {
		el.createEl('div', { text: action.title });
	}

	async onChooseSuggestion(sugg: Action, evt: MouseEvent | KeyboardEvent) {
		if (sugg.type === 'transform') {
			const selectedText = this.editor.getSelection();
			const cursor = this.editor.getCursor();

			// For demo, using dummy replacements
			const options = ['Dummy replacement 1', 'Dummy replacement 2', 'Dummy replacement 3'];

			// Show inline diff for first option
			this.showInlineDiff(selectedText, options[0], cursor);
		}
	}

	private showInlineDiff(originalText: string, newText: string, cursor: EditorPosition) {
		// Create markdown-formatted diff preview
		const diffPreview = `~~${originalText}~~\n<div style="background-color: #e6ffe6">${newText}</div>`;

		// Store original text for restoration
		const originalSelection = this.editor.getSelection();

		// Replace the selection with the diff preview
		this.editor.replaceSelection(diffPreview);

		// Add floating controls
		this.showFloatingControls(
			cursor,
			() => {
				// Restore original text on cancel
				this.editor.replaceRange(
					originalSelection,
					{
						line: cursor.line,
						ch: cursor.ch,
					},
					{
						line: cursor.line + 2, // +2 because we added two lines
						ch: this.editor.getLine(cursor.line + 2).length,
					},
				);
			},
			() => {
				// Apply new text on accept
				this.editor.replaceRange(
					newText,
					{
						line: cursor.line,
						ch: cursor.ch,
					},
					{
						line: cursor.line + 2,
						ch: this.editor.getLine(cursor.line + 2).length,
					},
				);
			},
		);
	}

	private showFloatingControls(
		cursor: EditorPosition,
		onCancel: () => void,
		onAccept: () => void,
	) {
		const controlsEl = document.createElement('div');
		controlsEl.addClass('inline-diff-controls');

		const acceptBtn = controlsEl.createEl('button', { text: '✓ Accept' });
		const cancelBtn = controlsEl.createEl('button', { text: '✗ Cancel' });

		acceptBtn.onclick = () => {
			onAccept();
			controlsEl.remove();
		};

		cancelBtn.onclick = () => {
			onCancel();
			controlsEl.remove();
		};

		// Position controls near the cursor
		// const coords = this.editor.coordsAtPos(this.editor.posToOffset(cursor));
		// if (coords) {
		// 	controlsEl.style.position = 'absolute';
		// 	controlsEl.style.left = `${coords.left}px`;
		// 	controlsEl.style.top = `${coords.top + 20}px`; // 20px below cursor
		// }

		// document.body.appendChild(controlsEl);
	}

	private showDiffModal(originalText: string, options: string[]) {
		const diffModal = new DiffModal(
			this.app,
			originalText,
			options,
			(selectedOption: string) => {
				this.editor.replaceSelection(selectedOption);
			},
		);
		diffModal.open();
	}

	private handleCustomInput() {
		if (this.currentInput) {
			const selectedText = this.editor.getSelection();
			new Notice(`Custom transform: "${this.currentInput}" on "${selectedText}"`);
			// Handle the custom input here
			this.close();
		}
	}
}

class DiffModal extends Modal {
	private originalText: string;
	private options: string[];
	private onSelect: (selected: string) => void;

	constructor(
		app: App,
		originalText: string,
		options: string[],
		onSelect: (selected: string) => void,
	) {
		super(app);
		this.originalText = originalText;
		this.options = options;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add original text
		contentEl.createEl('div', { text: 'Original:', cls: 'diff-label' });
		contentEl.createEl('pre', { text: this.originalText, cls: 'diff-original' });

		// Add options
		this.options.forEach((option, index) => {
			contentEl.createEl('div', { text: `Option ${index + 1}:`, cls: 'diff-label' });
			const optionDiv = contentEl.createEl('pre', { text: option, cls: 'diff-option' });

			const selectButton = contentEl.createEl('button', { text: 'Select' });
			selectButton.onclick = () => {
				this.onSelect(option);
				this.close();
			};
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
