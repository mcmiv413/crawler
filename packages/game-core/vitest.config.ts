import { createBaseVitestConfig } from '../../vitest.base.js';

export default createBaseVitestConfig({
  exclude: ['src/**/*.balance.test.ts'],
});
