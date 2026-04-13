import { defineConfig } from 'vitest/config';
import { createJsToTsResolvePlugin } from '../../vite-helpers.js';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
  },
  plugins: [createJsToTsResolvePlugin()],
  resolve: {
    alias: [{ find: '@', replacement: '/src' }],
  },
});
