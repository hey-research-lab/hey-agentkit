import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The Base example imports the package by name; its test runs it against these sources.
    alias: {
      '@hey-research-lab/agentkit': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
