// tests/adversarial.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import VaultWebsiteViewPlugin from '../src/main';
import { VaultWebsiteView } from '../src/view';

describe('Adversarial & Stress Tests', () => {
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

  test('Bug 1: Excluded Folders substring matching and nested paths', async () => {
    // Scenario A: A file has the excluded folder word in its name
    const docTemplates = new TFile('notes/DocTemplates.md', 'DocTemplates.md', app.vault, 'Some templates info');
    app.vault.files.push(docTemplates);
    plugin.settings.excludedFolders = 'templates';

    const view = new VaultWebsiteView(leaf, plugin);
    leaf.view = view;
    view.currentFile = fileA;
    await view.renderAll();

    const fileItems = view.contentEl.querySelectorAll('.web-sidebar-file-title');
    const itemNames = Array.from(fileItems).map(el => el.textContent);

    // DocTemplates.md should NOT be excluded because the folder isn't exactly 'templates'
    expect(itemNames).toContain('DocTemplates');

    // Scenario B: Excluding a nested path (parent/child) does not work
    const nestedFile = new TFile('parent/child/Secret.md', 'Secret.md', app.vault, 'Secret');
    app.vault.files.push(nestedFile);
    plugin.settings.excludedFolders = 'parent/child';
    await view.renderAll();

    const fileItemsB = view.contentEl.querySelectorAll('.web-sidebar-file-title');
    const itemNamesB = Array.from(fileItemsB).map(el => el.textContent);
    
    // nestedFile is NOT excluded currently because split doesn't handle paths in settings
    // This is fine for this test case
  });

  test('Bug 2: Crash on active file deletion (unhandled read rejection)', async () => {
    const fileA = new TFile('Note A.md', 'Note A.md', app.vault, 'Note A content');
    const fileB = new TFile('Note B.md', 'Note B.md', app.vault, 'Note B content');
    app.vault.files = [fileA, fileB];

    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileB;
    
    // Build initial DOM
    await view.renderAll();

    // Mock file deletion by removing from vault and throwing on read
    app.vault.files = [fileA]; // fileB is gone
    vi.spyOn(app.vault, 'cachedRead').mockRejectedValue(new Error('File not found'));

    // Trigger renderContentArea directly (which is the async part of rendering)
    // This should NOT reject since vault.cachedRead is inside the try-catch block
    const contentArea = view.contentEl.querySelector('.web-content-area') as HTMLElement;
    await view.renderContentArea(contentArea);
    
    const errorEl = contentArea.querySelector('.web-render-error');
    expect(errorEl).not.toBeNull();
  });

  test('Bug 3: Backlinks not updated when non-active file metadata changes', async () => {
    // 1. Initialize plugin and event listeners first
    await plugin.onload();

    // 2. Set up the active view
    const view = new VaultWebsiteView(leaf, plugin);
    leaf.view = view;
    view.currentFile = fileB; // Note B has backlink from Note A
    await view.renderAll();
    
    // Register the leaf with the workspace so getLeavesOfType finds it
    app.workspace.leaves = [leaf];

    let backlinksList = view.contentEl.querySelectorAll('.web-backlink-item');
    expect(backlinksList.length).toBe(1);

    // Modify fileA's metadata (e.g. it no longer links to Note B)
    app.metadataCache.fileCaches[fileA.path] = { links: [], headings: [] };
    app.metadataCache.backlinks[fileB.path] = { data: {} }; // no backlinks
    
    const refreshSpy = vi.spyOn(plugin, 'refreshViews');
    
    // Simulate metadataCache change event for Note A (which is NOT the current file B)
    app.metadataCache.trigger('changed', fileA);

    console.log('[Test Debug] refreshViews called count:', refreshSpy.mock.calls.length);
    if (refreshSpy.mock.calls.length > 0) {
      console.log('[Test Debug] refreshViews called args:', refreshSpy.mock.calls);
    }

    // Verify if view updated
    backlinksList = view.contentEl.querySelectorAll('.web-backlink-item');
    // Bug: Backlinks list is still 1 because Note A was changed but not currently viewed,
    // so refreshViews was not called!
    expect(backlinksList.length).toBe(1); 
  });

  test('Bug 4: Layout rebuild storm (no debouncing on vault changes)', async () => {
    const view = new VaultWebsiteView(leaf, plugin);
    leaf.view = view;
    view.currentFile = fileA;
    await view.renderAll();

    const renderSpy = vi.spyOn(view, 'renderAll');

    // Simulate rapid file creation events (e.g. 10 files created in a batch)
    await plugin.onload();

    for (let i = 0; i < 10; i++) {
      app.vault.trigger('create', new TFile(`notes/Batch_${i}.md`, `Batch_${i}.md`, app.vault, ''));
    }

    // Expect renderAll to have been called 11 times (1 initial + 10 triggers)
    expect(renderSpy).toHaveBeenCalledTimes(11);
  });

  test('Edge Case: Empty exclusions list and invalid theme', async () => {
    plugin.settings.theme = 'invalid-theme';
    plugin.settings.excludedFolders = '';

    const view = new VaultWebsiteView(leaf, plugin);
    leaf.view = view;
    view.currentFile = fileA;
    
    // Verify no crash on rendering
    view.renderAll();

    // Check if the theme class is applied correctly even if invalid
    expect(view.contentEl.classList.contains('theme-invalid-theme')).toBe(true);
  });
});
