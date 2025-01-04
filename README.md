# Cerebro - Obsidian-first, AI-powered second brain that thinks with you

Cerebro is an Obsidian-first LLM integration that transforms your vault into an intelligent workspace. Chat with AI from any note, process PDFs, analyze images, and fetch web content - all while maintaining Obsidian's philosophy of plain text files and local-first data. Whether you're coding, researching, or writing, Cerebro works naturally with your existing workflow, turning your second brain into an active thinking partner.

## Key Features
- 💭 Chat intuitively: open a conversation in the sidebar or in your main view.
- 🎯 Powerful features: Attach an image, pdf, even other notes using Obsidian's native linking.
- 📝 [File-over-app](https://stephango.com/file-over-app): Uses pure Markdown. All responses render natively.
- 🔧 Powerful templating system for repeatable interactions
- ⚡️ Real-time streaming responses for natural conversation flow
- 🛠️ Highly configurable through familiar frontmatter syntax

## Installation

### Community Plugins
[COMING SOON] Go to Community Plugins and search `Cerebro`

### Local
1. Clone this repo into your `plugins` directory in your vault
2. Run `npm i` and `npm run build`

### Both
1. Insert your API keys from OpenAI or Anthropic into the settings
2. Set `Chat Folder` and `Chat Template Folder`
3. Recommended: Add a hotkey for `Chat`

## Commands

#### Chat (Cmd/Ctrl + I recommended)
Start an AI conversation from any note or selection. Core command for interacting with your chosen LLM.

#### Create Chat Tools
- **New Chat**: Convert highlighted text into a new chat file
- **From Template**: Create chat from your custom templates
- **Add Divider**: Quick add `role::user` with HR divider
- **Clear Chat**: Reset chat while preserving settings

#### Smart Features
- **Infer Title**: Auto-generate chat titles from context
- **Comment Blocks**: Add notes/links that won't process through AI
  ```
  =begin-chatgpt-md-comment
  Your notes here...
  =end-chatgpt-md-comment
  ```
- **Stop Stream**: Cancel ongoing AI response (desktop only)

## Roadmap
- Whiteboard mode: Edit a main note with Cerebro.
- Better undo/stop flows in conversations
- Rolodex view: Show an outline of your conversation with Cerebro
