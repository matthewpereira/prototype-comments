import { defineConfig } from 'vite';

export default defineConfig({
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
      'prototype-comments': '/Users/matthew.pereira/Developer/prototype-comments/src/index.ts'
    }
  }
});


