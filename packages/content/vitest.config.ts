import { defineConfig } from 'vitest/config';
import { createJsToTsResolvePlugin } from '../../vite-helpers.js';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  plugins: [createJsToTsResolvePlugin()],
});
