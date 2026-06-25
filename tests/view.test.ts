// tests/view.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import VaultWebsiteViewPlugin from '../src/main';
import { VaultWebsiteView } from '../src/view';

describe('VaultWebsiteView Rendering & Behavior', () => {
  let app: App;
  let plugin: VaultWebsiteViewPlugin;
  let leaf: any;
  let fileA: TFile;
  let fileB: TFile;

  beforeEach(() => {
    app = new App();
    plugin = new VaultWebsiteViewPlugin(app, {});
    plugin.settings = {
      theme: 'glassmorphism',
      showGraph: true,
      showTOC: true,
      showBacklinks: true,
      excludedFolders: ''
    };

    // Populate mock files
    fileA = new TFile('notes/Note A.md', 'Note A.md', app.vault, 'Welcome to [[Note B]]');
    fileB = new TFile('notes/Note B.md', 'Note B.md', app.vault, 'This is Note B.');
    app.vault.files = [fileA, fileB];

    // Setup backlinks and caches
    app.metadataCache.fileCaches[fileA.path] = {
      links: [{ link: 'Note B', original: '[[Note B]]' }],
      headings: []
    };
    app.metadataCache.backlinks[fileB.path] = {
      data: { [fileA.path]: {} }
    };

    leaf = app.workspace.getLeaf();
  });

  test('renders base workspace correctly', async () => {
    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;
    await view.renderAll();

    // Verify outer container and theme classes
    expect(view.contentEl.classList.contains('theme-glassmorphism')).toBe(true);

    // Verify Title breadcrumbs
    const title = view.contentEl.querySelector('.web-note-title');
    expect(title?.textContent).toBe('Note A');

    // Verify rendered markdown body
    const body = view.contentEl.querySelector('.web-markdown-body');
    expect(body?.innerHTML).toContain('Welcome to');
    expect(body?.innerHTML).toContain('class="internal-link"');
  });

  test('excludes folders specified in settings', async () => {
    // Add template file in an excluded path
    const tempFile = new TFile('templates/Doc.md', 'Doc.md', app.vault, 'Template content');
    app.vault.files.push(tempFile);
    plugin.settings.excludedFolders = 'templates';

    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;
    await view.renderAll();

    const fileItems = view.contentEl.querySelectorAll('.web-sidebar-file-title');
    const itemNames = Array.from(fileItems).map(el => el.textContent);

    expect(itemNames).toContain('Note A');
    expect(itemNames).not.toContain('Doc');
  });

  test('navigates to linked note when clicking on internal wiki-links', async () => {
    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;
    view.renderAll();

    // Wait for view rendering and event listeners to setup
    await new Promise(resolve => setTimeout(resolve, 50));

    const link = view.contentEl.querySelector('a.internal-link') as HTMLElement;
    expect(link).not.toBeNull();

    // Simulate click
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Wait for view update
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(view.currentFile.path).toBe('notes/Note B.md');
    const title = view.contentEl.querySelector('.web-note-title');
    expect(title?.textContent).toBe('Note B');
  });

  test('opens search modal and performs search with Ctrl+K shortcut', async () => {
    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;
    // Set active view in workspace so shortcut knows it's active
    app.workspace.leaves = [leaf];
    leaf.view = view;
    
    await view.onOpen();

    // Trigger keydown Event for Ctrl + K on window
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    window.dispatchEvent(event);

    const overlay = document.querySelector('.web-search-modal-overlay') || document.querySelector('.modal-container');
    expect(overlay).not.toBeNull();

    const input = document.querySelector('.web-modal-search-input') as HTMLInputElement;
    expect(input).not.toBeNull();

    // Type query
    input.value = 'Note B';
    input.dispatchEvent(new Event('input'));

    // Wait for debounced search results (150ms debounce)
    await new Promise(resolve => setTimeout(resolve, 250));

    const result = document.querySelector('.web-modal-result-title');
    expect(result?.textContent).toBe('Note B');

    // Press Enter to navigate
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    document.dispatchEvent(enterEvent);

    expect(view.currentFile.path).toBe('notes/Note B.md');
  });

  test('renders graph layout showing relationships', async () => {
    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;
    await view.renderAll();

    const svg = view.contentEl.querySelector('.web-graph-svg');
    expect(svg).not.toBeNull();

    const nodes = svg?.querySelectorAll('.graph-node');
    expect(nodes?.length).toBe(2); // Note A (center) and Note B (neighbor)

    const links = svg?.querySelectorAll('.graph-link');
    expect(links?.length).toBe(1); // One edge between Note A and Note B
  });
});
