export default [
  {
    name: 'animation-refs',
    sourceExport: 'animationRefs',
    sourceRoots: [
      'packages/content/src/animation-refs',
    ],
    implementationRoots: [
      'packages/content/src/abilities',
      'packages/content/src/items',
      'packages/content/src/ring-spells',
      'apps/web/src/animations',
      'apps/web/src/rendering/three',
      'packages/presenter/src',
    ],
    allowedDeclarationRoots: [
      'packages/content/src/animation-refs',
    ],
    allowedContractRoots: [
      'tests/contracts',
    ],
    allowedFixtureRoots: [
      'tests/integration',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
      /\.property\.test\.ts$/,
      /\/testing\//,
    ],
    literalPattern: /\bfx\.(?:impact|projectile|self|aoe|status|utility)\.[A-Za-z0-9._-]+\b/g,
  },
  {
    name: 'status-refs',
    sourceExport: 'the named status definition',
    sourceRoots: [
      'packages/content/src/statuses',
    ],
    implementationRoots: [
      'packages/content/src/ring-spells',
      'packages/game-core/src/abilities/definitions',
      'packages/game-core/src/abilities/effects',
      'packages/game-core/src/systems/enemy-abilities.ts',
      'packages/game-core/src/systems/burn-spread.ts',
      'packages/game-core/src/systems/status-effects.ts',
      'packages/game-core/src/systems/status-application.ts',
      'packages/game-core/src/systems/mana.ts',
      'packages/game-core/src/engine/handlers/combat.ts',
      'packages/game-core/src/engine/turn-scheduler.ts',
    ],
    allowedDeclarationRoots: [
      'packages/content/src/statuses',
    ],
    allowedContractRoots: [
      'tests/contracts',
    ],
    allowedFixtureRoots: [
      'tests/integration',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
      /\.property\.test\.ts$/,
      /\/testing\//,
    ],
    sourcePattern: /\bid:\s*['"](?<value>[a-z_]+)['"]/g,
    implementationPattern: /\b(?:statusId\s*(?::|===)|id\s*[!=]==)\s*['"](?<value>[a-z_]+)['"]/g,
  },
  {
    name: 'enemy-template-refs',
    sourceExport: 'the named enemy template',
    sourceRoots: [
      'packages/content/src/enemies',
    ],
    implementationRoots: [
      'packages/content/src/factions',
    ],
    allowedDeclarationRoots: [
      'packages/content/src/enemies',
    ],
    allowedContractRoots: [
      'tests/contracts',
    ],
    allowedFixtureRoots: [
      'tests/integration',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
      /\.property\.test\.ts$/,
      /\/testing\//,
    ],
    sourcePattern: /\btemplateId:\s*['"](?<value>[a-z_]+)['"]/g,
    implementationPattern: /\btemplateId:\s*['"](?<value>[a-z_]+)['"]/g,
  },
  {
    name: 'ring-item-refs',
    sourceExport: 'the named ring item definition',
    sourceRoots: [
      'packages/content/src/items',
    ],
    implementationRoots: [
      'packages/content/src/ring-schools',
    ],
    allowedDeclarationRoots: [
      'packages/content/src/items',
    ],
    allowedContractRoots: [
      'tests/contracts',
    ],
    allowedFixtureRoots: [
      'tests/integration',
    ],
    allowedFilePatterns: [
      /\.test\.[tj]sx?$/,
      /\.property\.test\.ts$/,
      /\/testing\//,
    ],
    sourcePattern: /\bitemId:\s*['"](?<value>[a-z_]+)['"]/g,
    implementationPattern: /\bringId:\s*['"](?<value>[a-z_]+)['"]/g,
  },
];
