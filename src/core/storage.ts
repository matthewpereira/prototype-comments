export type StoredComment = {
  id: string;
  text: string;
  x: number;
  y: number;
  timestamp: number;
  nx?: number;
  ny?: number;
  anchor?: { path: string; rx: number; ry: number };
};

export type StorageAdapter = {
  load: () => StoredComment[];
  save: (comments: StoredComment[]) => void;
  clear: () => void;
};

const LOCAL_STORAGE_KEY = 'prototype-comments';

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function canUseLocalStorage(): boolean {
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

export function createMemoryStorage(): StorageAdapter {
  let inMemory: StoredComment[] = [];
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

export function createLocalStorage(): StorageAdapter {
  return {
    load: () => {
      if (!isBrowser() || !('localStorage' in window)) return [];
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as StoredComment[];
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
        // ignore
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


