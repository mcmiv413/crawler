import { defineConfig } from 'vitest/config';
import { createJsToTsResolvePlugin } from '../../vite-helpers.js';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.contract.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
  },
  plugins: [createJsToTsResolvePlugin()],
  resolve: {
    alias: [{ find: '@', replacement: '/src' }],
  },
});
