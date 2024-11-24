export const PLUGIN_NAME = 'Cerebro';

export const YAML_FRONTMATTER_REGEX = /---\s*[\s\S]*?\s*---/g;

// Prompts

// System messages
export enum CerebroMessages {
    INFER_TITLE_MESSAGE_TOO_SHORT_FAILURE = 'Not enough messages to infer title. Minimum 2 messages.';
    INFER_TITLE_UNKNOWN_FAILURE = 'Title unable to be inferred';
}
