import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PrototypeComments',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs')
    },
    rollupOptions: {
      output: {
        preserveModules: false
      }
    }
  },
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist/types'
    })
  ],
  test: undefined
});


