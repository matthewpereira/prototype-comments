import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./vitest.global-setup.ts']
  }
});


