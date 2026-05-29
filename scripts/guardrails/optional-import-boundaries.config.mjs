export default [
  {
    name: 'web-three-effects-disabled-path',
    owner: 'VITE_THREE_EFFECTS optional WebGL overlay',
    entryModules: [
      'apps/web/src/components/DungeonPhase.tsx',
    ],
    optionalRoots: [
      'apps/web/src/rendering/three',
    ],
    forbiddenPackages: [
      'three',
    ],
    allowedDynamicImportRoots: [
      'apps/web/src/rendering/three',
    ],
  },
];
