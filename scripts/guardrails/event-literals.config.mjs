export default [
  {
    name: 'domain-event-factories',
    factoryModule: 'packages/game-core/src/abilities/runtime/emit-events.ts',
    protectedSurfaces: [
      'packages/game-core/src',
    ],
    allowedFiles: [
      'packages/game-core/src/abilities/runtime/emit-events.ts',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
      /\.property\.test\.ts$/,
      /\/testing\//,
    ],
    eventTypes: [
      'STATUS_APPLIED',
      'GOLD_CHANGED',
      'MANA_CHANGED',
      'SPELL_UNLOCKED',
      'ENCHANTMENT_APPLIED',
      'BLUEPRINT_UNLOCKED',
    ],
  },
];
