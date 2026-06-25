// tests/mocks/obsidian.ts

import { vi } from 'vitest';

export class Component {
  registerDomEvent(window: Window, type: string, callback: Function) {
    window.addEventListener(type, callback as any);
  }
}

export class View extends Component {
  leaf: WorkspaceLeaf;
  app: App;
  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.app = leaf.app || new App();
  }
  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
}

export class ItemView extends View {
  containerEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.containerEl = document.createElement('div');
    this.contentEl = this.containerEl.createEl('div', { cls: 'view-content' });
  }

  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  async onOpen() {}
  async onClose() {}
}

export class WorkspaceLeaf {
  app: App | null = null;
  view: View | null = null;

  async setViewState(state: { type: string; active?: boolean }) {
    if (state.type && this.app) {
      const viewCreator = this.app.workspace.viewRegistry[state.type];
      if (viewCreator) {
        this.view = viewCreator(this);
      }
    }
  }

  async openFile(file: TFile) {}
}

export class TAbstractFile {
  path: string = '';
  name: string = '';
  vault: Vault;
  parent: TFolder | null = null;
  constructor(path: string, name: string, vault: Vault) {
    this.path = path;
    this.name = name;
    this.vault = vault;
  }
}

export class TFile extends TAbstractFile {
  basename: string = '';
  extension: string = '';
  content: string = '';

  constructor(path: string, name: string, vault: Vault, content = '') {
    super(path, name, vault);
    this.content = content;
    const parts = name.split('.');
    this.extension = parts.pop() || '';
    this.basename = parts.join('.');
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export class Vault {
  files: TFile[] = [];
  events: Record<string, Function[]> = {};

  getName() {
    return 'Test Vault';
  }

  getMarkdownFiles(): TFile[] {
    return this.files.filter(f => f.extension === 'md');
  }

  async read(file: TFile): Promise<string> {
    return file.content;
  }

  async cachedRead(file: TFile): Promise<string> {
    return file.content;
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.find(f => f.path === path) || null;
  }

  on(name: string, callback: Function) {
    if (!this.events[name]) this.events[name] = [];
    this.events[name].push(callback);
    return { name, callback };
  }

  trigger(name: string, ...args: any[]) {
    if (this.events[name]) {
      this.events[name].forEach(cb => cb(...args));
    }
  }
}

export class Workspace {
  leaves: WorkspaceLeaf[] = [];
  viewRegistry: Record<string, (leaf: WorkspaceLeaf) => View> = {};
  events: Record<string, Function[]> = {};

  getLeavesOfType(type: string): WorkspaceLeaf[] {
    return this.leaves.filter(l => l.view?.getViewType() === type);
  }

  getLeaf(createNavigationLeaf?: boolean | 'tab' | 'split' | 'window'): WorkspaceLeaf {
    const leaf = new WorkspaceLeaf();
    leaf.app = (this as any).app;
    this.leaves.push(leaf);
    return leaf;
  }

  revealLeaf(leaf: WorkspaceLeaf) {}

  onLayoutReady(callback: () => any) {
    callback();
  }

  detachLeavesOfType(type: string) {
    this.leaves = this.leaves.filter(l => l.view?.getViewType() !== type);
  }

  getActiveViewOfType<T extends View>(type: any): T | null {
    const activeLeaf = this.leaves.find(l => l.view instanceof type);
    return activeLeaf ? activeLeaf.view as T : null;
  }
}

export class MetadataCache {
  events: Record<string, Function[]> = {};
  fileCaches: Record<string, any> = {};
  backlinks: Record<string, any> = {};

  on(name: string, callback: Function) {
    if (!this.events[name]) this.events[name] = [];
    this.events[name].push(callback);
    return { name, callback };
  }

  trigger(name: string, ...args: any[]) {
    if (this.events[name]) {
      this.events[name].forEach(cb => cb(...args));
    }
  }

  getFileCache(file: TFile) {
    return this.fileCaches[file.path] || null;
  }

  getBacklinksForFile(file: TFile) {
    return this.backlinks[file.path] || { data: {} };
  }

  getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null {
    const cleanLink = linkpath.replace(/\.md$/, '').toLowerCase();
    const files = (this as any).app?.vault?.getMarkdownFiles() || [];
    return files.find((f: TFile) => f.basename.toLowerCase() === cleanLink || f.path.toLowerCase() === cleanLink) || null;
  }
}

export class App {
  vault: Vault;
  workspace: Workspace;
  metadataCache: MetadataCache;

  constructor() {
    this.vault = new Vault();
    this.workspace = new Workspace();
    this.metadataCache = new MetadataCache();
    (this.workspace as any).app = this;
    (this.metadataCache as any).app = this;
  }
}

export class Plugin {
  app: App;
  manifest: any;
  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  async loadData() {
    return {};
  }
  async saveData(data: any) {}
  registerView(type: string, factory: (leaf: WorkspaceLeaf) => View) {
    this.app.workspace.viewRegistry[type] = factory;
  }
  addRibbonIcon(icon: string, title: string, callback: () => void) {
    return { addEventListener: () => {} };
  }
  addCommand(command: any) {}
  addSettingTab(settingTab: any) {}
  registerEvent(eventRef: any) {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;
  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }
  display() {}
}

export class Setting {
  containerEl: HTMLElement;
  settingEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl = containerEl.createEl('div', { cls: 'setting-item' });
    this.nameEl = this.settingEl.createEl('div', { cls: 'setting-item-name' });
    this.descEl = this.settingEl.createEl('div', { cls: 'setting-item-description' });
    this.controlEl = this.settingEl.createEl('div', { cls: 'setting-item-control' });
  }

  setName(name: string) {
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(desc: string) {
    this.descEl.textContent = desc;
    return this;
  }

  addDropdown(callback: (dropdown: DropdownComponent) => any) {
    const dropdown = new DropdownComponent(this.controlEl);
    callback(dropdown);
    return this;
  }

  addToggle(callback: (toggle: ToggleComponent) => any) {
    const toggle = new ToggleComponent(this.controlEl);
    callback(toggle);
    return this;
  }

  addText(callback: (text: TextComponent) => any) {
    const text = new TextComponent(this.controlEl);
    callback(text);
    return this;
  }
}

export class DropdownComponent {
  selectEl: HTMLSelectElement;
  onChangeCallback?: (value: string) => any;

  constructor(containerEl: HTMLElement) {
    this.selectEl = containerEl.createEl('select') as any;
    this.selectEl.addEventListener('change', () => {
      if (this.onChangeCallback) this.onChangeCallback(this.selectEl.value);
    });
  }

  addOption(value: string, display: string) {
    this.selectEl.createEl('option', { value, text: display });
    return this;
  }

  setValue(value: string) {
    this.selectEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => any) {
    this.onChangeCallback = callback;
    return this;
  }
}

export class ToggleComponent {
  checkboxEl: HTMLInputElement;
  onChangeCallback?: (value: boolean) => any;

  constructor(containerEl: HTMLElement) {
    this.checkboxEl = containerEl.createEl('input', { attr: { type: 'checkbox' } }) as any;
    this.checkboxEl.addEventListener('change', () => {
      if (this.onChangeCallback) this.onChangeCallback(this.checkboxEl.checked);
    });
  }

  setValue(value: boolean) {
    this.checkboxEl.checked = value;
    return this;
  }

  onChange(callback: (value: boolean) => any) {
    this.onChangeCallback = callback;
    return this;
  }
}

export class TextComponent {
  inputEl: HTMLInputElement;
  onChangeCallback?: (value: string) => any;

  constructor(containerEl: HTMLElement) {
    this.inputEl = containerEl.createEl('input', { attr: { type: 'text' } }) as any;
    this.inputEl.addEventListener('input', () => {
      if (this.onChangeCallback) this.onChangeCallback(this.inputEl.value);
    });
  }

  setPlaceholder(placeholder: string) {
    this.inputEl.placeholder = placeholder;
    return this;
  }

  setValue(value: string) {
    this.inputEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => any) {
    this.onChangeCallback = callback;
    return this;
  }
}

export class MarkdownRenderer {
  static async render(
    app: App,
    markdown: string,
    el: HTMLElement,
    sourcePath: string,
    component: any
  ): Promise<void> {
    let html = markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, label) => {
      const displayLabel = label || target;
      return `<a class="internal-link" data-href="${target}">${displayLabel}</a>`;
    });
    el.innerHTML = `<div class="rendered-markdown">${html}</div>`;
  }
}

export function setIcon(el: HTMLElement, iconId: string) {
  el.setAttribute('data-icon', iconId);
  el.innerHTML = `<span class="icon-${iconId}"></span>`;
}

export class Scope {
  keys: { key: string; func: Function }[] = [];
  register(modifiers: string[], key: string | null, func: Function) {
    if (key) {
      this.keys.push({ key: key.toLowerCase(), func });
    }
    return {};
  }
}

export class Modal {
  app: App;
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  scope: Scope;

  constructor(app: App) {
    this.app = app;
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'modal-container';
    this.modalEl = this.containerEl.createEl('div', { cls: 'modal' });
    this.titleEl = this.modalEl.createEl('div', { cls: 'modal-title' });
    this.contentEl = this.modalEl.createEl('div', { cls: 'modal-content' });
    this.scope = new Scope();
  }

  open() {
    document.body.appendChild(this.containerEl);
    this.onOpen();
    this.containerEl.ownerDocument.addEventListener('keydown', this.handleKeyDown);
  }

  close() {
    this.containerEl.remove();
    this.containerEl.ownerDocument.removeEventListener('keydown', this.handleKeyDown);
    this.onClose();
  }

  handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const found = this.scope.keys.find(k => k.key === key);
    if (found) {
      found.func(e);
    } else if (e.key === 'Escape') {
      this.close();
    }
  };

  onOpen() {}
  onClose() {}
}

export function debounce(cb: Function, delay?: number, resetDelay?: boolean) {
  let timeout: any = null;
  return function(...args: any[]) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      cb(...args);
    }, delay);
  };
}
