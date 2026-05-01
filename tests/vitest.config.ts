import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createJsToTsResolvePlugin } from '../vite-helpers.js';
import {
  ROOT_TEST_EXCLUDE_PATTERNS,
  ROOT_TEST_INCLUDE_PATTERNS,
} from './test-file-patterns.js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const baseTsconfig = fileURLToPath(new URL('../tsconfig.base.json', import.meta.url));

export default defineConfig({
  root: repoRoot,
  test: {
    globals: true,
    include: [...ROOT_TEST_INCLUDE_PATTERNS],
    exclude: [...ROOT_TEST_EXCLUDE_PATTERNS],
  },
  plugins: [tsconfigPaths({ projects: [baseTsconfig] }), createJsToTsResolvePlugin()],
});
