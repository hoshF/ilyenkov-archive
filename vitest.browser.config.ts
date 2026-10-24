import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/browser/**/*.browser.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    passWithNoTests: false,
  },
});
