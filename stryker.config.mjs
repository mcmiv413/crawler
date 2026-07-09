export default {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  mutate: [
    'packages/game-core/src/engine/command-handler.ts',
    'packages/game-core/src/state/save-snapshot.ts',
    'packages/presenter/src/event-formatter.ts',
    'packages/presenter/src/game-view-builder.ts',
    'packages/presenter/src/builders/**',
    'packages/game-core/src/abilities/runtime/**',
    'packages/game-core/src/abilities/effects/**',
    '!**/*.test.ts',
    '!**/*.property.test.ts',
    '!**/*.integration.test.ts',
    '!**/*.contract.test.ts',
  ],
  reporters: ['clear-text', 'progress', 'html'],
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  vitest: {
    configFile: 'vitest.config.ts',
  },
};
