import { App, PluginSettingTab, Setting, debounce } from 'obsidian';
import type VaultWebsiteViewPlugin from './main';

export interface VaultWebsiteSettings {
	theme: string;
	showGraph: boolean;
	showTOC: boolean;
	showBacklinks: boolean;
	excludedFolders: string;
}

export const DEFAULT_SETTINGS: VaultWebsiteSettings = {
	theme: 'glassmorphism',
	showGraph: true,
	showTOC: true,
	showBacklinks: true,
	excludedFolders: ''
};

export const THEMES: Record<string, string> = {
	'glassmorphism': 'Glassmorphism (Dark)',
	'nord': 'Nord Dark',
	'minimal-light': 'Minimalist Ink (Light)',
	'cyberpunk': 'Cyberpunk Neon (Dark)',
	'dracula': 'Dracula Pro (Dark)',
	'onedark': 'One Dark Pro (Atom)',
	'gruvbox': 'Gruvbox Retro (Dark)',
	'monokai': 'Monokai Pro (Dark)',
	'solarized-dark': 'Solarized Dark',
	'solarized-light': 'Solarized Light',
	'nightowl': 'Night Owl (Dark)',
	'catppuccin-mocha': 'Catppuccin Mocha (Dark)',
	'catppuccin-latte': 'Catppuccin Latte (Light)',
	'bear-dark': 'Bear Red Graphite (Dark)',
	'notion-light': 'Notion (Light)',
	'hotdog-stand': 'Windows Hotdog Stand (Retro)'
};

export class VaultWebsiteSettingTab extends PluginSettingTab {
	plugin: VaultWebsiteViewPlugin;

	constructor(app: App, plugin: VaultWebsiteViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		(new Setting(containerEl) as any).setName('Vault Website View Settings').setHeading();

		new Setting(containerEl)
			.setName('Website Theme')
			.setDesc('Choose the theme for the website view.')
			.addDropdown(dropdown => {
				for (const [id, label] of Object.entries(THEMES)) {
					dropdown.addOption(id, label);
				}
				dropdown
					.setValue(this.plugin.settings.theme)
					.onChange(async (value) => {
						this.plugin.settings.theme = value;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
			});

		new Setting(containerEl)
			.setName('Show Mini-Graph')
			.setDesc('Display an interactive local link graph of the active note.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showGraph)
				.onChange(async (value) => {
					this.plugin.settings.showGraph = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		new Setting(containerEl)
			.setName('Show Table of Contents')
			.setDesc('Display the note outline / table of contents in the right sidebar.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTOC)
				.onChange(async (value) => {
					this.plugin.settings.showTOC = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		new Setting(containerEl)
			.setName('Show Backlinks')
			.setDesc('Display incoming links to the active note.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showBacklinks)
				.onChange(async (value) => {
					this.plugin.settings.showBacklinks = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		const debouncedSave = debounce(async (value: string) => {
			this.plugin.settings.excludedFolders = value;
			await this.plugin.saveSettings();
			this.plugin.refreshViews();
		}, 500);

		new Setting(containerEl)
			.setName('Excluded Folders')
			.setDesc('Comma-separated list of folder names to exclude from navigation (e.g. templates, archive).')
			.addText(text => text
				.setPlaceholder('templates, archive')
				.setValue(this.plugin.settings.excludedFolders)
				.onChange((value) => {
					debouncedSave(value);
				}));
	}
}

