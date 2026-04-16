import { createBaseVitestConfig } from '../../vitest.base.js';

export default createBaseVitestConfig({
  include: ['src/**/*.test.ts', 'src/**/*.contract.test.ts'],
});
