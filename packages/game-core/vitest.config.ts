import { fileURLToPath } from 'node:url';
import { createBaseVitestConfig } from '../../vitest.base.js';

const presenterFeatureChainSourceEntry = fileURLToPath(
  new URL('../presenter/src/testing/feature-chain-helpers.ts', import.meta.url),
);
const presenterSourceEntry = fileURLToPath(new URL('../presenter/src/index.ts', import.meta.url));

export default createBaseVitestConfig({
  exclude: ['src/**/*.balance.test.ts'],
  resolve: {
    alias: [
      {
        find: '@dungeon/presenter/testing/feature-chain-helpers.js',
        replacement: presenterFeatureChainSourceEntry,
      },
      { find: '@dungeon/presenter', replacement: presenterSourceEntry },
    ],
  },
});
