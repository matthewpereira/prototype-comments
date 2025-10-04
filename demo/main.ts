import { enableComments, exportComments, commentManager, setCommentsDebug } from '../src/index';

setCommentsDebug(true);
enableComments({ storage: 'memory', exportFormat: 'json', debug: true });

// Seed a few sample markers for demo purposes
commentManager.addComment({ text: 'Hello world', x: 120, y: 160 });
commentManager.addComment({ text: 'Nice prototype!', x: 280, y: 220 });

// Simple interactive demo:
// - Press 'c' to toggle comment creation mode (cursor changes)
// - Click anywhere to add a comment when in creation mode
// - Press 'Shift+c' to toggle visibility of existing comments
// - Press 'e' to export comments to console
// - Press 'd' to toggle enable/disable (removed)

let creationMode = false;
let commentsVisible = true;
let confirmingClear = false;
let exportMenuOpen = false;

function updateCursor(): void {
  const cursor = creationMode ? 'crosshair' : '';
  document.body.style.cursor = cursor;
  (document.documentElement as HTMLElement).style.cursor = cursor;
  const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
  if (overlay) overlay.style.cursor = cursor;
}

function updateVisibility(): void {
  const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
  if (overlay) {
    overlay.style.display = commentsVisible ? '' : 'none';
  }
  const clearContainer = document.querySelector('[data-prototype-comments-clear]') as HTMLDivElement | null;
  if (clearContainer) {
    clearContainer.style.display = commentsVisible ? 'flex' : 'none';
  }
  const exportContainer = document.querySelector('[data-prototype-comments-export]') as HTMLDivElement | null;
  if (exportContainer) {
    exportContainer.style.display = commentsVisible ? 'flex' : 'none';
  }
  const exportMenu = document.querySelector('[data-prototype-comments-export-menu]') as HTMLDivElement | null;
  if (!commentsVisible && exportMenu) {
    exportMenu.style.display = 'none';
    exportMenuOpen = false;
  }
}

document.addEventListener('click', (event) => {
  if (!creationMode) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.closest('[data-prototype-comments-clear]') || target.closest('[data-prototype-comment-editor]') || target.closest('[data-prototype-comments-export]'))) return;
  const x = (event as MouseEvent).clientX;
  const y = (event as MouseEvent).clientY;
  commentManager.beginCommentAt(x, y);
});

window.addEventListener('keydown', (event) => {
  const isEditable = (el: EventTarget | null): boolean => {
    const node = (el as Node | null);
    const element = node && node.nodeType === 3 ? (node.parentElement as HTMLElement | null) : (node as HTMLElement | null);
    if (!element) return false;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return true;
    let cur: HTMLElement | null = element;
    while (cur) {
      if (cur.isContentEditable) return true;
      cur = cur.parentElement;
    }
    return false;
  };
  if (isEditable(event.target)) return;
  const key = event.key.toLowerCase();
  if (key === 'c' && !event.shiftKey) {
    creationMode = !creationMode;
    updateCursor();
    console.log('[prototype-comments demo] creation mode:', creationMode ? 'ON' : 'OFF');
  } else if (key === 'c' && event.shiftKey) {
    commentsVisible = !commentsVisible;
    updateVisibility();
    console.log('[prototype-comments demo] comments visibility:', commentsVisible ? 'VISIBLE' : 'HIDDEN');
  } else if (key === 'e') {
    console.log('[prototype-comments demo] export:', exportComments());
  }
});

// Clear Comments controls (two-stage interaction)
function createClearControls(): void {
  const container = document.createElement('div');
  container.setAttribute('data-prototype-comments-clear', '');
  container.style.position = 'fixed';
  container.style.left = '50%';
  container.style.bottom = '20px';
  container.style.transform = 'translateX(-50%)';
  container.style.zIndex = '2147483647';
  container.style.display = 'flex';
  container.style.gap = '8px';
  container.style.alignItems = 'center';
  container.style.background = 'rgba(255,255,255,0.85)';
  container.style.backdropFilter = 'saturate(180%) blur(8px)';
  container.style.border = '1px solid rgba(0,0,0,0.1)';
  container.style.borderRadius = '9999px';
  container.style.padding = '8px 12px';
  container.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear comments';
  clearBtn.style.cursor = 'pointer';
  clearBtn.style.border = '1px solid #ffffff';
  clearBtn.style.borderRadius = '9999px';
  clearBtn.style.padding = '8px 12px';
  clearBtn.style.background = 'white';
  clearBtn.style.color = '#111827';
  clearBtn.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  clearBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
  clearBtn.style.transition = 'background-color 150ms ease, box-shadow 150ms ease, transform 120ms ease, border-color 150ms ease, color 150ms ease';
  clearBtn.style.transform = 'translateZ(0)';

  // Subtle hover/active interactions
  const clearBase = (): void => {
    clearBtn.style.background = 'white';
    clearBtn.style.color = '#111827';
    clearBtn.style.borderColor = '#e5e7eb';
    clearBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
    clearBtn.style.transform = 'translateZ(0)';
  };
  const clearHover = (): void => {
    clearBtn.style.background = '#f9fafb';
    clearBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
  };
  const clearActive = (): void => {
    clearBtn.style.background = '#f3f4f6';
    clearBtn.style.borderColor = '#d1d5db';
    clearBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.10)';
    clearBtn.style.transform = 'scale(0.98)';
  };

  clearBtn.addEventListener('mouseenter', clearHover);
  clearBtn.addEventListener('mouseleave', clearBase);
  clearBtn.addEventListener('mousedown', clearActive);
  clearBtn.addEventListener('mouseup', clearHover);
  clearBase();

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Are you sure?';
  confirmBtn.style.cursor = 'pointer';
  confirmBtn.style.border = 'none';
  confirmBtn.style.borderRadius = '8px';
  confirmBtn.style.padding = '8px 12px';
  confirmBtn.style.background = '#111827';
  confirmBtn.style.color = 'white';
  confirmBtn.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  confirmBtn.style.display = 'none';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.border = 'none';
  cancelBtn.style.borderRadius = '8px';
  cancelBtn.style.padding = '8px 12px';
  cancelBtn.style.background = '#e5e7eb';
  cancelBtn.style.color = '#111827';
  cancelBtn.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  cancelBtn.style.display = 'none';

  function setConfirming(value: boolean): void {
    confirmingClear = value;
    clearBtn.style.display = value ? 'none' : '';
    confirmBtn.style.display = value ? '' : 'none';
    cancelBtn.style.display = value ? '' : 'none';
  }

  clearBtn.addEventListener('click', () => setConfirming(true));
  cancelBtn.addEventListener('click', () => setConfirming(false));
  confirmBtn.addEventListener('click', () => {
    commentManager.clear();
    setConfirming(false);
  });

  container.appendChild(clearBtn);
  container.appendChild(confirmBtn);
  container.appendChild(cancelBtn);
  document.body.appendChild(container);
}

createClearControls();

// Export control (top-right button triggers download)
function createExportControls(): void {
  const container = document.createElement('div');
  container.setAttribute('data-prototype-comments-export', '');
  container.style.position = 'fixed';
  container.style.top = '16px';
  container.style.right = '16px';
  container.style.zIndex = '2147483647';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-end';

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export';
  exportBtn.style.cursor = 'pointer';
  exportBtn.style.border = '1px solid #e5e7eb';
  exportBtn.style.borderRadius = '9999px';
  exportBtn.style.padding = '8px 12px';
  exportBtn.style.background = 'white';
  exportBtn.style.color = '#111827';
  exportBtn.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  exportBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
  exportBtn.style.transition = 'background-color 150ms ease, box-shadow 150ms ease, transform 120ms ease, border-color 150ms ease, color 150ms ease';

  const base = (): void => {
    exportBtn.style.background = 'white';
    exportBtn.style.color = '#111827';
    exportBtn.style.borderColor = '#e5e7eb';
    exportBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
    exportBtn.style.transform = 'translateZ(0)';
  };
  const hover = (): void => {
    exportBtn.style.background = '#f9fafb';
    exportBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
  };
  const active = (): void => {
    exportBtn.style.background = '#f3f4f6';
    exportBtn.style.borderColor = '#d1d5db';
    exportBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.10)';
    exportBtn.style.transform = 'scale(0.98)';
  };
  exportBtn.addEventListener('mouseenter', hover);
  exportBtn.addEventListener('mouseleave', base);
  exportBtn.addEventListener('mousedown', active);
  exportBtn.addEventListener('mouseup', hover);
  base();

  // Dropdown menu container
  const menu = document.createElement('div');
  menu.setAttribute('data-prototype-comments-export-menu', '');
  menu.style.position = 'absolute';
  menu.style.top = '44px';
  menu.style.right = '0';
  menu.style.display = 'none';
  menu.style.background = 'rgba(255,255,255,0.98)';
  menu.style.border = '1px solid rgba(0,0,0,0.12)';
  menu.style.borderRadius = '12px';
  menu.style.padding = '8px';
  menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
  menu.style.minWidth = '200px';

  const makeMenuButton = (label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.cursor = 'pointer';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.padding = '8px 10px';
    btn.style.background = 'transparent';
    btn.style.color = '#111827';
    btn.style.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    btn.style.transition = 'background-color 120ms ease';
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#f3f4f6';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });
    // Prevent clicks inside menu from bubbling to page
    btn.addEventListener('click', (ev) => ev.stopPropagation());
    return btn;
  };

  const jsonBtn = makeMenuButton('Export JSON');
  const mdBtn = makeMenuButton('Export Markdown');
  const cancelBtn = makeMenuButton('Cancel');

  function closeMenu(): void {
    menu.style.display = 'none';
    exportMenuOpen = false;
  }
  function openMenu(): void {
    menu.style.display = 'block';
    exportMenuOpen = true;
  }
  function toggleMenu(): void {
    if (exportMenuOpen) closeMenu(); else openMenu();
  }

  // Click handlers for options
  jsonBtn.addEventListener('click', () => {
    const data = commentManager.getAll().map((c) => ({ id: c.id, text: c.text, x: c.x, y: c.y, timestamp: c.timestamp }));
    download(data);
    closeMenu();
  });
  mdBtn.addEventListener('click', () => {
    const lines: string[] = [];
    const comments = commentManager.getAll();
    if (comments.length > 0) {
      lines.push('# Comments', '');
      for (const c of comments) {
        const when = new Date(c.timestamp).toISOString();
        lines.push(`- (${c.x}, ${c.y}) ${escapeMarkdown(c.text)} — ${when}`);
      }
    }
    download(lines.join('\n'));
    closeMenu();
  });
  cancelBtn.addEventListener('click', () => closeMenu());

  menu.appendChild(jsonBtn);
  menu.appendChild(mdBtn);
  const divider = document.createElement('div');
  divider.style.height = '8px';
  menu.appendChild(divider);
  menu.appendChild(cancelBtn);

  function download(content: string | object): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let blob: Blob;
    let filename: string;
    if (typeof content === 'string') {
      blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      filename = `comments-${stamp}.md`;
    } else {
      const json = JSON.stringify(content, null, 2);
      blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      filename = `comments-${stamp}.json`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    // Prevent programmatic click from bubbling to document and triggering comment creation
    a.addEventListener('click', (ev) => {
      ev.stopPropagation();
    }, { once: true });
    // Append under export container so closest('[data-prototype-comments-export]') guards also apply
    container.appendChild(a);
    a.click();
    container.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    toggleMenu();
  });

  container.appendChild(exportBtn);
  container.appendChild(menu);
  document.body.appendChild(container);

  // Close on outside click without triggering creation handler
  window.addEventListener('click', (ev) => {
    if (!exportMenuOpen) return;
    const target = ev.target as HTMLElement | null;
    if (target && target.closest('[data-prototype-comments-export]')) return;
    // Close and prevent the click from reaching document handler
    closeMenu();
    ev.stopPropagation();
  }, true);

  // Close on Escape
  window.addEventListener('keydown', (ev) => {
    if (!exportMenuOpen) return;
    if (ev.key === 'Escape') closeMenu();
  });

  function escapeMarkdown(input: string): string {
    return input.replace(/[\\`*_{}\[\]()#+\-.!|]/g, (m) => `\\${m}`);
  }
}

createExportControls();

// Ensure clear controls visibility matches current comments visibility state
updateVisibility();

console.log('[prototype-comments demo] Keys: c=toggle creation mode, Shift+c=toggle visibility, e=export');


