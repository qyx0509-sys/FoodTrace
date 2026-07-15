import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup-environment.ts'],
    coverage: {
      reporter: ['text', 'json-summary'],
    },
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
  },
});
