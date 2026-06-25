/* eslint-disable */
import { Plugin, WorkspaceLeaf, TFile } from 'obsidian';
import { VaultWebsiteView, VIEW_TYPE_VAULT_WEBSITE } from './view';
import { VaultWebsiteSettings, DEFAULT_SETTINGS, VaultWebsiteSettingTab } from './settings';

export default class VaultWebsiteViewPlugin extends Plugin {
	settings!: VaultWebsiteSettings;

	async onload() {
		await this.loadSettings();

		// Register the view
		this.registerView(
			VIEW_TYPE_VAULT_WEBSITE,
			(leaf: WorkspaceLeaf) => new VaultWebsiteView(leaf, this)
		);

		// Add Ribbon Icon
		this.addRibbonIcon('globe', 'Open Vault Website Preview', () => {
			void this.activateView();
		});

		// Add Command
		this.addCommand({
			id: 'open-vault-website-preview',
			name: 'Open Website Preview',
			callback: () => { void this.activateView(); },
		});

		// Add Settings Tab
		this.addSettingTab(new VaultWebsiteSettingTab(this.app, this));

		// Register vault event listeners to update our view automatically
		this.registerEvent(
			this.app.vault.on('create', () => this.refreshViews(false))
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.refreshViews(false))
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.refreshViews(false))
		);
		this.registerEvent(
			this.app.metadataCache.on('changed', (file: TFile) => {
				// Re-render so backlinks and graph update if a related file is modified
				this.refreshViews(true);
			})
		);

		// Refresh once workspace layout is fully loaded
		this.app.workspace.onLayoutReady(() => {
			this.refreshViews(false);
		});

		// Refresh when vault indexing completes (resolves startup partial load issues)
		this.registerEvent(
			this.app.metadataCache.on('resolved', () => {
				this.refreshViews(false);
			})
		);
	}

	async onunload() {
		// Don't detach leaves in onunload, as that will reset the leaf to it's default location when the plugin is loaded
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_VAULT_WEBSITE)[0];

		if (!leaf) {
			// Try to open it in a nice side split or new tab
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({ type: VIEW_TYPE_VAULT_WEBSITE, active: true });
		}

		workspace.revealLeaf(leaf);
	}

	refreshViews(contentOnly = false) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_VAULT_WEBSITE);
		for (const leaf of leaves) {
			if (leaf.view instanceof VaultWebsiteView) {
				if (contentOnly) {
					void leaf.view.updateActiveFileContent();
				} else {
					leaf.view.renderAll();
				}
			}
		}
	}
}
