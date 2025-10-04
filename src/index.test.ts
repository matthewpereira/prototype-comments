import { describe, it, expect, beforeEach } from 'vitest';
import { enableComments, disableComments, exportComments, commentManager } from './index';
import { createMemoryStorage, createLocalStorage, canUseLocalStorage } from './core/storage';
import { getElementPath, resolveElementByPath } from './core/anchor';

describe('prototype-comments API', () => {
  beforeEach(() => {
    disableComments();
    // Reset localStorage between tests
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      window.localStorage.clear();
    }
  });

  it('enables with memory storage by default and adds markers', () => {
    enableComments();
    commentManager.addComment({ text: 'Hello', x: 10, y: 20 });
    expect(commentManager.getAll()).toHaveLength(1);
    const overlay = document.querySelector('[data-prototype-comments-overlay]');
    expect(overlay).toBeTruthy();
    const dots = overlay!.querySelectorAll('[data-prototype-comment]');
    expect(dots.length).toBe(1);
  });

  it('exports JSON by default and supports markdown', () => {
    enableComments({ exportFormat: 'json' });
    commentManager.addComment({ text: 'X', x: 1, y: 2 });
    const json = exportComments();
    expect(Array.isArray(json)).toBe(true);

    disableComments();
    enableComments({ exportFormat: 'markdown' });
    commentManager.addComment({ text: 'Y', x: 3, y: 4 });
    const md = exportComments();
    expect(typeof md).toBe('string');
  });
});
describe('core/storage adapters', () => {
  it('memory adapter roundtrips comments', () => {
    const mem = createMemoryStorage();
    expect(mem.load()).toEqual([]);
    mem.save([{ id: '1', text: 'a', x: 1, y: 2, timestamp: 3 }]);
    expect(mem.load()).toEqual([{ id: '1', text: 'a', x: 1, y: 2, timestamp: 3 }]);
    mem.clear();
    expect(mem.load()).toEqual([]);
  });

  it('localStorage adapter does not throw when unavailable', () => {
    const ls = createLocalStorage();
    // In JSDOM happy path, this should be okay; but function should be safe
    expect(() => ls.load()).not.toThrow();
    expect(() => ls.save([])).not.toThrow();
    expect(() => ls.clear()).not.toThrow();
    expect(typeof canUseLocalStorage()).toBe('boolean');
  });
});

describe('core/anchor helpers', () => {
  it('builds and resolves element path', () => {
    const div = document.createElement('div');
    div.id = 'anchor-test';
    document.body.appendChild(div);
    const path = getElementPath(div);
    expect(path).toContain('#anchor-test');
    const el = resolveElementByPath(path);
    expect(el).toBe(div);
  });
});

// New tests for localStorage persistence
describe('localStorage persistence', () => {
  beforeEach(() => {
    disableComments();
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      window.localStorage.clear();
    }
  });

  it('persists new comments to localStorage when storage="localStorage"', () => {
    enableComments({ storage: 'localStorage' });
    commentManager.addComment({ text: 'Persist me', x: 5, y: 6 });
    const raw = window.localStorage.getItem('prototype-comments');
    expect(raw).toBeTruthy();
    const arr = JSON.parse(raw!);
    expect(arr.length).toBe(1);
    expect(arr[0].text).toBe('Persist me');
  });

  it('restores comments from localStorage on enable (reload simulation)', () => {
    enableComments({ storage: 'localStorage' });
    commentManager.addComment({ text: 'First', x: 10, y: 20 });
    // Simulate reload: disable and enable again
    disableComments();
    enableComments({ storage: 'localStorage' });
    const all = commentManager.getAll();
    expect(all.length).toBe(1);
    expect(all[0].text).toBe('First');
  });

  it('clear() removes comments and deletes localStorage key', () => {
    enableComments({ storage: 'localStorage' });
    commentManager.addComment({ text: 'To be cleared', x: 1, y: 1 });
    expect(JSON.parse(window.localStorage.getItem('prototype-comments')!).length).toBe(1);
    commentManager.clear();
    expect(window.localStorage.getItem('prototype-comments')).toBeNull();
    expect(commentManager.getAll().length).toBe(0);
  });
});

describe('element anchoring and viewport changes', () => {
  beforeEach(() => {
    disableComments();
    document.body.innerHTML = '';
  });

  it('repositions anchored comments on resize based on element rect', () => {
    // Create a target element and mock its bounding rect
    const el = document.createElement('div');
    el.id = 'box';
    document.body.appendChild(el);

    let rectLeft = 100;
    let rectTop = 200;
    let rectWidth = 400;
    let rectHeight = 100;
    (el as any).getBoundingClientRect = () => ({
      left: rectLeft,
      top: rectTop,
      width: rectWidth,
      height: rectHeight,
      right: rectLeft + rectWidth,
      bottom: rectTop + rectHeight,
      x: rectLeft,
      y: rectTop,
      toJSON: () => ({})
    });

    enableComments({ storage: 'memory', exportFormat: 'json' });

    // Place comment at rx=0.25, ry=0.5 relative to element
    const rx = 0.25; const ry = 0.5;
    const vx0 = rectLeft + rectWidth * rx;
    const vy0 = rectTop + rectHeight * ry;
    commentManager.addComment({ text: 'anchored', x: vx0 + window.scrollX, y: vy0 + window.scrollY, anchor: { path: '#box', rx, ry } });

    const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
    expect(overlay).toBeTruthy();
    const bubble = overlay!.querySelector('[data-prototype-comment]') as HTMLDivElement | null;
    expect(bubble).toBeTruthy();
    const leftBefore = parseFloat((bubble as HTMLDivElement).style.left);
    const topBefore = parseFloat((bubble as HTMLDivElement).style.top);
    expect(leftBefore).toBeCloseTo(vx0);
    expect(topBefore).toBeCloseTo(vy0);

    // Simulate a wider viewport/content: element width doubles
    rectWidth = 800;
    window.dispatchEvent(new Event('resize'));

    const leftAfter = parseFloat((bubble as HTMLDivElement).style.left);
    const topAfter = parseFloat((bubble as HTMLDivElement).style.top);
    const expectedVx = rectLeft + rectWidth * 0.25; // rx preserved
    const expectedVy = vy0; // ry preserved and height unchanged
    expect(leftAfter).toBeCloseTo(expectedVx);
    expect(topAfter).toBeCloseTo(expectedVy);
    expect(leftAfter).toBeGreaterThan(leftBefore);
  });
});

describe('overlay render patching', () => {
  it('does not recreate bubble nodes on re-render', () => {
    disableComments();
    enableComments();
    commentManager.addComment({ text: 'Node', x: 10, y: 10 });
    const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
    expect(overlay).toBeTruthy();
    const before = overlay!.querySelector('[data-prototype-comment]') as HTMLDivElement | null;
    expect(before).toBeTruthy();
    // trigger re-render
    (commentManager as any).renderOverlay?.();
    const after = overlay!.querySelector('[data-prototype-comment]') as HTMLDivElement | null;
    expect(after).toBe(before);
  });
});


