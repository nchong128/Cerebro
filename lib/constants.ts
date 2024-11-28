export const PLUGIN_NAME = 'Cerebro';

export const YAML_FRONTMATTER_REGEX = /---\s*[\s\S]*?\s*---/g;

export const ERROR_NOTICE_TIMEOUT_MILLISECONDS = 10000;

export const CerebroBaseSystemPrompts = ['Your name is Cerebro.'];

// Cerebro plugin messages
export enum CerebroMessages {
	CALLING_API = '[Cerebro] Calling API',
	INFER_TITLE_MESSAGE_TOO_SHORT_FAILURE = 'Not enough messages to infer title. Minimum 2 messages.',
	INFER_TITLE_UNKNOWN_FAILURE = 'Title unable to be inferred',
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
