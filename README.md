## prototype-comments

A lightweight TypeScript library that overlays comment bubbles over any page. Add, edit, delete, persist, and export comments without wiring a UI.

### Features

- Add, edit, delete, and drag comments on any page
- Persist to localStorage (or keep in-memory)
- Export comments as JSON or Markdown
- Built-in overlay and optional drop-in controls (Export / Clear / Show/Hide)
- Keyboard: Shift+C to show/hide overlay (built-in)
- TypeScript types included

### Installation

```bash
npm install prototype-comments
# or
yarn add prototype-comments
# or
pnpm add prototype-comments
```

### Quick start

```ts
import { enableComments, commentManager, exportComments, mountCommentControls } from 'prototype-comments';

// 1) Enable comments (persist to localStorage; export as markdown or json)
enableComments({ storage: 'localStorage', exportFormat: 'markdown' });

// 2) Optional: mount drop-in controls (Add/Export/Clear/Show-Hide)
const unmount = mountCommentControls();
// Later: unmount();

// 3) Programmatic add at coordinates (page x/y)
commentManager.addComment({ text: 'Hello', x: 120 + window.scrollX, y: 200 + window.scrollY });

// 4) Export
const data = exportComments(); // string (markdown) or JSON array
```

#### Drop-in controls (Export / Clear / Show/Hide)

```ts
import { mountCommentControls } from 'prototype-comments';

// After enableComments():
const unmount = mountCommentControls();
// Call unmount() to remove controls
```

#### Enable/Disable button example

```ts
import { enableComments, disableComments, isCommentsEnabled } from 'prototype-comments';

const btn = document.getElementById('enable-disable') as HTMLButtonElement;
function render() { btn.textContent = isCommentsEnabled() ? 'Disable comments' : 'Enable comments'; }
btn.addEventListener('click', () => {
  if (isCommentsEnabled()) disableComments();
  else enableComments({ storage: 'localStorage', exportFormat: 'markdown' });
  render();
});
render();
```

#### Configure comment width

```ts
// Set CSS custom properties on the overlay to change bubble width
const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement;
// Minimum width (default 250px)
overlay?.style.setProperty('--prototype-comments-min-width', '520px');
overlay?.style.setProperty('--prototype-comments-min-height', '32px');
// Maximum width (default 400px)
overlay?.style.setProperty('--prototype-comments-max-width', '520px');
```

### Demo

- Local demo: `npm run dev`, then open the printed URL
- Live demo: add a GitHub Pages or Vercel link here

### Keyboard

- Shift+C: toggle overlay visibility (handled by the library)
- C: toggle creation mode if you implement it (the drop-in controls wire this up for you)

Example creation-mode toggle without the controls:

```ts
let createMode = false;
const renderCursor = () => {
  const cursor = createMode ? 'crosshair' : '';
  document.body.style.cursor = cursor;
  (document.documentElement as HTMLElement).style.cursor = cursor;
  const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
  if (overlay) overlay.style.cursor = cursor;
};

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'c' && !e.shiftKey) {
    createMode = !createMode;
    renderCursor();
  }
});

document.addEventListener('click', (e) => {
  if (!createMode) return;
  const x = (e as MouseEvent).clientX;
  const y = (e as MouseEvent).clientY;
  commentManager.beginCommentAt(x, y);
});
```

### Styling

- Overlay uses a high z-index so it sits on top of your UI. You can query the overlay via `[data-prototype-comments-overlay]` and adjust styles at runtime if needed.
- Comment bubble width can be tuned via CSS variables on the overlay element:

```ts
const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
overlay?.style.setProperty('--prototype-comments-min-width', '520px');
overlay?.style.setProperty('--prototype-comments-min-height', '32px');
overlay?.style.setProperty('--prototype-comments-max-width', '520px');
```

### CommonJS

```js
const { enableComments, exportComments, commentManager } = require('prototype-comments');
enableComments({ storage: 'localStorage', exportFormat: 'json' });
commentManager.addComment({ text: 'Hi', x: 50, y: 80 });
console.log(exportComments());
```

### SSR (e.g., Next.js)

Only call `enableComments()` on the client. For React/Next.js:

```tsx
import { useEffect } from 'react';
import { enableComments, mountCommentControls } from 'prototype-comments';

export default function Page() {
  useEffect(() => {
    enableComments({ storage: 'localStorage', exportFormat: 'json' });
    const unmount = mountCommentControls();
    return () => unmount();
  }, []);
  return <main>…</main>;
}
```

### CDN / Script tag

UMD bundle is exposed as `window.PrototypeComments`.

```html
<script src="https://unpkg.com/prototype-comments/dist/index.umd.js"></script>
<script>
  const { enableComments, commentManager } = window.PrototypeComments;
  enableComments({ storage: 'localStorage', exportFormat: 'json' });
  document.addEventListener('click', (e) => {
    const x = e.clientX; const y = e.clientY;
    commentManager.beginCommentAt(x, y);
  });
</script>
```

### React component

This package exports a React component `PrototypeCommentsControls` (optional). Mount it anywhere in your tree after calling `enableComments()` on the client.

```tsx
import { useEffect } from 'react';
import { enableComments, PrototypeCommentsControls } from 'prototype-comments';

export default function Page() {
  useEffect(() => {
    enableComments({ storage: 'localStorage', exportFormat: 'json' });
  }, []);
  return (
    <>
      <main>…</main>
      <PrototypeCommentsControls />
    </>
  );
}
```

### Development

- `npm run dev` to start the demo site with hot reload
- `npm run build` to build the library (ESM + CJS) and demo
- `npm run test` to run unit tests with Vitest
- `npm run lint` to lint with ESLint
- `npm run format` to format with Prettier

### Contributing

1. Fork and clone the repo
2. Create a feature branch
3. Run `npm i`
4. Start the dev server with `npm run dev`
5. Add tests for changes and ensure `npm run test` passes
6. Open a PR with a clear description

### License

MIT


