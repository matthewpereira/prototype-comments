## prototype-comments

A lightweight TypeScript library that overlays comment bubbles over any page. Add, edit, delete, persist, and export comments without wiring a UI.

### Installation

```bash
npm install prototype-comments
# or
yarn add prototype-comments
# or
pnpm add prototype-comments
```

### Usage

```ts
import { enableComments, disableComments, isCommentsEnabled, commentManager, exportComments } from 'prototype-comments';

// Turn on the overlay (persist to localStorage, export as markdown)
enableComments({ storage: 'localStorage', exportFormat: 'markdown' });

// Optional: toggle creation mode with the "c" key and visibility with "Shift+c"
document.addEventListener('keydown', (e) => {
  if (e.key === 'c' && !e.shiftKey) {
    // custom creation mode handler if needed
  } else if (e.key.toLowerCase() === 'c' && e.shiftKey) {
    const overlay = document.querySelector('[data-prototype-comments-overlay]') as HTMLDivElement | null;
    if (overlay) overlay.style.display = overlay.style.display === 'none' ? '' : 'none';
  }
});

// Programmatic add at coordinates
commentManager.addComment({ text: 'Hello', x: 120 + window.scrollX, y: 200 + window.scrollY });

// Export
const data = exportComments(); // markdown string (when configured) or JSON array
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
overlay?.style.setProperty('--prototype-comments-min-width', '280px');
// Maximum width (default 400px)
overlay?.style.setProperty('--prototype-comments-max-width', '520px');
```

### Demo

- Live demo: add a GitHub Pages or Vercel link here

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


