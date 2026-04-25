import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createJsToTsResolvePlugin } from '../vite-helpers.js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const baseTsconfig = fileURLToPath(new URL('../tsconfig.base.json', import.meta.url));

export default defineConfig({
  root: repoRoot,
  test: {
    globals: true,
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'tests/**/*.spec.ts',
      'tests/**/*.e2e.test.ts',
      'tests/**/*.integration.test.ts',
      'tests/**/*.contract.test.ts',
      'tests/**/*.property.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/**/*.balance.test.ts',
    ],
  },
  plugins: [tsconfigPaths({ projects: [baseTsconfig] }), createJsToTsResolvePlugin()],
});
