export const PLUGIN_NAME = 'Cerebro';

export const YAML_FRONTMATTER_REGEX = /^---\s*[\s\S]*?\s*---/g;

export const ERROR_NOTICE_TIMEOUT_MILLISECONDS = 10000;

export const CerebroBaseSystemPrompts = [
	'Your name is Cerebro.',
	`When processing messages, you'll receive documents in a graph-like structure:

	1. Each document is assigned a unique identifier like [Doc 1], [Image 2], [PDF 3]
	2. Document contents are presented first, each prefixed with their identifier
	3. At the end, you'll see "Document relationships" showing all documents involved

	For example:
	[Doc 1] example.md
	(content of example.md)

	[Doc 2] nested.md
	(content of nested.md)

	Document relationships:
	[Doc 1] example.md
	[Doc 2] nested.md

	When referencing documents in your responses, please use their identifiers ([Doc 1], etc.) in round brackets for clarity. You can understand this as a graph where documents are nodes and relationships show how they're connected in the user's knowledge base.
	`,
];

// Cerebro plugin messages
export enum CerebroMessages {
	CALLING_API = '[Cerebro] Calling API',
	INFER_TITLE_MESSAGE_TOO_SHORT_FAILURE = 'Not enough messages to infer title. Minimum 2 messages.',
	INFER_TITLE_UNKNOWN_FAILURE = 'Title unable to be inferred',
	UPDATING_PROPERTIES = '[Cerebro] Upating properties',
	EMPTY = '',
}

export const userHeader = (username: string, headingLevel: number): string => {
	return `<h${headingLevel} class="${CSSAssets.HEADER}">${username}:</h${headingLevel}>`;
};

export const assistantHeader = (assistantName: string, headingLevel: number): string => {
	return `<h${headingLevel} class="${CSSAssets.HEADER}">${assistantName}:</h${headingLevel}>`;
};

export enum CSSAssets {
	HR = '__crb-hr',
	HEADER = '__crb-header',
}
