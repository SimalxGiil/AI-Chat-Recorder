# AI Chat Recorder

A Chrome extension that captures a chat from any AI website and exports it as a Markdown file, so you can hand the full context to a different AI.

Switching from one assistant to another usually means losing the thread. This tool records the conversation you are having, optionally adds a short hand-off prompt, and gives you a single file (or clipboard text) you can paste into the next AI.

## Features

- One-click capture of the chat in the current tab
- Built-in support for ChatGPT, Claude and Gemini
- Generic fallback for any other site (page text, or just the text you select)
- Stack several conversations into one file
- Code blocks, lists, links and tables are preserved as Markdown
- Optional hand-off instructions telling the next AI how to use the transcript
- Edit the result before copying or downloading
- Everything stays in your browser; nothing is sent anywhere

## Install

The extension is not on the Chrome Web Store, so you load it manually:

1. Download this repository (**Code → Download ZIP**) and unzip it, or clone it with git.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Optional: pin the extension from the puzzle-piece menu in the toolbar.

## Usage

1. Open a chat. For long chats, scroll to the top first so every message is loaded.
2. Click the extension icon, then **Capture this tab's chat**.
3. Repeat on other tabs to add more conversations.
4. Click **Copy** or **Download .md**, then paste or attach the result in the next AI.

To capture only part of a page, select the text you want before clicking Capture.

## Supported sites

| Site | Capture mode |
| --- | --- |
| ChatGPT (chatgpt.com) | Per-message, with roles |
| Claude (claude.ai) | Per-message, with roles |
| Gemini (gemini.google.com) | Per-message, with roles |
| Anything else | Generic page text, or your selection |

## How it works

- `manifest.json` declares a Manifest V3 extension with a popup.
- `popup.html` is the interface.
- `popup.js` injects an extraction function into the active tab, converts the chat to Markdown, stores captures in `chrome.storage.local`, and handles copy and download.

Site layouts change over time. If a supported site stops capturing correctly, update its selectors in `extractChat()` in `popup.js`. Adding a new site means adding one more branch there.

## Privacy

Captured chats are kept in your browser's local extension storage and are only copied or downloaded when you ask. The extension makes no network requests.

## License

MIT, see [LICENSE](LICENSE).
