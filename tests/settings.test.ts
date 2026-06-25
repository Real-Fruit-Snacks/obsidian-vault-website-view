// tests/settings.test.ts
import { describe, test, expect, vi } from 'vitest';
import { App } from 'obsidian';
import VaultWebsiteViewPlugin from '../src/main';
import { VaultWebsiteSettingTab } from '../src/settings';

describe('Settings Tab Integration', () => {
  test('displays all options and modifies plugin settings', async () => {
    const app = new App();
    const plugin = new VaultWebsiteViewPlugin(app, {});
    plugin.settings = {
      theme: 'glassmorphism',
      showGraph: true,
      showTOC: true,
      showBacklinks: true,
      excludedFolders: ''
    };
    plugin.saveSettings = vi.fn();
    plugin.refreshViews = vi.fn();

    const tab = new VaultWebsiteSettingTab(app, plugin);
    tab.display();

    // Verify heading is rendered
    const title = tab.containerEl.querySelector('h2');
    expect(title?.textContent).toBe('Vault Website View Settings');

    // Simulate modifying theme via select dropdown
    const select = tab.containerEl.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    select.value = 'nord';
    select.dispatchEvent(new Event('change'));

    // Wait for async setting save/refresh to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(plugin.settings.theme).toBe('nord');
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.refreshViews).toHaveBeenCalled();
  });
});
