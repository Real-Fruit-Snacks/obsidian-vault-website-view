// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    alias: {
      obsidian: resolve(__dirname, './tests/mocks/obsidian.ts'),
    },
  },
});
