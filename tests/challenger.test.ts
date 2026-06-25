// tests/challenger.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import VaultWebsiteViewPlugin from '../src/main';
import { VaultWebsiteView } from '../src/view';

describe('Challenger 1 Stress Tests', () => {
  let app: App;
  let plugin: VaultWebsiteViewPlugin;
  let leaf: any;

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
    leaf = app.workspace.getLeaf();
  });

  test('BUG 1: Substring exclusion matches filenames and substrings instead of exact folder names', async () => {
    // 1. File inside templates folder
    const templateFile = new TFile('templates/Doc.md', 'Doc.md', app.vault, 'Template content');
    // 2. File in root containing "templates" in filename
    const rootTemplatesFile = new TFile('templates.md', 'templates.md', app.vault, 'Root templates list');
    // 3. Normal file in root
    const normalFile = new TFile('Note.md', 'Note.md', app.vault, 'Normal note');
    // 4. File in folder containing "temp" but not exactly "templates"
    const temporaryFile = new TFile('temp-folder/Doc.md', 'Doc.md', app.vault, 'Temp content');

    app.vault.files = [templateFile, rootTemplatesFile, normalFile, temporaryFile];
    plugin.settings.excludedFolders = 'templates';

    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = normalFile;
    await view.renderAll();

    const fileItems = view.contentEl.querySelectorAll('.web-sidebar-file-title');
    const itemNames = Array.from(fileItems).map(el => el.textContent);

    // Verify which files are visible/excluded
    // Expected behavior: only templates/Doc.md should be excluded because only it is inside a folder named "templates".
    // Actual behavior: templates.md is ALSO excluded because segment.toLowerCase().includes('templates') matches the filename.
    // Also, if exclusion was "temp", it would exclude "temp-folder" and "templates" (substring matching).
    
    // We expect normalFile (Note) to be in sidebar.
    expect(itemNames).toContain('Note');
    
    // rootTemplatesFile (templates.md) should NOT be excluded because it's a file, not the folder "templates"
    const hasTemplatesFile = itemNames.includes('templates');
    expect(hasTemplatesFile).toBe(true);
    
    // Check with exclusion "temp"
    plugin.settings.excludedFolders = 'temp';
    await view.renderAll();
    const itemNames2 = Array.from(view.contentEl.querySelectorAll('.web-sidebar-file-title')).map(el => el.textContent);
    
    // temporaryFile (temp-folder/Doc.md) should NOT be excluded because its folder is "temp-folder", not "temp"
    expect(itemNames2.includes('Doc')).toBe(true);
  });

  test('BUG 2: Backlinks & Local Graph of active note do not update when other notes are modified', async () => {
    const fileA = new TFile('Note A.md', 'Note A.md', app.vault, 'Note A content');
    const fileB = new TFile('Note B.md', 'Note B.md', app.vault, 'Note B content');
    app.vault.files = [fileA, fileB];

    // Initially no links
    app.metadataCache.fileCaches[fileA.path] = { links: [], headings: [] };
    app.metadataCache.fileCaches[fileB.path] = { links: [], headings: [] };
    app.metadataCache.backlinks[fileA.path] = { data: {} };

    await plugin.onload();

    // Set leaf view
    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;
    await view.renderAll();
    leaf.view = view;
    app.workspace.leaves = [leaf];

    // Verify backlinks is empty initially
    let backlinkItems = view.contentEl.querySelectorAll('.web-backlink-item');
    expect(backlinkItems.length).toBe(0);

    // Mock modify file B to link to A
    fileB.content = 'Linking to [[Note A]]';
    app.metadataCache.fileCaches[fileB.path] = {
      links: [{ link: 'Note A', original: '[[Note A]]' }],
      headings: []
    };
    app.metadataCache.backlinks[fileA.path] = {
      data: { [fileB.path]: {} }
    };

    // Trigger metadataCache changed event for B
    const refreshSpy = vi.spyOn(plugin, 'refreshViews');
    app.metadataCache.trigger('changed', fileB);

    // Verify refreshViews was called with contentOnly=true
    expect(refreshSpy).toHaveBeenCalled();
  });

  test('BUG 3: Deleted file crash when rendering is triggered', async () => {
    const fileA = new TFile('Note A.md', 'Note A.md', app.vault, 'Note A content');
    app.vault.files = [fileA];

    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = fileA;

    // Mock vault.cachedRead to throw error (as if file is deleted/missing)
    app.vault.cachedRead = vi.fn().mockRejectedValue(new Error('File not found / deleted'));

    const contentArea = view.contentEl.querySelector('.web-content-area') || view.contentEl.createEl('div', { cls: 'web-content-area' });
    await view.renderContentArea(contentArea as HTMLElement);
    
    // It should not throw, and should render an error element
    const errorEl = contentArea.querySelector('.web-render-error');
    expect(errorEl).not.toBeNull();
  });

  test('BUG 4: Search performance scales poorly with vault size (O(N) reads)', async () => {
    // Generate 100 mock files
    const mockFiles: TFile[] = [];
    for (let i = 0; i < 100; i++) {
      mockFiles.push(new TFile(`Note ${i}.md`, `Note ${i}.md`, app.vault, `Content of note ${i}`));
    }
    app.vault.files = mockFiles;

    const view = new VaultWebsiteView(leaf, plugin);
    view.currentFile = mockFiles[0] as TFile;
    await view.onOpen();

    // Open search modal
    view.openSearchModal();
    const modal = view.activeSearchModal as any;
    expect(modal).not.toBeNull();

    // Spy on cachedRead
    const readSpy = vi.spyOn(app.vault, 'cachedRead');

    // Simulate input search query for a title that exists
    modal.inputEl.value = 'Note 99';
    await modal.updateResults();

    // Verify how many files were read. We expect it to be well under 100 because title match is found.
    expect(readSpy.mock.calls.length).toBeLessThan(100);
  });
});
