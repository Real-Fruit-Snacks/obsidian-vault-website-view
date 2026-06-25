// tests/setup.ts

export {};

declare global {
  interface Element {
    empty(): void;
    createEl(
      tagName: string,
      options?: string | { cls?: string; text?: string; attr?: Record<string, string | number | boolean | null>; value?: string; placeholder?: string }
    ): HTMLElement;
    createSvg(
      tagName: string,
      options?: { attr?: Record<string, string | number | boolean | null> }
    ): SVGElement;
    addClass(...classes: string[]): void;
    removeClass(...classes: string[]): void;
    toggleClass(cls: string, value?: boolean): void;
  }
}

if (typeof window !== 'undefined') {
  // Mock empty()
  Element.prototype.empty = function(this: Element) {
    this.innerHTML = '';
  };

  // Mock createEl()
  Element.prototype.createEl = function(
    this: Element,
    tagName: string,
    options?: any
  ) {
    const el = this.ownerDocument.createElement(tagName);
    if (options) {
      if (typeof options === 'string') {
        el.className = options;
      } else if (typeof options === 'object') {
        if (options.cls) el.className = options.cls;
        if (options.text) el.textContent = options.text;
        if (options.attr) {
          for (const [key, value] of Object.entries(options.attr)) {
            el.setAttribute(key, value as string);
          }
        }
        if (options.value) {
          (el as any).value = options.value;
        }
        if (options.placeholder) {
          (el as any).placeholder = options.placeholder;
        }
      }
    }
    this.appendChild(el);
    return el as any;
  };

  // Mock createSvg()
  Element.prototype.createSvg = function(
    this: Element,
    tagName: string,
    options?: { attr?: Record<string, string> }
  ) {
    const el = this.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tagName);
    if (options && options.attr) {
      for (const [key, value] of Object.entries(options.attr)) {
        el.setAttribute(key, value);
      }
    }
    this.appendChild(el);
    return el as any;
  };

  // Mock addClass, removeClass, toggleClass
  Element.prototype.addClass = function(this: Element, ...classes: string[]) {
    this.classList.add(...classes);
  };
  
  Element.prototype.removeClass = function(this: Element, ...classes: string[]) {
    this.classList.remove(...classes);
  };
  
  Element.prototype.toggleClass = function(this: Element, cls: string, value?: boolean) {
    if (value === undefined) {
      this.classList.toggle(cls);
    } else if (value) {
      this.classList.add(cls);
    } else {
      this.classList.remove(cls);
    }
  };
}
