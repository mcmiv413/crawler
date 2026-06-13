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
    name: 'presenter-damage-type-colors',
    ownerModule: 'packages/presenter/src/builders/entity-colors.ts',
    protectedSurfaces: [
      'packages/presenter/src',
    ],
    allowedFiles: [
      'packages/presenter/src/builders/entity-colors.ts',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
    ],
    literals: [
      {
        exportName: 'DAMAGE_TYPE_COLORS / getDamageTypeColor / getEnemyColor',
        patterns: [
          /['"]#ff4400['"]/i,
          /['"]#44aaff['"]/i,
          /['"]#dd44ff['"]/i,
          /['"]#333366['"]/i,
          /['"]#ff4444['"]/i,
        ],
      },
    ],
  },
  {
    name: 'presenter-animation-beat-fractions',
    ownerModule: 'packages/presenter/src/animation-metadata.ts',
    protectedSurfaces: [
      'packages/presenter/src',
      'apps/web/src',
    ],
    allowedFiles: [
      'packages/presenter/src/animation-metadata.ts',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
    ],
    literals: [
      {
        exportName: 'IMPACT_FRAME_FRACTION / RECOVERY_FRACTION',
        patterns: [
          /\bdurationMs\s*\*\s*0\.6\b/,
          /\bdurationMs\s*\*\s*0\.4\b/,
        ],
      },
    ],
  },
  {
    name: 'web-ability-id-interpretation',
    ownerModule: 'packages/presenter/src/builders/player-ability-view-builder.ts',
    protectedSurfaces: [
      'apps/web/src',
    ],
    allowedFiles: [],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
    ],
    literals: [
      {
        exportName: 'AbilityView.tileTarget / AbilityView.trapInteraction',
        patterns: [
          /['"]thunder_step['"]/,
          /['"]dagger_set_trap['"]/,
          /['"]dagger_disarm['"]/,
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
