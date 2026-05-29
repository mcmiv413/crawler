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
];
