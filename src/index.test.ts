import { describe, it, expect, beforeEach } from 'vitest';
import { enableComments, disableComments, exportComments, commentManager } from './index';

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


