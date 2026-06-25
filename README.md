# Obsidian Vault Website View

Transform your Obsidian vault into a stunning, fully-functional website preview right inside your editor! This plugin renders your markdown notes as a beautifully styled website, complete with a file explorer, table of contents, backlinks, and an interactive local graph.

## Features

- **Gorgeous Themes**: Choose from 16 premium, built-in themes including Glassmorphism, Catppuccin, Nord, Cyberpunk, and even a retro Windows 3.1 Hotdog Stand theme.
- **Interactive File Explorer**: Navigate your entire vault with an expandable/collapsible sidebar just like a real documentation website.
- **Lightning-fast Search**: Find notes instantly with a native Obsidian modal search that supports both title and full-text matching.
- **Dynamic Context**: The right sidebar automatically displays the active note's Table of Contents, Backlinks, and an interactive Local Graph. 
- **Live Updates**: As you edit your vault, the website view reacts in real-time. Modifying notes updates their backlinks and graph connections instantly.
- **Folder Exclusions**: Hide private or template folders from the website view to simulate a published site perfectly.

## Installation

1. Create a folder named `obsidian-vault-website-view` inside your vault's `.obsidian/plugins/` directory.
2. Download the latest release from the [Releases page](https://github.com/Real-Fruit-Snacks/obsidian-vault-website-view/releases) and extract `main.js`, `manifest.json`, and `styles.css` into that folder.
3. Reload Obsidian.
4. Go to **Settings > Community plugins**, find "Vault Website View", and enable it.

## Usage

Once enabled, you can open the Website View by clicking the globe icon (🌐) in your left ribbon, or by using the command palette: `Open Website Preview`.

### Shortcuts
- `Cmd/Ctrl + K` while inside the view: Open the quick search modal.

## Customization

Go to the plugin settings to change the active theme, toggle the local graph, toggle the table of contents, or specify folders you want excluded from the website navigation.

## Development

To build the plugin locally:
```bash
npm install
npm run build
```

To run the test suite:
```bash
npm run test
```

## License

MIT License
