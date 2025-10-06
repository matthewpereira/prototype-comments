import { defineConfig } from 'vite';
import { resolve } from 'path';

const base = process.env.DEPLOY_BASE ?? '/';

export default defineConfig({
  base,
  root: 'demo',
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true
  },
  server: {
    open: true,
    hmr: { overlay: true }
  },
  resolve: {
    alias: {
      // Map the package import to the local source during dev/build of the demo
      'prototype-comments': resolve(__dirname, 'src/index.ts')
    }
  }
});


