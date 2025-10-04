import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PrototypeComments',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.js' : format === 'cjs' ? 'index.cjs' : 'index.umd.js')
    },
    rollupOptions: {
      external: ['react'],
      output: {
        preserveModules: false,
        globals: {
          react: 'React'
        }
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


