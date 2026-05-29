export default [
  {
    name: 'web-map-viewport-minimums',
    ownerModule: 'apps/web/src/config/ui-config.ts',
    protectedSurfaces: [
      'apps/web/src/components/DungeonPhase.tsx',
    ],
    allowedFiles: [
      'apps/web/src/config/ui-config.ts',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
    ],
    literals: [
      {
        exportName: 'MIN_VIEWPORT_TILES_WIDTH',
        patterns: [
          /\buseState\s*\(\s*15\s*\)/,
          /\bMath\.max\s*\(\s*15\s*,/,
        ],
      },
      {
        exportName: 'MIN_VIEWPORT_TILES_HEIGHT',
        patterns: [
          /\buseState\s*\(\s*12\s*\)/,
          /\bMath\.max\s*\(\s*12\s*,/,
        ],
      },
    ],
  },
  {
    name: 'combat-hit-chance-clamps',
    ownerModule: 'packages/content/src/balance/tables.ts',
    protectedSurfaces: [
      'packages/game-core/src/engine',
      'packages/game-core/src/systems',
    ],
    allowedFilePatterns: [
      /\.test\.ts$/,
      /\.property\.test\.ts$/,
      /\.balance\.test\.ts$/,
    ],
    literals: [
      {
        exportName: 'COMBAT.minHitChance',
        patterns: [
          /\bMath\.max\s*\(\s*15\s*,/,
        ],
      },
      {
        exportName: 'COMBAT.maxHitChance',
        patterns: [
          /\bMath\.min\s*\(\s*95\s*,/,
        ],
      },
    ],
  },
];
