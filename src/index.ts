export type CommentPoint = {
  id: string;
  text: string;
  x: number;
  y: number;
  timestamp: number;
  nx?: number;
  ny?: number;
  anchor?: {
    path: string;
    rx: number; // 0..1 relative horizontal position within element bbox
    ry: number; // 0..1 relative vertical position within element bbox
  };
};

export type EnableOptions = {
  storage?: 'memory' | 'localStorage';
  exportFormat?: 'markdown' | 'json';
  debug?: boolean;
  theme?: 'light' | 'dark';
};

type CommentStorage = {
  load: () => CommentPoint[];
  save: (comments: CommentPoint[]) => void;
  clear: () => void;
};

const LOCAL_STORAGE_KEY = 'prototype-comments';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function canUseLocalStorage(): boolean {
  if (!isBrowser() || !('localStorage' in window)) return false;
  try {
    const testKey = `${LOCAL_STORAGE_KEY}:__test`;
    window.localStorage.setItem(testKey, '1');
    const ok = window.localStorage.getItem(testKey) === '1';
    window.localStorage.removeItem(testKey);
    return ok;
  } catch {
    return false;
  }
}

function createMemoryStorage(): CommentStorage {
  let inMemory: CommentPoint[] = [];
  return {
    load: () => [...inMemory],
    save: (comments) => {
      inMemory = [...comments];
    },
    clear: () => {
      inMemory = [];
    }
  };
}

function createLocalStorage(): CommentStorage {
  return {
    load: () => {
      if (!isBrowser() || !('localStorage' in window)) return [];
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as CommentPoint[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    save: (comments) => {
      if (!isBrowser() || !('localStorage' in window)) return;
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(comments));
      } catch {
        // ignore quota or serialization errors
      }
    },
    clear: () => {
      if (!isBrowser() || !('localStorage' in window)) return;
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };
}

class CommentManager {
  private isEnabled: boolean = false;
  private storage: CommentStorage = createMemoryStorage();
  private comments: CommentPoint[] = [];
  private overlayElement: HTMLDivElement | null = null;
  private editorElement: HTMLDivElement | null = null;
  private exportAs: 'markdown' | 'json' = 'json';
  private debug: boolean = true;
  private storageKind: 'memory' | 'localStorage' = 'memory';
  private hoverHandler: ((e: MouseEvent) => void) | null = null;
  private viewportHandler: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private visible: boolean = true;
  private theme: 'light' | 'dark' = 'dark';
  private collapseTimers: WeakMap<HTMLDivElement, number> = new WeakMap();

  setDebug(enabled: boolean): void {
    this.debug = enabled;
    this.debugLog('debug logging', enabled ? 'enabled' : 'disabled');
  }

  private debugLog(...args: unknown[]): void {
    if (this.debug) {
      // Prefix for easy filtering in the console
      console.log('[prototype-comments]', ...args);
    }
  }

  private applyThemeVars(): void {
    if (!this.overlayElement) return;
    const el = this.overlayElement;
    const isLight = this.theme === 'light';
    // Colors
    const surfaceBg = isLight ? 'rgba(0,0,0,0.80)' : 'rgba(255,255,255,0.85)';
    const borderColor = isLight ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.25)';
    const textColor = isLight ? '#f9fafb' : '#111827';
    const collapsedBg = isLight ? 'rgba(0,0,0,0.90)' : 'rgba(255,255,255,1)';

    el.style.setProperty('--pc-bg', surfaceBg);
    el.style.setProperty('--pc-border-color', borderColor);
    el.style.setProperty('--pc-text', textColor);
    el.style.setProperty('--pc-collapsed-bg', collapsedBg);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.applyThemeVars();
    this.renderOverlay();
  }

  enable(options: EnableOptions = {}): void {
    this.setDebug(options.debug ?? this.debug);
    this.debugLog('enable() called with options:', {
      storage: options.storage ?? 'memory',
      exportFormat: options.exportFormat ?? 'json',
      theme: options.theme ?? this.theme
    });
    if (!isBrowser()) {
      this.storage = createMemoryStorage();
      this.comments = [];
      this.exportAs = options.exportFormat ?? 'json';
      this.isEnabled = true;
      this.storageKind = 'memory';
      this.theme = options.theme ?? this.theme;
      this.debugLog('enabled in non-browser environment with memory storage');
      return;
    }

    this.exportAs = options.exportFormat ?? 'json';
    this.theme = options.theme ?? this.theme;

    const desiredStorage = options.storage ?? 'memory';
    if (desiredStorage === 'localStorage' && canUseLocalStorage()) {
      this.storage = createLocalStorage();
      this.storageKind = 'localStorage';
      this.debugLog('using localStorage backend');
    } else {
      if (desiredStorage === 'localStorage') {
        this.debugLog('localStorage unavailable; falling back to memory storage');
      }
      this.storage = createMemoryStorage();
      this.storageKind = 'memory';
    }

    // Load existing comments and render overlay
    this.comments = this.storage.load();
    this.ensureOverlay();
    // Ensure initial visibility matches state
    if (this.overlayElement) this.overlayElement.style.display = this.visible ? '' : 'none';
    this.applyThemeVars();
    this.renderOverlay();
    this.attachKeyHandler();
    this.isEnabled = true;
    this.debugLog('enabled with', this.storageKind, 'storage; comments loaded:', this.comments.length);
  }

  disable(): void {
    this.debugLog('disable() called');
    if (!this.isEnabled) {
      this.debugLog('already disabled; no action taken');
      return;
    }
    this.teardownOverlay();
    this.isEnabled = false;
    this.debugLog('disabled successfully');
  }

  export(): string | object {
    this.debugLog('export() called; format:', this.exportAs, 'count:', this.comments.length);
    if (this.exportAs === 'markdown') {
      return this.toMarkdown(this.comments);
    }
    
    return this.toJson(this.comments);
  }

  // Expose minimal data API for future UI integration
  getAll(): CommentPoint[] {
    this.debugLog('getAll() called; count:', this.comments.length);
    return [...this.comments];
  }

  addComment(comment: Omit<CommentPoint, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): CommentPoint {
    const created: CommentPoint = {
      id: comment.id ?? Math.random().toString(36).slice(2),
      text: comment.text,
      x: comment.x,
      y: comment.y,
      timestamp: comment.timestamp ?? Date.now(),
      nx: comment.nx,
      ny: comment.ny,
      anchor: comment.anchor
    };
    this.comments.push(created);
    this.persist();
    this.renderOverlay();
    this.debugLog('addComment() created:', { id: created.id, x: created.x, y: created.y, text: created.text });
    this.debugLog('total comments after add:', this.comments.length);
    return created;
  }

  clear(): void {
    this.debugLog('clear() called; removing comments:', this.comments.length);
    this.comments = [];
    // Remove storage key entirely instead of saving an empty array
    this.storage.clear();
    this.renderOverlay();
    this.debugLog('all comments cleared');
  }

  deleteById(id: string): void {
    const before = this.comments.length;
    this.comments = this.comments.filter((c) => c.id !== id);
    if (this.comments.length !== before) {
      this.persist();
      this.renderOverlay();
      this.debugLog('deleteById() removed', id);
    }
  }

  openEditorFor(commentId: string): void {
    if (!isBrowser()) return;
    const target = this.comments.find((c) => c.id === commentId);
    if (!target) return;
    this.ensureOverlay();
    this.removeEditor();

    const viewportX = target.x - window.scrollX;
    const viewportY = target.y - window.scrollY;

    const editor = document.createElement('div');
    editor.setAttribute('data-prototype-comment-editor', '');
    editor.style.position = 'absolute';
    editor.style.left = `${viewportX}px`;
    editor.style.top = `${viewportY}px`;
    editor.style.transform = 'translate(-50%, -50%)';
    editor.style.background = 'var(--pc-bg, rgba(255,255,255,0.95))';
    editor.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    editor.style.borderRadius = '16px';
    editor.style.padding = '12px';
    editor.style.minWidth = 'var(--prototype-comments-min-width, 520px)';
    editor.style.maxWidth = 'var(--prototype-comments-max-width, 520px)';
    editor.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
    editor.style.pointerEvents = 'auto';
    editor.style.display = 'flex';
    editor.style.flexDirection = 'column';
    editor.style.gap = '8px';
    editor.style.zIndex = '2147483647';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Edit comment…';
    textarea.value = target.text;
    textarea.style.resize = 'none';
    textarea.style.width = '100%';
    textarea.style.background = 'var(--pc-bg, rgba(255,255,255,0.95))';
    textarea.style.height = '72px';
    textarea.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    textarea.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    textarea.style.borderRadius = '8px';
    textarea.style.padding = '8px';
    textarea.style.boxSizing = 'border-box';
    textarea.style.outline = 'none';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';

    const discardBtn = document.createElement('button');
    discardBtn.textContent = 'Discard changes';
    discardBtn.style.cursor = 'pointer';
    discardBtn.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    discardBtn.style.borderRadius = '8px';
    discardBtn.style.padding = '6px 12px';
    discardBtn.style.background = 'var(--pc-bg, rgba(255,255,255,0.85))';
    discardBtn.style.color = 'var(--pc-text, #111827)';
    discardBtn.style.font = '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Edit';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    saveBtn.style.borderRadius = '8px';
    saveBtn.style.padding = '6px 12px';
    saveBtn.style.background = '#111827';
    saveBtn.style.color = 'white';
    saveBtn.style.font = '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    const submit = (): void => {
      const next = textarea.value.trim();
      if (next.length === 0) {
        this.debugLog('openEditorFor() submit ignored; empty text');
        return;
      }
      // Update text only; retain original timestamp and position
      const idx = this.comments.findIndex((c) => c.id === commentId);
      if (idx >= 0) {
        this.comments[idx] = { ...this.comments[idx], text: next };
        this.persist();
        this.renderOverlay();
      }
      this.removeEditor();
    };

    discardBtn.addEventListener('click', () => {
      this.removeEditor();
    });
    saveBtn.addEventListener('click', submit);
    textarea.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.removeEditor();
      }
    });

    actions.appendChild(discardBtn);
    actions.appendChild(saveBtn);
    editor.appendChild(textarea);
    editor.appendChild(actions);
    editor.addEventListener('click', (ev) => ev.stopPropagation());

    this.editorElement = editor;
    if (this.overlayElement) this.overlayElement.appendChild(editor);
    setTimeout(() => textarea.focus(), 0);
  }
  beginCommentAt(x: number, y: number, options?: { anchor?: Element | string }): void {
    this.debugLog('beginCommentAt() at', { x, y });
    if (!isBrowser()) return;
    this.ensureOverlay();
    this.removeEditor();

    const editor = document.createElement('div');
    editor.setAttribute('data-prototype-comment-editor', '');
    editor.style.position = 'absolute';
    editor.style.left = `${x}px`;
    editor.style.top = `${y}px`;
    editor.style.transform = 'translate(-50%, -50%)';
    editor.style.background = 'var(--pc-bg, rgba(255,255,255,0.85))';
    editor.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    editor.style.borderRadius = '16px';
    editor.style.padding = '12px';
    editor.style.minWidth = 'var(--prototype-comments-min-width, 400px)';
    editor.style.maxWidth = 'var(--prototype-comments-max-width, 400px)';
    editor.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
    editor.style.pointerEvents = 'auto';
    editor.style.display = 'flex';
    editor.style.flexDirection = 'column';
    editor.style.gap = '8px';
    editor.style.zIndex = '2147483647';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment…';
    textarea.style.resize = 'none';
    textarea.style.width = '100%';
    textarea.style.height = '72px';
    textarea.style.background = 'var(--pc-bg, rgba(255,255,255,0.55))';
    textarea.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    textarea.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    textarea.style.borderRadius = '8px';
    textarea.style.padding = '8px';
    textarea.style.boxSizing = 'border-box';
    textarea.style.outline = 'none';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.padding = '6px 12px';
    cancelBtn.style.background = 'var(--pc-bg, rgba(255,255,255,0.85))';
    cancelBtn.style.color = 'var(--pc-text, #111827)';
    cancelBtn.style.font = '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cursor = 'pointer';
    addBtn.style.border = '1px solid var(--pc-border-color, rgba(0,0,0,0.25))';
    addBtn.style.borderRadius = '8px';
    addBtn.style.padding = '6px 12px';
    addBtn.style.background = '#111827';
    addBtn.style.color = 'white';
    addBtn.style.font = '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    // Match Confirm button hover/active behaviors
    addBtn.addEventListener('mouseenter', () => {
      addBtn.style.background = '#111827';
      addBtn.style.color = 'white';
    });
    addBtn.addEventListener('mouseleave', () => {
      addBtn.style.background = '#111827';
      addBtn.style.color = 'white';
    });
    addBtn.addEventListener('mousedown', () => {
      addBtn.style.transform = 'scale(0.98)';
    });
    addBtn.addEventListener('mouseup', () => {
      addBtn.style.transform = 'translateZ(0)';
    });

    const submit = (): void => {
      const text = textarea.value.trim();
      if (text.length === 0) {
        this.debugLog('beginCommentAt() submit ignored; empty text');
        return;
      }
      // Determine current editor center in viewport, then convert to page coords
      const currentVX = parseFloat(editor.style.left);
      const currentVY = parseFloat(editor.style.top);
      this.removeEditor();
      const pageX = currentVX + (isBrowser() ? window.scrollX : 0);
      const pageY = currentVY + (isBrowser() ? window.scrollY : 0);
      // Capture normalized position relative to current viewport dimensions
      const vw = isBrowser() ? Math.max(1, window.innerWidth) : 1;
      const vh = isBrowser() ? Math.max(1, window.innerHeight) : 1;
      const nx = pageX / vw;
      const ny = pageY / vh;
      // Element anchoring (fallback to element under the editor center)
      let anchor: CommentPoint['anchor'] | undefined;
      if (isBrowser()) {
        let el: Element | null = null;
        if (options?.anchor) {
          el = typeof options.anchor === 'string' ? document.querySelector(options.anchor) : (options.anchor as Element);
        } else {
          const previous = editor.style.pointerEvents;
          editor.style.pointerEvents = 'none';
          try {
            el = document.elementFromPoint(currentVX, currentVY);
          } finally {
            editor.style.pointerEvents = previous;
          }
        }
        if (el && (el as HTMLElement).closest('[data-prototype-comments-overlay]')) {
          el = el.parentElement;
        }
        if (el) {
          const rect = el.getBoundingClientRect();
          const rx = rect.width > 0 ? (currentVX - rect.left) / rect.width : 0.5;
          const ry = rect.height > 0 ? (currentVY - rect.top) / rect.height : 0.5;
          const path = this.getElementPath(el);
          anchor = { path, rx: Math.min(Math.max(rx, 0), 1), ry: Math.min(Math.max(ry, 0), 1) };
        }
      }
      this.addComment({ text, x: pageX, y: pageY, nx, ny, anchor });
    };

    cancelBtn.addEventListener('click', () => {
      this.debugLog('beginCommentAt() cancelled');
      this.removeEditor();
    });
    addBtn.addEventListener('click', submit);
    textarea.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.removeEditor();
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(addBtn);
    editor.appendChild(textarea);
    editor.appendChild(actions);

  // Drag handle for editor (top-right)
  const handle = document.createElement('div');
  handle.setAttribute('data-prototype-comment-handle', '');
  handle.title = 'Drag to move';
  handle.style.position = 'absolute';
  handle.style.top = '6px';
  handle.style.right = '6px';
  handle.style.width = '12px';
  handle.style.height = '12px';
  handle.style.borderRadius = '3px';
  handle.style.background = '#e5e7eb';
  handle.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.15)';
  handle.style.cursor = 'grab';
  handle.style.pointerEvents = 'auto';

  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const onMove = (ev: MouseEvent) => {
    if (!dragging) return;
    const mx = ev.clientX;
    const my = ev.clientY;
    const newVX = mx - dragOffsetX;
    const newVY = my - dragOffsetY;
    editor.style.left = `${newVX}px`;
    editor.style.top = `${newVY}px`;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    handle.style.cursor = 'grab';
  };
  handle.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    dragging = true;
    handle.style.cursor = 'grabbing';
    const currentVX = parseFloat(editor.style.left);
    const currentVY = parseFloat(editor.style.top);
    const mx = (ev as MouseEvent).clientX;
    const my = (ev as MouseEvent).clientY;
    dragOffsetX = mx - currentVX;
    dragOffsetY = my - currentVY;
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
  });

  editor.appendChild(handle);

    // Stop propagation so clicks within the editor don't trigger page-level handlers
    editor.addEventListener('click', (ev) => ev.stopPropagation());

    this.editorElement = editor;
    if (this.overlayElement) {
      this.overlayElement.appendChild(editor);
    }
    // Focus after append to ensure iOS/macOS brings caret
    setTimeout(() => textarea.focus(), 0);
  }

  private removeEditor(): void {
    if (!this.editorElement) return;
    const parent = this.editorElement.parentElement;
    if (parent) parent.removeChild(this.editorElement);
    this.editorElement = null;
  }

  private persist(): void {
    this.debugLog('persist() saving to', this.storageKind, 'count:', this.comments.length);
    this.storage.save(this.comments);
  }

  private ensureOverlay(): void {
    if (!isBrowser()) return;
    if (this.overlayElement) return;
    const overlay = document.createElement('div');
    overlay.setAttribute('data-prototype-comments-overlay', '');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    overlay.style.display = this.visible ? '' : 'none';
    document.body.appendChild(overlay);
    this.overlayElement = overlay;
    this.debugLog('overlay created');
    this.attachHoverTracking();
    this.attachViewportHandlers();
  }

  private teardownOverlay(): void {
    if (!this.overlayElement) return;
    const parent = this.overlayElement.parentElement;
    if (parent) parent.removeChild(this.overlayElement);
    this.overlayElement = null;
    this.debugLog('overlay removed');
    this.detachHoverTracking();
    this.detachViewportHandlers();
    this.detachKeyHandler();
  }

  private renderOverlay(): void {
    if (!this.overlayElement) return;
    const container = this.overlayElement;
    container.innerHTML = '';

    for (const comment of this.comments) {
      const bubble = document.createElement('div');
      bubble.setAttribute('data-prototype-comment', comment.id);
      bubble.title = comment.text;
      bubble.style.position = 'absolute';
      bubble.style.transform = 'translate(-50%, -100%) scale(0.9)';
      // Compute viewport coords from anchor element if present, else fall back to absolute page coords
      let vx: number;
      let vy: number;
      const usedAnchor = comment.anchor && isBrowser();
      if (usedAnchor) {
        const el = this.resolveElementByPath(comment.anchor!.path);
        if (el) {
          const rect = el.getBoundingClientRect();
          vx = rect.left + comment.anchor!.rx * rect.width;
          vy = rect.top + comment.anchor!.ry * rect.height;
        } else {
          vx = comment.x - window.scrollX;
          vy = comment.y - window.scrollY;
        }
      } else {
        vx = comment.x - (isBrowser() ? window.scrollX : 0);
        vy = comment.y - (isBrowser() ? window.scrollY : 0);
      }
      bubble.style.left = `${vx}px`;
      bubble.style.top = `${vy}px`;
      // Base visuals (start collapsed as a 48x48 circle)
      bubble.style.font = '13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      bubble.style.background = 'var(--pc-collapsed-bg, rgba(255,255,255,0.85))';
      bubble.style.border = '4px solid var(rgba(0,0,0,0.5))';
      bubble.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
      bubble.style.pointerEvents = 'none';
      bubble.style.color = 'var(--pc-text, #111827)';
      bubble.style.overflow = 'hidden';
      bubble.style.width = '24px';
      bubble.style.height = '24px';
      bubble.style.minWidth = '24px';
      bubble.style.maxWidth = '24px';
      bubble.style.borderRadius = '9999px';
      bubble.style.padding = '0';
      bubble.style.transition = 'min-width 50ms cubic-bezier(0.22, 1, 0.36, 1), max-width 50ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), height 420ms cubic-bezier(0.22, 1, 0.36, 1), padding 420ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 150ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
      (bubble as any).dataset.state = 'collapsed';
      (bubble as any).dataset.x = String(comment.x);
      (bubble as any).dataset.y = String(comment.y);

      // Timestamp (top)
      const metaLine = document.createElement('div');
      metaLine.style.fontSize = '11px';
      metaLine.style.color = '#555';
      metaLine.textContent = this.formatTimestamp(comment.timestamp);
      metaLine.setAttribute('data-prototype-comment-meta', '');
      metaLine.style.opacity = '0';
      metaLine.style.maxHeight = '0px';
      metaLine.style.marginBottom = '0px';
      metaLine.style.overflow = 'hidden';
      metaLine.style.transform = 'translateY(-2px)';
      metaLine.style.transition = 'opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), max-height 420ms cubic-bezier(0.22, 1, 0.36, 1), margin-bottom 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
      metaLine.style.display = 'none';

      // Text (middle)
      const textLine = document.createElement('div');
      textLine.setAttribute('data-prototype-comment-text', '');
      textLine.style.whiteSpace = 'nowrap';
      textLine.style.textOverflow = 'ellipsis';
      textLine.style.overflow = 'hidden';
      textLine.textContent = comment.text;
      textLine.style.display = 'none';
      textLine.style.paddingBottom = '4px';
      textLine.style.paddingTop = '2px';
      textLine.style.opacity = '0';
      textLine.style.transform = 'translateY(2px)';
      // TEXT TRANSITION: tweak duration/curve for text fade/slide
      // Keep this in sync with the bubble transition above for a unified feel
      textLine.style.transition = 'opacity 250ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';

      // Actions (bottom)
      const actionsLine = document.createElement('div');
      actionsLine.setAttribute('data-prototype-comment-actions', '');
      actionsLine.style.display = 'flex';
      actionsLine.style.gap = '8px';
      actionsLine.style.fontSize = '11px';
      actionsLine.style.color = '#1f2937';
      actionsLine.style.opacity = '0';
      actionsLine.style.maxHeight = '0px';
      actionsLine.style.marginTop = '0px';
  
      actionsLine.style.overflow = 'hidden';
      actionsLine.style.transform = 'translateY(2px)';
      actionsLine.style.transition = 'opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), max-height 420ms cubic-bezier(0.22, 1, 0.36, 1), margin-top 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
      actionsLine.style.pointerEvents = 'auto';
      actionsLine.style.display = 'none';

      const linkStyle = (el: HTMLAnchorElement) => {
        el.href = '#';
        el.style.color = '#2563eb';
        el.style.textDecoration = 'none';
        el.style.cursor = 'pointer';
      };
      const editLink = document.createElement('a');
      editLink.textContent = 'Edit';
      linkStyle(editLink);
      editLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.openEditorFor(comment.id);
      });
      const deleteLink = document.createElement('a');
      deleteLink.textContent = 'Delete';
      linkStyle(deleteLink);
      deleteLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.deleteById(comment.id);
      });
      actionsLine.appendChild(editLink);
      actionsLine.appendChild(deleteLink);

      // Drag handle (top-right)
      const handle = document.createElement('div');
      handle.setAttribute('data-prototype-comment-handle', '');
      handle.title = 'Drag to move';
      handle.style.position = 'absolute';
      handle.style.top = '6px';
      handle.style.right = '6px';
      handle.style.width = '12px';
      handle.style.height = '12px';
      handle.style.borderRadius = '3px';
      handle.style.background = '#e5e7eb';
      handle.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.15)';
      handle.style.cursor = 'grab';
      handle.style.opacity = '0';
      handle.style.transition = 'opacity 120ms ease';
      handle.style.pointerEvents = 'auto';
      handle.style.display = 'none';

      let dragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging) return;
        // Current mouse viewport coords
        const mx = ev.clientX;
        const my = ev.clientY;
        // Anchor viewport coords applying initial offset
        const anchorVX = mx - dragOffsetX;
        const anchorVY = my - dragOffsetY;
        bubble.style.left = `${anchorVX}px`;
        bubble.style.top = `${anchorVY}px`;
      };

      const onMouseUp = (ev: MouseEvent) => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        handle.style.cursor = 'grab';
        // Compute final page coordinates and persist
        const finalVX = parseFloat(bubble.style.left);
        const finalVY = parseFloat(bubble.style.top);
        const finalPX = finalVX + (isBrowser() ? window.scrollX : 0);
        const finalPY = finalVY + (isBrowser() ? window.scrollY : 0);
        const idx = this.comments.findIndex((c) => c.id === comment.id);
        if (idx >= 0) {
          const vw = isBrowser() ? Math.max(1, window.innerWidth) : 1;
          const vh = isBrowser() ? Math.max(1, window.innerHeight) : 1;
          this.comments[idx] = { ...this.comments[idx], x: finalPX, y: finalPY, nx: finalPX / vw, ny: finalPY / vh };
          this.persist();
          // Re-render to refresh hover targets/handles
          this.renderOverlay();
        }
      };

      handle.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        dragging = true;
        handle.style.cursor = 'grabbing';
        // Current anchor viewport position is bubble.style left/top
        const currentVX = parseFloat(bubble.style.left);
        const currentVY = parseFloat(bubble.style.top);
        // Mouse position and offset to preserve relative grab point
        const mx = (ev as MouseEvent).clientX;
        const my = (ev as MouseEvent).clientY;
        dragOffsetX = mx - currentVX;
        dragOffsetY = my - currentVY;
        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('mouseup', onMouseUp);
      });

      bubble.appendChild(metaLine);
      bubble.appendChild(textLine);
      bubble.appendChild(actionsLine);
      bubble.appendChild(handle);
      container.appendChild(bubble);
    }
    // Re-attach editor if present
    if (this.editorElement) {
      container.appendChild(this.editorElement);
    }
    this.debugLog('renderOverlay() rendered markers:', this.comments.length);
  }

  private toJson(comments: CommentPoint[]): object {
    return comments.map((c) => ({ id: c.id, text: c.text, x: c.x, y: c.y, timestamp: c.timestamp }));
  }

  private toMarkdown(comments: CommentPoint[]): string {
    if (comments.length === 0) return '';
    const lines = ['# Comments', ''];
    for (const c of comments) {
      const when = new Date(c.timestamp).toISOString();
      lines.push(`- (${c.x}, ${c.y}) ${this.escapeMarkdown(c.text)} — ${when}`);
    }
    return lines.join('\n');
  }

  private escapeMarkdown(input: string): string {
    return input.replace(/[\\`*_{}\[\]()#+\-.!|]/g, (m) => `\\${m}`);
  }

  private previewText(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length <= 40) return trimmed;
    return trimmed.slice(0, 37) + '…';
  }

  private formatTimestamp(ts: number): string {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return new Date(ts).toISOString();
    }
  }

  private attachHoverTracking(): void {
    if (this.hoverHandler || !isBrowser()) return;
    this.hoverHandler = (ev: MouseEvent) => {
      if (!this.overlayElement) return;
      const mx = ev.clientX;
      const my = ev.clientY;
      const bubbles = this.overlayElement.querySelectorAll('[data-prototype-comment]') as NodeListOf<HTMLDivElement>;
      for (const bubble of bubbles) {
        const rect = bubble.getBoundingClientRect();
        const inside = mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
        const meta = bubble.querySelector('[data-prototype-comment-meta]') as HTMLDivElement | null;
        const actions = bubble.querySelector('[data-prototype-comment-actions]') as HTMLDivElement | null;
        const text = bubble.querySelector('[data-prototype-comment-text]') as HTMLDivElement | null;
        // Proximity-based expand/collapse (show contents when cursor is near)
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(mx - cx, my - cy);
        const near = dist <= 256;

        if (near) {
          // Expanded container sizing
          bubble.style.minWidth = 'var(--prototype-comments-min-width, 250px)';
          bubble.style.minHeight = 'var(--prototype-comments-min-height, 24px)';
          bubble.style.maxWidth = 'var(--prototype-comments-max-width, 400px)';
          bubble.style.width = '';
          bubble.style.height = '';
          bubble.style.borderRadius = '16px';
          bubble.style.padding = '8px 12px';
          bubble.style.background = 'var(--pc-bg, rgba(255,255,255,0.85))';
          bubble.style.transform = 'translate(-50%, -100%) scale(1)';
          // Cancel any pending collapse
          const pending = this.collapseTimers.get(bubble);
          if (pending) {
            clearTimeout(pending);
            this.collapseTimers.delete(bubble);
          }
          // Show text only after expansion completes
          const state = (bubble as any).dataset.state;
          if (state !== 'expanded') {
            (bubble as any).dataset.state = 'expanding';
            if (text) text.style.display = 'none';
            // TEXT REVEAL: Only show text after the container's expand transition completes
            const onEnd = (e: any) => {
              if (e && e.target !== bubble) return;
              const pn = e?.propertyName as string | undefined;
              if (pn && pn !== 'transform' && pn !== 'width' && pn !== 'max-width' && pn !== 'min-width') return;
              if ((bubble as any).dataset.state === 'expanding') {
                (bubble as any).dataset.state = 'expanded';
                if (text) {
                  text.style.display = 'block';
                  text.style.whiteSpace = 'normal';
                  text.style.textOverflow = 'clip';
                  text.style.overflow = 'visible';
                  text.style.opacity = '0';
                  text.style.transform = 'translateY(2px)';
                  // Force a reflow so the browser registers the starting state before transitioning
                  void (text as any).offsetWidth;
                  requestAnimationFrame(() => {
                    text.style.opacity = '1';
                    text.style.transform = 'translateY(0)';
                  });
                }
              }
              bubble.removeEventListener('transitionend', onEnd as any);
            };
            bubble.addEventListener('transitionend', onEnd as any);
          } else if (text) {
            // Already expanded; ensure visible
            text.style.display = 'block';
            text.style.whiteSpace = 'normal';
            text.style.textOverflow = 'clip';
            text.style.overflow = 'visible';
            text.style.opacity = '1';
            text.style.transform = 'translateY(0)';
          }
        } else {
          // Schedule a short delay before collapsing to avoid abrupt shrink
          if (!this.collapseTimers.has(bubble)) {
            const timer = window.setTimeout(() => {
              // Collapsed container sizing
              bubble.style.width = '24px';
              bubble.style.height = '24px';
              bubble.style.minWidth = '24px';
              bubble.style.maxWidth = '24px';
              bubble.style.borderRadius = '9999px';
              bubble.style.padding = '0';
              bubble.style.transform = 'translate(-50%, -100%) scale(0.9)';
              (bubble as any).dataset.state = 'collapsed';
              if (text) {
                // fade out then hide to avoid jumpiness
                text.style.opacity = '0';
                text.style.transform = 'translateY(2px)';
                const hide = () => {
                  if ((bubble as any).dataset.state === 'collapsed') text.style.display = 'none';
                  text.removeEventListener('transitionend', hide);
                };
                text.addEventListener('transitionend', hide);
                text.style.whiteSpace = 'nowrap';
                text.style.textOverflow = 'ellipsis';
                text.style.overflow = 'hidden';
              }
              this.collapseTimers.delete(bubble);
            }, 220);
            this.collapseTimers.set(bubble, timer);
          }
        }

        if (meta) {
          if (inside) {
            meta.style.display = '';
            meta.style.opacity = '1';
            meta.style.maxHeight = '20px';
            meta.style.marginBottom = '2px';
            meta.style.transform = 'translateY(0)';
          } else {
            meta.style.opacity = '0';
            meta.style.maxHeight = '0px';
            meta.style.marginBottom = '0px';
            meta.style.transform = 'translateY(-2px)';
            const hide = () => { if (!inside) meta.style.display = 'none'; meta.removeEventListener('transitionend', hide); };
            meta.addEventListener('transitionend', hide);
          }
        }
        if (actions) {
          if (inside) {
            actions.style.display = 'flex';
            actions.style.opacity = '1';
            actions.style.maxHeight = '18px';
            actions.style.marginTop = '4px';
            actions.style.transform = 'translateY(0)';
          } else {
            actions.style.opacity = '0';
            actions.style.maxHeight = '0px';
            actions.style.marginTop = '0px';
            actions.style.transform = 'translateY(2px)';
            const hide = () => { if (!inside) actions.style.display = 'none'; actions.removeEventListener('transitionend', hide); };
            actions.addEventListener('transitionend', hide);
          }
        }
        // text visibility is controlled by proximity (near) above
        // Show drag handle on hover
        const handle = bubble.querySelector('[data-prototype-comment-handle]') as HTMLDivElement | null;
        if (handle) {
          handle.style.opacity = inside ? '1' : '0';
          handle.style.display = inside ? '' : 'none';
        }
      }
    };
    window.addEventListener('mousemove', this.hoverHandler, { passive: true });
  }

  private detachHoverTracking(): void {
    if (!this.hoverHandler) return;
    window.removeEventListener('mousemove', this.hoverHandler as EventListener);
    this.hoverHandler = null;
  }

  private attachViewportHandlers(): void {
    if (this.viewportHandler || !isBrowser()) return;
    this.viewportHandler = () => {
      this.renderOverlay();
    };
    window.addEventListener('scroll', this.viewportHandler, { passive: true });
    window.addEventListener('resize', this.viewportHandler, { passive: true });
  }

  private detachViewportHandlers(): void {
    if (!this.viewportHandler) return;
    window.removeEventListener('scroll', this.viewportHandler);
    window.removeEventListener('resize', this.viewportHandler);
    this.viewportHandler = null;
  }

  // Serialize a robust path for an element for later resolution
  private getElementPath(el: Element): string {
    // Prefer stable id
    if ((el as HTMLElement).id) return `#${(el as HTMLElement).id}`;
    // Build CSS selector path with tag and nth-child
    const path: string[] = [];
    let node: Element | null = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      const tag = node.tagName.toLowerCase();
      let selector = tag;
      if ((node as HTMLElement).classList.length) {
        selector += '.' + Array.from((node as HTMLElement).classList).slice(0, 2).join('.');
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
        const index = siblings.indexOf(node) + 1;
        selector += `:nth-of-type(${index})`;
      }
      path.unshift(selector);
      node = node.parentElement;
    }
    return path.join(' > ');
  }

  private resolveElementByPath(path: string): Element | null {
    if (!isBrowser() || !path) return null;
    try {
      if (path.startsWith('#')) return document.querySelector(path);
      return document.querySelector(path);
    } catch {
      return null;
    }
  }

  private attachKeyHandler(): void {
    if (this.keyHandler || !isBrowser()) return;
    this.keyHandler = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase?.();
      const code = (e as any).code as string | undefined;
      if (!key && !code) return;
      // Ignore when typing in inputs/textareas/contenteditable
      const isEditable = (el: EventTarget | null): boolean => {
        const node = el as Node | null;
        const element = node && node.nodeType === 3 ? (node.parentElement as HTMLElement | null) : (node as HTMLElement | null);
        if (!element) return false;
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return true;
        let cur: HTMLElement | null = element;
        while (cur) { if (cur.isContentEditable) return true; cur = cur.parentElement; }
        return false;
      };
      if (isEditable(e.target)) return;
      const isShiftC = (e.shiftKey && (key === 'c' || code === 'KeyC')) === true;
      if (isShiftC) {
        this.toggleVisibility();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    document.addEventListener('keydown', this.keyHandler);
  }

  private detachKeyHandler(): void {
    if (!this.keyHandler) return;
    window.removeEventListener('keydown', this.keyHandler as EventListener);
    document.removeEventListener('keydown', this.keyHandler as EventListener);
    this.keyHandler = null;
  }

  // Visibility controls
  isVisible(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
    if (this.overlayElement) this.overlayElement.style.display = '';
    try {
      window.dispatchEvent(new CustomEvent('prototype-comments:visibility', { detail: { visible: true } }));
    } catch {}
  }

  hide(): void {
    this.visible = false;
    if (this.overlayElement) this.overlayElement.style.display = 'none';
    try {
      window.dispatchEvent(new CustomEvent('prototype-comments:visibility', { detail: { visible: false } }));
    } catch {}
  }

  toggleVisibility(): void {
    this.visible ? this.hide() : this.show();
  }
}

const commentManagerSingleton = new CommentManager();

export function enableComments(options?: EnableOptions): void {
  commentManagerSingleton.enable(options);
}

export function disableComments(): void {
  commentManagerSingleton.disable();
}

export function exportComments(): string | object {
  return commentManagerSingleton.export();
}

export function setCommentsDebug(enabled: boolean): void {
  commentManagerSingleton.setDebug(enabled);
}

export function isCommentsEnabled(): boolean {
  // lightweight status helper for consumers
  return (commentManagerSingleton as unknown as { isEnabled: boolean }).isEnabled === true;
}

// Drop-in controls (Export / Clear / Visibility)
export function mountCommentControls(): () => void {
  if (!isBrowser()) return () => {};
  const existing = document.querySelector('[data-prototype-comments-controls]') as HTMLDivElement | null;
  if (existing) return () => { const p = existing.parentElement; if (p) p.removeChild(existing); };

  const container = document.createElement('div');
  container.setAttribute('data-prototype-comments-controls', '');
  container.style.position = 'fixed';
  container.style.left = '50%';
  container.style.bottom = '20px';
  container.style.transform = 'translateX(-50%)';
  container.style.zIndex = '2147483647';
  container.style.display = 'flex';
  container.style.gap = '8px';
  container.style.alignItems = 'center';
  container.style.background = 'rgba(255,255,255,0.1)';
  container.style.backdropFilter = 'saturate(180%) blur(8px)';
  container.style.border = '1px solid rgba(0,0,0,0.25)';
  container.style.borderRadius = '16px';
  container.style.padding = '8px 8px';
  container.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';

  const mkBtn = (label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cursor = 'pointer';
    btn.style.border = '1px solid rgba(0,0,0,0.25)';
    btn.style.borderRadius = '8px';
    btn.style.padding = '8px 12px';
    btn.style.background = 'rgba(255,255,255,0.6)';
    btn.style.color = '#111827';
    btn.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
    btn.style.transition = 'background-color 150ms ease, box-shadow 150ms ease, transform 120ms ease, border-color 150ms ease, color 150ms ease';
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#f9fafb';
      btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.6)';
      btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
    });
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.98)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'translateZ(0)';
    });
    return btn;
  };

  // Add Comment (keyboard: C)
  const addBtn = mkBtn('Add comment (C)');
  addBtn.title = 'Shortcut: C';
  let createMode = false;
  const renderCreate = () => {
    addBtn.textContent = createMode ? 'Click to place… (C)' : 'Add comment (C)';
    const cursor = createMode ? 'crosshair' : '';
    document.body.style.cursor = cursor;
    (document.documentElement as HTMLElement).style.cursor = cursor;
    const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
    if (overlay) overlay.style.cursor = cursor;
  };
  const cancelCreate = () => {
    if (!createMode) return;
    createMode = false;
    renderCreate();
    document.removeEventListener('click', onCreateClick, true);
  };
  const onCreateClick = (event: MouseEvent) => {
    if (!createMode) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.closest('[data-prototype-comments-controls]') || target.closest('[data-prototype-comment-editor]'))) return;
    const x = event.clientX;
    const y = event.clientY;
    commentManagerSingleton.beginCommentAt(x, y);
    cancelCreate();
  };
  addBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    createMode = !createMode;
    renderCreate();
    if (createMode) {
      document.addEventListener('click', onCreateClick, true);
    } else {
      document.removeEventListener('click', onCreateClick, true);
    }
  });
  renderCreate();

  // Visibility toggle
  const visBtn = mkBtn('Hide comments (Shift+C)');
  visBtn.title = 'Shortcut: Shift+C';
  const renderVis = () => {
    visBtn.textContent = commentManagerSingleton.isVisible() ? 'Hide comments (Shift+C)' : 'Show comments (Shift+C)';
  };
  renderVis();
  visBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    commentManagerSingleton.toggleVisibility();
    renderVis();
    renderVisibilityState();
  });

  // Clear (2-step)
  const clearBtn = mkBtn('Clear');
  const confirmBtn = mkBtn('Confirm');
  confirmBtn.style.background = '#111827';
  confirmBtn.style.color = 'white';
  confirmBtn.style.display = 'none';
  // Keep confirm button high-contrast even on hover/active
  confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.background = '#111827';
    confirmBtn.style.color = 'white';
  });
  confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.background = '#111827';
    confirmBtn.style.color = 'white';
  });
  confirmBtn.addEventListener('mousedown', () => {
    confirmBtn.style.transform = 'scale(0.98)';
  });
  confirmBtn.addEventListener('mouseup', () => {
    confirmBtn.style.transform = 'translateZ(0)';
  });
  const cancelBtn = mkBtn('Cancel');
  cancelBtn.style.display = 'none';
  let confirming = false;
  const setConfirming = (v: boolean) => {
    confirming = v;
    renderVisibilityState();
    renderVis();
  };
  clearBtn.addEventListener('click', (ev) => { ev.stopPropagation(); setConfirming(true); });
  cancelBtn.addEventListener('click', (ev) => { ev.stopPropagation(); setConfirming(false); });
  confirmBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    commentManagerSingleton.clear();
    setConfirming(false);
  });

  // Export with simple dropdown
  const exportWrap = document.createElement('div');
  exportWrap.style.position = 'relative';
  const exportBtn = mkBtn('Export Comments');
  const menu = document.createElement('div');
  menu.style.position = 'absolute';
  menu.style.right = '0';
  menu.style.bottom = '42px';
  menu.style.display = 'none';
  menu.style.background = 'rgba(255,255,255,0.98)';
  menu.style.border = '1px solid rgba(0,0,0,0.12)';
  menu.style.borderRadius = '12px';
  menu.style.padding = '8px';
  menu.style.minWidth = '200px';
  menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';

  const menuBtn = (label: string) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.width = '100%';
    b.style.textAlign = 'left';
    b.style.cursor = 'pointer';
    b.style.border = 'none';
    b.style.borderRadius = '8px';
    b.style.padding = '8px 10px';
    b.style.background = 'transparent';
    b.style.color = '#111827';
    b.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    b.addEventListener('mouseenter', () => { b.style.background = '#f3f4f6'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
    return b;
  };

  const jsonBtn = menuBtn('Export JSON');
  const mdBtn = menuBtn('Export Markdown');
  const cancelExp = menuBtn('Cancel');
  // Swap colors: light background, dark text
  cancelExp.style.background = 'white';
  cancelExp.style.color = '#111827';
  // Keep swapped colors on hover/active
  cancelExp.addEventListener('mouseenter', () => {
    cancelExp.style.background = 'white';
    cancelExp.style.color = '#111827';
  });
  cancelExp.addEventListener('mouseleave', () => {
    cancelExp.style.background = 'white';
    cancelExp.style.color = '#111827';
  });
  cancelExp.addEventListener('mousedown', () => {
    cancelExp.style.transform = 'scale(0.98)';
  });
  cancelExp.addEventListener('mouseup', () => {
    cancelExp.style.transform = 'translateZ(0)';
  });

  const toggleMenu = () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
  exportBtn.addEventListener('click', (ev) => { ev.stopPropagation(); toggleMenu(); });
  jsonBtn.addEventListener('click', () => {
    const data = commentManagerSingleton.export();
    const content = Array.isArray(data) ? data : data; // if configured md, still allow download
    download(content);
    menu.style.display = 'none';
  });
  mdBtn.addEventListener('click', () => {
    const data = commentManagerSingleton.export();
    if (typeof data === 'string') download(data); else {
      const lines: string[] = [];
      const arr = data as any[];
      if (arr.length) {
        lines.push('# Comments', '');
        for (const c of arr) {
          const when = new Date(c.timestamp).toISOString();
          lines.push(`- (${c.x}, ${c.y}) ${String(c.text).replace(/[\\`*_{}\[\]()#+\-.!|]/g, (m) => `\\${m}`)} — ${when}`);
        }
      }
      download(lines.join('\n'));
    }
    menu.style.display = 'none';
  });
  cancelExp.addEventListener('click', () => { menu.style.display = 'none'; });
  menu.appendChild(jsonBtn);
  menu.appendChild(mdBtn);
  const sep = document.createElement('div'); sep.style.height = '8px'; menu.appendChild(sep);
  menu.appendChild(cancelExp);
  exportWrap.appendChild(exportBtn);
  exportWrap.appendChild(menu);

  // Download helper
  function download(content: string | object): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let blob: Blob; let filename: string;
    if (typeof content === 'string') { blob = new Blob([content], { type: 'text/markdown;charset=utf-8' }); filename = `comments-${stamp}.md`; }
    else { const json = JSON.stringify(content, null, 2); blob = new Blob([json], { type: 'application/json;charset=utf-8' }); filename = `comments-${stamp}.json`; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    a.addEventListener('click', (ev) => ev.stopPropagation(), { once: true });
    container.appendChild(a); a.click(); container.removeChild(a); URL.revokeObjectURL(url);
  }

  // Hide controls when comments not visible/enabled
  const renderVisibilityState = () => {
    const isVisible = commentManagerSingleton.isVisible() && isCommentsEnabled();
    // Visibility button: visible unless in confirmation (handled separately below)
    visBtn.style.display = confirming ? 'none' : '';

    if (!isVisible) {
      // Overlay hidden: hide export and all clear states
      exportWrap.style.display = 'none';
      clearBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      confirmBtn.style.display = 'none';
      addBtn.style.display = 'none';
      // ensure create mode is exited when hidden
      cancelCreate();
      return;
    }

    // Overlay visible
    exportWrap.style.display = confirming ? 'none' : '';
    addBtn.style.display = confirming ? 'none' : '';
    if (confirming) {
      clearBtn.style.display = 'none';
      confirmBtn.style.display = '';
      cancelBtn.style.display = '';
    } else {
      clearBtn.style.display = '';
      confirmBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
    }
  };
  renderVisibilityState();

  // Keep controls in sync if visibility is toggled externally or via keyboard
  const onLibVisibility = () => {
    renderVis();
    renderVisibilityState();
    if (!commentManagerSingleton.isVisible()) {
      cancelCreate();
    }
  };
  window.addEventListener('prototype-comments:visibility', onLibVisibility as EventListener);
  // Only handle 'C' for create mode here; Shift+C handled by library
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as Node | null;
      const element = node && node.nodeType === 3 ? (node.parentElement as HTMLElement | null) : (node as HTMLElement | null);
      if (!element) return false;
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return true;
      let cur: HTMLElement | null = element;
      while (cur) { if (cur.isContentEditable) return true; cur = cur.parentElement; }
      return false;
    };
    if (isEditable(e.target)) return;
    if (key === 'c' && !e.shiftKey) {
      createMode = !createMode;
      renderCreate();
      if (createMode) document.addEventListener('click', onCreateClick, true);
      else document.removeEventListener('click', onCreateClick, true);
    }
  });

  container.appendChild(addBtn);
  container.appendChild(exportWrap);
  container.appendChild(clearBtn);
  container.appendChild(confirmBtn);
  container.appendChild(cancelBtn);
  container.appendChild(visBtn);
  document.body.appendChild(container);

  const onWindowClick = (e: MouseEvent) => {
    if (menu.style.display === 'block') menu.style.display = 'none';
  };
  window.addEventListener('click', onWindowClick, true);

  return () => {
    const parent = container.parentElement; if (parent) parent.removeChild(container);
    window.removeEventListener('click', onWindowClick, true);
    window.removeEventListener('prototype-comments:visibility', onLibVisibility as EventListener);
  };
}

export { CommentManager };
export const commentManager = commentManagerSingleton;

// React Controls (optional)
export { PrototypeCommentsControls } from './controls/Controls';

// Theme setter for consumers
export function setCommentsTheme(theme: 'light' | 'dark'): void {
  commentManagerSingleton.setTheme(theme);
}


