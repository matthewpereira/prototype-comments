import { defineConfig } from 'vite';

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
      'prototype-comments': './src/index.ts'
    }
  }
});


