import ChatInterface from 'lib/chatInterface';
import { ChatFrontmatter, Message } from 'lib/types';

export interface LLMClient {
	inferTitle(messages: Message[], inferTitleLanguage: string): Promise<string>;
	chat(
		messages: Message[],
		frontmatter: ChatFrontmatter,
		chatInterface: ChatInterface,
	): Promise<Message>;
}
