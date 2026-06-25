import { App, ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, setIcon, Modal } from 'obsidian';
import type VaultWebsiteViewPlugin from './main';
import { THEMES } from './settings';

export const VIEW_TYPE_VAULT_WEBSITE = 'vault-website-view';

interface TreeFolder {
	name: string;
	path: string;
	folders: Map<string, TreeFolder>;
	files: TFile[];
}

interface BacklinksMap {
	data: Record<string, unknown>;
}

export class VaultWebsiteView extends ItemView {
	plugin: VaultWebsiteViewPlugin;
	currentFile: TFile | null = null;
	searchQuery = '';
	expandedFolders: Set<string> = new Set();
	sidebarCollapsed = false;
	activeSearchModal: SearchModal | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: VaultWebsiteViewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_VAULT_WEBSITE;
	}

	getDisplayText(): string {
		return 'Vault Website';
	}

	getIcon(): string {
		return 'globe';
	}

	async onOpen() {
		// Set up default file if none selected
		if (!this.currentFile) {
			this.currentFile = this.getDefaultFile();
		}
		this.expandToActiveFile();
		void this.renderAll();

		// Register Spotlight Search shortcut (Ctrl/Cmd + K)
		const targetWindow = this.containerEl.ownerDocument.defaultView || window;
		this.registerDomEvent(targetWindow, 'keydown', (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				if (this.app.workspace.getActiveViewOfType(VaultWebsiteView) === this) {
					e.preventDefault();
					this.openSearchModal();
				}
			}
		});
	}

	async onClose() {
		if (this.activeSearchModal) {
			this.activeSearchModal.close();
			this.activeSearchModal = null;
		}
		this.contentEl.empty();
	}

	getDefaultFile(): TFile | null {
		const files = this.app.vault.getMarkdownFiles();
		if (files.length === 0) return null;

		// Prefer Home.md or index.md if they exist
		const homeFile = files.find(f => 
			f.basename.toLowerCase() === 'home' || 
			f.basename.toLowerCase() === 'index'
		);
		return homeFile || files[0] || null;
	}

	expandToActiveFile() {
		if (!this.currentFile) return;
		const parts = this.currentFile.path.split('/');
		parts.pop(); // remove filename
		let currentPath = '';
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			this.expandedFolders.add(currentPath);
		}
	}

	renderAll() {
		const container = this.contentEl;
		container.empty();

		// Apply the active theme class to the container
		container.className = `workspace-leaf-content vault-website-container theme-${this.plugin.settings.theme}`;
		if (this.sidebarCollapsed) {
			container.classList.add('sidebar-collapsed');
		}

		// Create Header Bar
		const headerBar = container.createEl('div', { cls: 'web-header-bar' });
		this.renderHeaderBar(headerBar);

		// Create Main Grid Layout
		const gridLayout = container.createEl('div', { cls: 'web-grid-layout' });

		// Sidebar Container
		const sidebar = gridLayout.createEl('aside', { cls: 'web-sidebar' });
		this.renderSidebar(sidebar);

		// Main Content Container
		const contentWrapper = gridLayout.createEl('main', { cls: 'web-content-wrapper' });
		const contentArea = contentWrapper.createEl('article', { cls: 'web-content-area' });
		void this.renderContentArea(contentArea);

		// Right Sidebar (TOC, Backlinks, Graph)
		const rightSidebar = gridLayout.createEl('aside', { cls: 'web-right-sidebar' });
		this.renderRightSidebar(rightSidebar);
	}

	async updateActiveFileContent() {
		// Update only the active portions to avoid re-rendering the sidebar
		this.expandToActiveFile();
		const container = this.contentEl;
		
		// Update theme class in case it changed
		container.className = `workspace-leaf-content vault-website-container theme-${this.plugin.settings.theme}`;
		if (this.sidebarCollapsed) {
			container.classList.add('sidebar-collapsed');
		}

		// Update selection/expansion in file tree without rebuilding DOM
		this.updateFileTreeSelection();

		// Re-render content area
		const contentArea = container.querySelector('.web-content-area');
		if (contentArea) {
			contentArea.empty();
			await void this.renderContentArea(contentArea as HTMLElement);
		}

		// Re-render right sidebar
		const rightSidebar = container.querySelector('.web-right-sidebar');
		if (rightSidebar) {
			rightSidebar.empty();
			this.renderRightSidebar(rightSidebar as HTMLElement);
		}
	}

	updateFileTreeSelection() {
		if (!this.currentFile) return;
		const container = this.contentEl;

		// 1. Toggle is-active class on file elements
		const fileEls = container.querySelectorAll('.web-sidebar-file');
		fileEls.forEach(el => {
			const path = el.getAttribute('data-path');
			if (path === this.currentFile?.path) {
				el.addClass('is-active');
			} else {
				el.removeClass('is-active');
			}
		});

		// 2. Expand all ancestor folders
		const parts = this.currentFile.path.split('/');
		parts.pop(); // remove filename
		let currentPath = '';
		const ancestorPaths = new Set<string>();
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			ancestorPaths.add(currentPath);
			this.expandedFolders.add(currentPath);
		}

		// Update folder expansion state in DOM
		const folderEls = container.querySelectorAll('.web-sidebar-folder');
		folderEls.forEach(el => {
			const folderPath = el.getAttribute('data-path');
			if (folderPath && ancestorPaths.has(folderPath)) {
				// Expand
				const folderChildren = el.querySelector('.web-sidebar-folder-children') as HTMLElement;
				if (folderChildren) {
					folderChildren.removeClass('is-collapsed');
				}
				const chevSpan = el.querySelector('.web-sidebar-icon') as HTMLElement;
				if (chevSpan) {
					setIcon(chevSpan, 'chevron-down');
				}
			}
		});
	}

	renderHeaderBar(parent: HTMLElement) {
		// Left group containing toggle button and brand
		const leftGroup = parent.createEl('div', { cls: 'web-header-left' });

		// Hamburger toggle
		const toggleBtn = leftGroup.createEl('button', { cls: 'web-sidebar-toggle', attr: { 'aria-label': 'Toggle Sidebar' } });
		setIcon(toggleBtn, 'columns');
		toggleBtn.addEventListener('click', () => {
			this.sidebarCollapsed = !this.sidebarCollapsed;
			this.contentEl.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
		});

		// Logo / Brand
		const brand = leftGroup.createEl('div', { cls: 'web-brand' });
		const logoIcon = brand.createEl('span', { cls: 'web-logo-icon' });
		setIcon(logoIcon, 'globe');
		brand.createEl('span', { text: this.app.vault.getName() + ' Web', cls: 'web-brand-title' });

		// Theme selector
		const themeIndicator = parent.createEl('div', { cls: 'web-theme-selector-container' });
		const themeSelect = themeIndicator.createEl('select', { cls: 'web-theme-select', attr: { 'aria-label': 'Select Theme' } });
		
		for (const [theme, label] of Object.entries(THEMES)) {
			const option = themeSelect.createEl('option', { value: theme, text: label });
			if (theme === this.plugin.settings.theme) {
				(option as HTMLOptionElement).selected = true;
			}
		}

		themeSelect.addEventListener('change', (e: Event) => {
			const target = e.target as HTMLSelectElement;
			this.plugin.settings.theme = target.value;
			void this.plugin.saveSettings();
			this.plugin.refreshViews();
		});
	}

	renderSidebar(parent: HTMLElement) {
		// Spotlight Search Button
		const searchContainer = parent.createEl('div', { cls: 'web-search-container' });
		const searchBtn = searchContainer.createEl('div', { 
			cls: 'web-search-button', 
			attr: { 'role': 'button', 'tabindex': '0', 'aria-label': 'Search notes' } 
		});
		const searchIcon = searchBtn.createEl('span', { cls: 'web-search-btn-icon' });
		setIcon(searchIcon, 'search');
		searchBtn.createEl('span', { text: 'Search notes...', cls: 'web-search-btn-text' });
		searchBtn.createEl('span', { text: '⌘K', cls: 'web-search-btn-key' });

		searchBtn.addEventListener('click', () => {
			this.openSearchModal();
		});

		// File Tree Container
		const fileTreeContainer = parent.createEl('div', { cls: 'web-file-tree' });
		this.renderFileTree(fileTreeContainer);
	}

	renderFileTree(parent: HTMLElement) {
		parent.empty();
		const files = this.app.vault.getMarkdownFiles();

		// Parse settings exclusions safely
		const excluded = (this.plugin.settings.excludedFolders || '')
			.split(',')
			.map(s => s.trim().toLowerCase())
			.filter(s => s.length > 0);

		// Build Folder tree hierarchy
		const rootFolder: TreeFolder = {
			name: 'root',
			path: '',
			folders: new Map(),
			files: []
		};

		const filteredFiles = files.filter(file => {
			const lowerPathSegments = file.path.toLowerCase().split('/');
			const folderSegments = lowerPathSegments.slice(0, -1);
			return !excluded.some(ex => folderSegments.includes(ex));
		});

		for (const file of filteredFiles) {
			const parts = file.path.split('/');
			parts.pop();
			
			let current = rootFolder;
			for (const part of parts) {
				if (!current.folders.has(part)) {
					current.folders.set(part, {
						name: part,
						path: current.path ? `${current.path}/${part}` : part,
						folders: new Map(),
						files: []
					});
				}
				current = current.folders.get(part)!;
			}
			current.files.push(file);
		}

		// Helper to recursively render folders
		const renderTreeFolder = (folder: TreeFolder, el: HTMLElement, depth = 0) => {
			// Sort folder keys alphabetically
			const sortedFolders = Array.from(folder.folders.keys()).sort();
			for (const fKey of sortedFolders) {
				const subfolder = folder.folders.get(fKey)!;
				
				// Apply search filtering on subfolder content
				if (this.searchQuery && !this.folderMatchesSearch(subfolder)) {
					continue;
				}

				const folderPath = subfolder.path;
				const isExpanded = this.expandedFolders.has(folderPath) || !!this.searchQuery;
				const isCollapsed = !isExpanded;

				const folderEl = el.createEl('div', {
					cls: 'web-sidebar-folder',
					attr: { 'data-path': folderPath }
				});
				folderEl.style.paddingLeft = `${depth * 10}px`;

				const folderHeader = folderEl.createEl('div', { cls: 'web-sidebar-folder-header' });
				
				const chevSpan = folderHeader.createEl('span', { cls: 'web-sidebar-icon' });
				setIcon(chevSpan, isCollapsed ? 'chevron-right' : 'chevron-down');

				const folderSpan = folderHeader.createEl('span', { cls: 'web-sidebar-icon folder-icon' });
				setIcon(folderSpan, 'folder');

				folderHeader.createEl('span', { text: subfolder.name, cls: 'web-sidebar-folder-title' });

				const folderChildren = folderEl.createEl('div', { cls: 'web-sidebar-folder-children' });
				if (isCollapsed) {
					folderChildren.addClass('is-collapsed');
				}

				folderHeader.addEventListener('click', (e: Event) => {
					e.stopPropagation();
					const isNowExpanded = !this.expandedFolders.has(folderPath);
					if (isNowExpanded) {
						this.expandedFolders.add(folderPath);
						folderChildren.removeClass('is-collapsed');
						setIcon(chevSpan, 'chevron-down');
					} else {
						this.expandedFolders.delete(folderPath);
						folderChildren.addClass('is-collapsed');
						setIcon(chevSpan, 'chevron-right');
					}
				});

				renderTreeFolder(subfolder, folderChildren, depth + 1);
			}

			// Sort files alphabetically
			const sortedFiles = folder.files.sort((a, b) => a.basename.localeCompare(b.basename));
			for (const file of sortedFiles) {
				if (this.searchQuery && !file.basename.toLowerCase().includes(this.searchQuery)) {
					continue;
				}

				const fileEl = el.createEl('div', {
					cls: `web-sidebar-file ${this.currentFile?.path === file.path ? 'is-active' : ''}`,
					attr: { 'data-path': file.path }
				});
				fileEl.style.paddingLeft = `${(depth * 10) + 15}px`;

				const fileIcon = fileEl.createEl('span', { cls: 'web-sidebar-icon' });
				setIcon(fileIcon, 'file');

				fileEl.createEl('span', { text: file.basename, cls: 'web-sidebar-file-title' });

				fileEl.addEventListener('click', () => {
					this.currentFile = file;
					void this.updateActiveFileContent();
				});
			}
		};

		renderTreeFolder(rootFolder, parent);
	}

	folderMatchesSearch(folder: TreeFolder): boolean {
		// Checks recursively if any subfiles or subfolders contain search query
		const q = this.searchQuery.toLowerCase();
		
		const fileMatch = folder.files.some(f => f.basename.toLowerCase().includes(q));
		if (fileMatch) return true;

		for (const sub of folder.folders.values()) {
			if (this.folderMatchesSearch(sub)) return true;
		}

		return false;
	}

	async renderContentArea(parent: HTMLElement) {
		const file = this.currentFile;
		if (!file) {
			const emptyState = parent.createEl('div', { cls: 'web-empty-state' });
			emptyState.createEl('h2', { text: 'Welcome to your vault website!' });
			emptyState.createEl('p', { text: 'Create or select a markdown note from the sidebar to view it here.' });
			return;
		}

		// Breadcrumbs
		const breadcrumbs = parent.createEl('div', { cls: 'web-breadcrumbs' });
		const parts = file.path.split('/');
		parts.pop(); // remove filename
		if (parts.length === 0) {
			breadcrumbs.createEl('span', { text: 'Vault Root', cls: 'breadcrumb-item' });
		} else {
			parts.forEach((part, idx) => {
				breadcrumbs.createEl('span', { text: part, cls: 'breadcrumb-item' });
				if (idx < parts.length - 1) {
					const sep = breadcrumbs.createEl('span', { cls: 'breadcrumb-separator' });
					setIcon(sep, 'chevron-right');
				}
			});
		}

		// Title and Actions Header
		const noteHeader = parent.createEl('header', { cls: 'web-note-header' });
		noteHeader.createEl('h1', { text: file.basename, cls: 'web-note-title' });

		const actions = noteHeader.createEl('div', { cls: 'web-note-actions' });
		
		// Button: Open in Editor
		const editBtn = actions.createEl('button', { cls: 'web-action-btn', attr: { 'aria-label': 'Open in native editor' } });
		setIcon(editBtn, 'edit-3');
		editBtn.createEl('span', { text: 'Edit', cls: 'btn-text' });
		editBtn.addEventListener('click', () => {
			const leaf = this.app.workspace.getLeaf('tab');
			void leaf.openFile(file);
		});

		// Button: Copy Link
		const copyBtn = actions.createEl('button', { cls: 'web-action-btn', attr: { 'aria-label': 'Copy note path' } });
		setIcon(copyBtn, 'link');
		copyBtn.createEl('span', { text: 'Link', cls: 'btn-text' });
		copyBtn.addEventListener('click', () => {
			void navigator.clipboard.writeText(file.path);
			copyBtn.addClass('is-success');
			const label = copyBtn.querySelector('.btn-text');
			if (label) label.textContent = 'Copied!';
			window.setTimeout(() => {
				copyBtn.removeClass('is-success');
				if (label) label.textContent = 'Link';
			}, 1500);
		});

		// Render the actual markdown
		const markdownBody = parent.createEl('section', { cls: 'web-markdown-body markdown-rendered' });
		
		try {
			const fileContent = await this.app.vault.cachedRead(file);
			await MarkdownRenderer.render(
				this.app,
				fileContent,
				markdownBody,
				file.path,
				this
			);
		} catch (_err) {
			markdownBody.createEl('div', { text: `Error rendering note: ${_err}`, cls: 'web-render-error' });
		}

		// Intercept clicks on links inside the rendered markdown to keep them inside our website view!
		markdownBody.addEventListener('click', (e: Event) => {
			void (async () => {
			const target = e.target as HTMLElement;
			const internalLink = target.closest('a.internal-link');
			if (internalLink) {
				e.preventDefault();
				e.stopPropagation();
				const href = internalLink.getAttribute('data-href') || internalLink.getAttribute('href');
				if (href) {
					const hashIdx = href.indexOf('#');
					const linkpath = hashIdx === -1 ? href : href.substring(0, hashIdx);
					const anchor = hashIdx === -1 ? '' : href.substring(hashIdx + 1);

					if (linkpath === '' && anchor) {
						// Link to heading in the current file
						const contentArea = this.contentEl.querySelector('.web-content-area');
						if (contentArea) {
							const decodedAnchor = decodeURIComponent(anchor).toLowerCase().replace(/[\s_]+/g, ' ');
							const headers = Array.from(contentArea.querySelectorAll('h1, h2, h3, h4, h5, h6'));
							const matchingEl = headers.find(el => {
								const text = el.textContent?.trim().toLowerCase().replace(/[\s_]+/g, ' ') || '';
								return text === decodedAnchor;
							});
							if (matchingEl) {
								matchingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
							}
						}
					} else {
						// Resolve path
						const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
						if (linkedFile) {
							// Check extension
							if (linkedFile.extension && linkedFile.extension.toLowerCase() !== 'md') {
								// Open natively in a new leaf (tab)
								const leaf = this.app.workspace.getLeaf('tab');
								void leaf.openFile(linkedFile);
							} else {
								this.currentFile = linkedFile;
								await this.updateActiveFileContent();

								if (anchor) {
									const decodedAnchor = decodeURIComponent(anchor).toLowerCase().replace(/[\s_]+/g, ' ');
									window.setTimeout(() => {
										const contentArea = this.contentEl.querySelector('.web-content-area');
										if (contentArea) {
											const headers = Array.from(contentArea.querySelectorAll('h1, h2, h3, h4, h5, h6'));
											const matchingEl = headers.find(el => {
												const text = el.textContent?.trim().toLowerCase().replace(/[\s_]+/g, ' ') || '';
												return text === decodedAnchor;
											});
											if (matchingEl) {
												matchingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
											}
										}
									}, 100);
								}
							}
						}
					}
				}
			}
			})();
		});
	}

	renderRightSidebar(parent: HTMLElement) {
		const file = this.currentFile;
		if (!file) return;

		// 1. Table of Contents / Outline Panel
		if (this.plugin.settings.showTOC) {
			const fileCache = this.app.metadataCache.getFileCache(file);
			const headings = fileCache?.headings || [];
			
			if (headings.length > 0) {
				const tocPanel = parent.createEl('div', { cls: 'web-right-panel' });
				
				const header = tocPanel.createEl('div', { cls: 'web-panel-header' });
				const icon = header.createEl('span', { cls: 'web-panel-icon' });
				setIcon(icon, 'list');
				header.createEl('h3', { text: 'Outline' });

				const tocList = tocPanel.createEl('div', { cls: 'web-panel-toc-list' });

				headings.forEach((heading: { heading: string; level: number }) => {
					const tocItem = tocList.createEl('div', {
						text: heading.heading,
						cls: `web-toc-item toc-level-${heading.level}`
					});

					tocItem.addEventListener('click', () => {
						const contentArea = this.contentEl.querySelector('.web-content-area');
						if (contentArea) {
							// Find header tag containing this text
							const headers = Array.from(contentArea.querySelectorAll('h1, h2, h3, h4, h5, h6'));
							const matchingEl = headers.find(el => el.textContent === heading.heading);
							if (matchingEl) {
								matchingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
							}
						}
					});
				});
			}
		}

		// 2. Interactive Local Graph Panel
		if (this.plugin.settings.showGraph) {
			const graphPanel = parent.createEl('div', { cls: 'web-right-panel' });
			const header = graphPanel.createEl('div', { cls: 'web-panel-header' });
			const icon = header.createEl('span', { cls: 'web-panel-icon' });
			setIcon(icon, 'git-commit');
			header.createEl('h3', { text: 'Local Graph' });

			const graphContainer = graphPanel.createEl('div', { cls: 'web-local-graph' });
			this.drawLocalGraph(graphContainer);
		}

		// 3. Backlinks Panel
		if (this.plugin.settings.showBacklinks) {
			const backlinksMap = (this.app.metadataCache as unknown as { getBacklinksForFile: (file: TFile) => BacklinksMap }).getBacklinksForFile(file);
			const backlinks: string[] = [];
			
			if (backlinksMap && backlinksMap.data) {
				for (const filePath of Object.keys(backlinksMap.data)) {
					backlinks.push(filePath);
				}
			}

			if (backlinks.length > 0) {
				const backlinksPanel = parent.createEl('div', { cls: 'web-right-panel' });
				const header = backlinksPanel.createEl('div', { cls: 'web-panel-header' });
				const icon = header.createEl('span', { cls: 'web-panel-icon' });
				setIcon(icon, 'link-2');
				header.createEl('h3', { text: 'Backlinks' });

				const list = backlinksPanel.createEl('div', { cls: 'web-backlinks-list' });
				backlinks.forEach(path => {
					const filename = path.split('/').pop()?.replace('.md', '') || path;
					const item = list.createEl('div', { text: filename, cls: 'web-backlink-item' });
					item.addEventListener('click', () => {
						const linkedFile = this.app.vault.getAbstractFileByPath(path);
						if (linkedFile instanceof TFile) {
							this.currentFile = linkedFile;
							void this.updateActiveFileContent();
						}
					});
				});
			}
		}
	}

	drawLocalGraph(container: HTMLElement) {
		const file = this.currentFile;
		if (!file) return;

		// 1. Resolve Inward links (backlinks)
		const backlinksMap = (this.app.metadataCache as unknown as { getBacklinksForFile: (file: TFile) => BacklinksMap }).getBacklinksForFile(file);
		const inwardPaths = new Set<string>();
		if (backlinksMap && backlinksMap.data) {
			for (const p of Object.keys(backlinksMap.data)) {
				inwardPaths.add(p);
			}
		}

		// 2. Resolve Outward links
		const fileCache = this.app.metadataCache.getFileCache(file);
		const links = fileCache?.links || [];
		const outwardPaths = new Set<string>();
		for (const l of links) {
			const dest = this.app.metadataCache.getFirstLinkpathDest(l.link, file.path);
			if (dest) {
				outwardPaths.add(dest.path);
			}
		}

		// Build Node List
		interface GraphNode {
			id: string;
			label: string;
			type: 'center' | 'inward' | 'outward' | 'both';
			file: TFile | null;
			x: number;
			y: number;
		}

		const nodes: Map<string, GraphNode> = new Map();
		
		// Add central node
		nodes.set(file.path, {
			id: file.path,
			label: file.basename,
			type: 'center',
			file: file,
			x: 0,
			y: 0
		});

		// Helper to add nodes
		const addNode = (path: string, relation: 'inward' | 'outward') => {
			if (path === file.path) return;
			const absFile = this.app.vault.getAbstractFileByPath(path);
			const f = absFile instanceof TFile ? absFile : null;
			const label = f ? f.basename : path.split('/').pop()?.replace('.md', '') || path;
			
			if (nodes.has(path)) {
				const existing = nodes.get(path)!;
				existing.type = 'both';
			} else {
				nodes.set(path, {
					id: path,
					label: label,
					type: relation,
					file: f,
					x: 0,
					y: 0
				});
			}
		};

		inwardPaths.forEach(p => addNode(p, 'inward'));
		outwardPaths.forEach(p => addNode(p, 'outward'));

		const nodeList = Array.from(nodes.values());

		// SVG Setup
		const width = container.clientWidth || 250;
		const height = 240;

		const svg = container.createSvg('svg', {
			attr: {
				width: '100%',
				height: `${height}px`,
				viewBox: `0 0 ${width} ${height}`,
				class: 'web-graph-svg'
			}
		});

		// Add marker definitions for arrows
		const defs = svg.createSvg('defs');
		defs.innerHTML = `
			<marker id="arrow-in" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
				<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--graph-line-in)"/>
			</marker>
			<marker id="arrow-out" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
				<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--graph-line-out)"/>
			</marker>
		`;

		// Layout algorithm (Circle distribution for simple local graph)
		const centerX = width / 2;
		const centerY = height / 2;

		const centerNode = nodeList.find(n => n.type === 'center')!;
		centerNode.x = centerX;
		centerNode.y = centerY;

		const neighbors = nodeList.filter(n => n.type !== 'center');
		const radius = Math.min(width, height) / 2.8;

		neighbors.forEach((n, idx) => {
			const angle = (idx * 2 * Math.PI) / neighbors.length;
			n.x = centerX + radius * Math.cos(angle);
			n.y = centerY + radius * Math.sin(angle);
		});

		// Render Links (Edges)
		nodeList.forEach(n => {
			if (n.type === 'center') return;

			// Draw link line
			const isOutgoing = n.type === 'outward' || n.type === 'both';
			const isIncoming = n.type === 'inward' || n.type === 'both';

			let x1 = centerX;
			let y1 = centerY;
			let x2 = n.x;
			let y2 = n.y;
			let strokeStyle = 'var(--graph-line)';
			let markerEnd = '';

			if (isOutgoing && !isIncoming) {
				strokeStyle = 'var(--graph-line-out)';
				x1 = centerX; y1 = centerY; x2 = n.x; y2 = n.y;
				markerEnd = 'url(#arrow-out)';
			} else if (isIncoming && !isOutgoing) {
				strokeStyle = 'var(--graph-line-in)';
				x1 = n.x; y1 = n.y; x2 = centerX; y2 = centerY;
				markerEnd = 'url(#arrow-in)';
			} else if (isIncoming && isOutgoing) {
				strokeStyle = 'var(--accent)';
			}

			svg.createSvg('line', {
				attr: {
					x1: x1.toString(),
					y1: y1.toString(),
					x2: x2.toString(),
					y2: y2.toString(),
					stroke: strokeStyle,
					'stroke-width': '1.5',
					'marker-end': markerEnd,
					class: 'graph-link'
				}
			});
		});

		// Render Nodes & Labels
		nodeList.forEach(n => {
			const isCenter = n.type === 'center';
			const r = isCenter ? 8 : 5;

			const nodeGroup = svg.createSvg('g', {
				attr: {
					class: `graph-node ${isCenter ? 'is-center' : 'is-neighbor'} type-${n.type}`,
					cursor: 'pointer'
				}
			});

			// Circle element
			nodeGroup.createSvg('circle', {
				attr: {
					cx: n.x,
					cy: n.y,
					r: r,
					class: 'node-dot'
				}
			});

			// Text Label
			const label = nodeGroup.createSvg('text', {
				attr: {
					x: n.x,
					y: n.y + (isCenter ? 18 : 14),
					'text-anchor': 'middle',
					class: 'node-label'
				}
			});
			label.textContent = n.label.length > 15 ? n.label.substring(0, 12) + '...' : n.label;

			// Title tooltip
			const title = nodeGroup.createSvg('title');
			title.textContent = n.label;

			// Navigation Click Handler (on neighbor nodes)
			if (!isCenter && n.file) {
				nodeGroup.addEventListener('click', () => {
					this.currentFile = n.file;
					void this.updateActiveFileContent();
				});
			}
		});
	}

	openSearchModal() {
		if (this.activeSearchModal) {
			this.activeSearchModal.close();
		}
		this.activeSearchModal = new SearchModal(this.app, this);
		this.activeSearchModal.open();
	}
}

class SearchModal extends Modal {
	view: VaultWebsiteView;
	selectedIndex = 0;
	currentResults: TFile[] = [];
	inputEl!: HTMLInputElement;
	resultsContainerEl!: HTMLElement;
	debounceTimeout: number | null = null;

	constructor(app: App, view: VaultWebsiteView) {
		super(app);
		this.view = view;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.containerEl.addClass('web-search-modal-overlay');
		this.modalEl.addClass('web-search-modal');

		// Search header
		const header = contentEl.createEl('div', { cls: 'web-modal-header' });
		
		const searchIcon = header.createEl('span', { cls: 'web-modal-search-icon' });
		setIcon(searchIcon, 'search');

		this.inputEl = header.createEl('input', {
			cls: 'web-modal-search-input',
			attr: { type: 'text', placeholder: 'Search notes and contents...' }
		}) as HTMLInputElement;

		header.createEl('span', { cls: 'web-modal-esc-hint', text: 'ESC' });

		// Results container
		this.resultsContainerEl = contentEl.createEl('div', { cls: 'web-modal-results' });

		this.inputEl.focus();

		this.inputEl.addEventListener('input', () => {
			this.selectedIndex = 0;
			if (this.debounceTimeout) window.clearTimeout(this.debounceTimeout);
			this.debounceTimeout = window.setTimeout(() => {
				void this.updateResults();
			}, 150);
		});

		// Custom keyboard navigation
		this.scope.register([], 'ArrowDown', (e: KeyboardEvent) => {
			e.preventDefault();
			if (this.currentResults.length > 0) {
				this.selectedIndex = (this.selectedIndex + 1) % this.currentResults.length;
				this.updateResultSelectionUI();
			}
		});

		this.scope.register([], 'ArrowUp', (e: KeyboardEvent) => {
			e.preventDefault();
			if (this.currentResults.length > 0) {
				this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % this.currentResults.length;
				this.updateResultSelectionUI();
			}
		});

		this.scope.register([], 'Enter', (e: KeyboardEvent) => {
			e.preventDefault();
			const selected = this.currentResults[this.selectedIndex];
			if (selected) {
				this.view.currentFile = selected;
				void this.view.updateActiveFileContent();
				this.close();
			}
		});

		void this.updateResults();
	}

	onClose() {
		if (this.debounceTimeout) window.clearTimeout(this.debounceTimeout);
		this.contentEl.empty();
		if (this.view.activeSearchModal === this) {
			this.view.activeSearchModal = null;
		}
	}

	async updateResults() {
		const query = this.inputEl.value.toLowerCase().trim();
		this.resultsContainerEl.empty();

		if (!query) {
			this.resultsContainerEl.createEl('div', { cls: 'web-modal-no-results', text: 'Type to search...' });
			this.currentResults = [];
			return;
		}

		const files = this.app.vault.getMarkdownFiles();
		const matches: { file: TFile; score: number; snippet: string }[] = [];

		// First do title match (fast)
		for (const file of files) {
			if (file.basename.toLowerCase().includes(query)) {
				matches.push({ file, score: 100, snippet: '' });
			}
		}

		// Only do content search if we don't have enough matches (limit 8 max)
		if (matches.length < 8) {
			let contentMatches = 0;
			const needed = 8 - matches.length;
			for (const file of files) {
				if (matches.some(m => m.file === file)) continue;

				try {
					const content = await this.app.vault.cachedRead(file);
					const lowerContent = content.toLowerCase();
					const index = lowerContent.indexOf(query);
					if (index !== -1) {
						const start = Math.max(0, index - 30);
						const end = Math.min(content.length, index + query.length + 40);
						const snippet = '...' + content.substring(start, end).replace(/\n/g, ' ') + '...';
						matches.push({ file, score: 10, snippet });
						contentMatches++;
						if (contentMatches >= needed) break;
					}
				} catch (_err) {
					// Ignore
				}
			}
		}

		const filteredResults = matches;

		// Sort by score descending
		filteredResults.sort((a, b) => b.score - a.score);

		const limit = 8;
		const sliced = filteredResults.slice(0, limit);
		this.currentResults = sliced.map(m => m.file);

		if (this.currentResults.length === 0) {
			this.resultsContainerEl.createEl('div', { cls: 'web-modal-no-results', text: 'No results found' });
			return;
		}

		sliced.forEach((match, idx) => {
			const item = this.resultsContainerEl.createEl('div', {
				cls: `web-modal-result-item ${idx === this.selectedIndex ? 'is-selected' : ''}`
			});

			const titleRow = item.createEl('div', { cls: 'web-modal-result-title-row' });
			const fileIcon = titleRow.createEl('span', { cls: 'web-modal-result-icon' });
			setIcon(fileIcon, 'file-text');

			titleRow.createEl('span', { cls: 'web-modal-result-title', text: match.file.basename });

			if (match.snippet) {
				item.createEl('div', { cls: 'web-modal-result-snippet', text: match.snippet });
			}

			item.addEventListener('click', () => {
				this.view.currentFile = match.file;
				void this.view.updateActiveFileContent();
				this.close();
			});
		});
	}

	updateResultSelectionUI() {
		const items = this.resultsContainerEl.querySelectorAll('.web-modal-result-item');
		items.forEach((item, idx) => {
			if (idx === this.selectedIndex) {
				item.addClass('is-selected');
			} else {
				item.removeClass('is-selected');
			}
		});
	}
}

