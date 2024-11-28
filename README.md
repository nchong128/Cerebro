# Cerebro - AI-powered second brain for your Obsidian vault.

## Key Features

-   Chat from _any_ MD note
-   Create Chat _Templates_ for sharing and running similar scenarios.
-   As _minimal boilerplate as possible_, only two required in fact!
-   Use _frontmatter_ to change variables for the LLM.
-   _Stream_ characters to Obsidian, creating a realtime feel.
-   Uses _regular Markdown_. Meaning everything from _lists_ to _code blocks_ from ChatGPT _will render_!
-   Create chats from _highlighted text_.
-   [_Infer title_ from messages](https://github.com/bramses/chatgpt-md/discussions/11). Can be set to run automatically after >4 messages.
-   Stream at cursor position or at end of file. Can be set in settings.
-   Choose [heading level for role](https://github.com/bramses/chatgpt-md/pull/22) h1-h6. Can be set in settings.
-   Custom endpoints can be specified using the url parameter in your front matter. See FAQ for an example.
-   Stop a running stream with a command. See commands section below.
-   (NEW!) Choose between nine languages for "Infer Title". Can be set in settings.
-   (NEW!) ChatGPT comment blocks. Allows you to leave scratchpad notes, backlinks...or anything else really!! See command below for details.

## Installation

### Community Plugins

[COMING SOON] Go to Community Plugins and search `Cerebro`

### Local

1. Clone this repo into your `plugins` directory in your vault
2. Run `npm i` and `npm run build`

### Both

1. Insert your API keys from OpenAI or Anthropic into the settings
2. Set `Chat Folder` and `Chat Template Folder`
3. Add a hotkey for `Chat`



## Commands

#### Chat

The main command! Parses the file and calls an LLM provider of your choice. Recommended to add to a hotkey for easy usage.

#### Create new chat

Takes the currently highlighted text and default frontmatter and creates a new chat file in your `Chat` folder. 

#### Create New Chat From Template

Create a new chat file from a template specified in your `Chat Template Folder`.

#### Infer title

[Infer the title of the chat from the messages](https://github.com/bramses/chatgpt-md/discussions/11). Requires at least 2 messages. Can be set in settings to run automatically after >4 messages.

#### Add comment block

Add a comment block to the editor that will not be processed by ChatGPT. Allows you to leave scratchpad notes, backlinks...or anything else really!

Comments begin with `=begin-chatgpt-md-comment` and end with `=end-chatgpt-md-comment`

![Screenshot 2023-04-03 16-47-05](https://user-images.githubusercontent.com/3282661/229628591-eda70076-9e03-44e3-98b5-16be73f39957.png)
![Screenshot 2023-04-03 16-59-26](https://user-images.githubusercontent.com/3282661/229628629-2fc9ec19-7cce-4754-9c09-11f2364395e5.png)

#### Clear chat

Removes all messages but leaves frontmatter

#### Stop streaming (Does not work on mobile)

Stops the stream. Useful if you want to stop the stream if you don't like where ChatGPT is heading/going too long.

#### Add divider

Add a ChatGPT MD Horizontal Rule and `role::user`.



## FAQ

### Q: The chat seems to be getting cut off halfway through

To address this, first try to increase your `max_tokens` (default is set to 300). You may also want to update it more permanently in the default frontmatter settings. See pics below:

![Screenshot 2023-03-12 16-14-35](https://user-images.githubusercontent.com/3282661/224571118-080ca393-6f94-4a20-ba98-27bc8b8b6ad2.png)
![Screenshot 2023-03-12 16-15-01](https://user-images.githubusercontent.com/3282661/224571119-cba1be45-3ab1-4b86-b056-ba596bacd918.png)

### Q: Code Blocks cut off halfway through and leave \`\`\`

The Obsidian editor renders backticks in automatically (see [issue](https://github.com/bramses/chatgpt-md/issues/15#issuecomment-1466813500)) and fires extra logic that causes the stream to add extra backticks. To address this, you can:

1. at the end of the code block add \`\`\` (three backticks) to close the code block BEFORE the `<hr>` and delete the three extra Obsidian added automatically.
2. in `role::user` write "keep going"

See pics below:

![Screenshot 2023-03-15 18-47-40](https://user-images.githubusercontent.com/3282661/225460844-54101bf2-d5ac-4725-95b5-c79bf6b6ed6a.png)
![Screenshot 2023-03-15 18-48-30](https://user-images.githubusercontent.com/3282661/225460845-6ff12c98-ea74-4ae8-bc2d-4161e89acdda.png)

