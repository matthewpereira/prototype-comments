import { isBrowser } from './storage';

export function getElementPath(el: Element): string {
  if ((el as HTMLElement).id) return `#${(el as HTMLElement).id}`;
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

export function resolveElementByPath(path: string): Element | null {
  if (!isBrowser() || !path) return null;
  try {
    if (path.startsWith('#')) return document.querySelector(path);
    return document.querySelector(path);
  } catch {
    return null;
  }
}


