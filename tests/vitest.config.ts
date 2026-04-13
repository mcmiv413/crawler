import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    include: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.e2e.test.ts',
      '**/*.balance.test.ts',
      '**/*.integration.test.ts',
      '**/*.contract.test.ts',
      '**/*.property.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
