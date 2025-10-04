/** Injects design tokens and base styles once. Consumers can override tokens on the overlay element. */
export function ensureDesignTokens(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('prototype-comments-tokens')) return;
  const style = document.createElement('style');
  style.id = 'prototype-comments-tokens';
  style.textContent = `
    :root {
      --prototype-comments-min-width: 250px;
      --prototype-comments-max-width: 400px;
      --prototype-comments-min-height: 24px;
      --prototype-comments-proximity: 256px;
      /* theme tokens populated at runtime on the overlay */
      --pc-bg: rgba(255,255,255,0.85);
      --pc-bg-hover: rgba(255,255,255,0.95);
      --pc-border-color: rgba(0,0,0,0.25);
      --pc-text: #111827;
      --pc-collapsed-bg: rgba(255,255,255,1);
    }
  `;
  document.head.appendChild(style);
}


