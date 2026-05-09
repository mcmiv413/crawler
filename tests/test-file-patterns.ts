export type TestLayer =
  | 'unit'
  | 'property'
  | 'contract'
  | 'integration'
  | 'balance'
  | 'e2e';

export const ROOT_TEST_INCLUDE_PATTERNS = [
  'tests/**/*.test.ts',
  'tests/**/*.test.tsx',
  'tests/**/*.e2e.test.ts',
  'tests/**/*.integration.test.ts',
  'tests/**/*.contract.test.ts',
  'tests/**/*.property.test.ts',
] as const;

export const ROOT_TEST_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  'tests/e2e/**',
  'tests/**/*.spec.ts',
  'tests/**/*.balance.test.ts',
] as const;

export const TEST_LAYER_LABELS: Readonly<Record<TestLayer, string>> = {
  unit: 'Unit',
  property: 'Property',
  contract: 'Contract',
  integration: 'Integration',
  balance: 'Balance',
  e2e: 'E2E',
};

export interface DefaultWorkspaceTestRunStatus {
  readonly included: boolean;
  readonly reason: string;
}

type LayerMatcher = Readonly<{
  layer: TestLayer;
  matches: (normalizedPath: string) => boolean;
}>;

const TEST_LAYER_MATCHERS: readonly LayerMatcher[] = [
  {
    layer: 'e2e',
    matches: (normalizedPath) =>
      normalizedPath.includes('/tests/e2e/') ||
      normalizedPath.endsWith('.spec.ts') ||
      normalizedPath.endsWith('.e2e.test.ts'),
  },
  {
    layer: 'balance',
    matches: (normalizedPath) =>
      normalizedPath.includes('/tests/balance/') ||
      normalizedPath.endsWith('.balance.test.ts'),
  },
  {
    layer: 'contract',
    matches: (normalizedPath) =>
      normalizedPath.includes('/tests/contracts/') ||
      normalizedPath.endsWith('.contract.test.ts'),
  },
  {
    layer: 'integration',
    matches: (normalizedPath) =>
      normalizedPath.includes('/tests/integration/') ||
      normalizedPath.endsWith('.integration.test.ts'),
  },
  {
    layer: 'property',
    matches: (normalizedPath) => normalizedPath.endsWith('.property.test.ts'),
  },
  {
    layer: 'unit',
    matches: (normalizedPath) =>
      normalizedPath.endsWith('.test.ts') ||
      normalizedPath.endsWith('.test.tsx'),
  },
];

export function normalizeTestPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function guessTestLayerFromPath(filePath: string): TestLayer | null {
  const normalizedPath = normalizeTestPath(filePath);

  for (const matcher of TEST_LAYER_MATCHERS) {
    if (matcher.matches(normalizedPath)) {
      return matcher.layer;
    }
  }

  return null;
}

export function isRecognizedTestFilePath(filePath: string): boolean {
  return guessTestLayerFromPath(filePath) !== null;
}

export function getDefaultWorkspaceTestRunStatus(filePath: string): DefaultWorkspaceTestRunStatus {
  const normalizedPath = normalizeTestPath(filePath);

  if (normalizedPath.startsWith('tests/')) {
    if (normalizedPath.includes('/tests/e2e/') || normalizedPath.startsWith('tests/e2e/') || normalizedPath.endsWith('.spec.ts')) {
      return {
        included: false,
        reason: 'Playwright-only; run pnpm test:e2e',
      };
    }

    if (normalizedPath.endsWith('.balance.test.ts')) {
      return {
        included: false,
        reason: 'excluded by tests/vitest.config.ts via ROOT_TEST_EXCLUDE_PATTERNS',
      };
    }

    return {
      included: true,
      reason: 'included by tests/vitest.config.ts',
    };
  }

  if (normalizedPath.startsWith('apps/web/src/')
    && (normalizedPath.endsWith('.test.ts') || normalizedPath.endsWith('.test.tsx'))) {
    return {
      included: true,
      reason: 'included by apps/web/vitest.config.ts',
    };
  }

  if (normalizedPath.startsWith('apps/server/src/') && normalizedPath.endsWith('.test.ts')) {
    return {
      included: true,
      reason: 'included by apps/server/vitest.config.ts',
    };
  }

  if (normalizedPath.startsWith('packages/game-core/src/') && normalizedPath.endsWith('.test.ts')) {
    if (normalizedPath.endsWith('.balance.test.ts')) {
      return {
        included: false,
        reason: 'excluded by packages/game-core/vitest.config.ts',
      };
    }

    return {
      included: true,
      reason: 'included by packages/game-core/vitest.config.ts',
    };
  }

  if (normalizedPath.startsWith('packages/game-contracts/src/') && normalizedPath.endsWith('.test.ts')) {
    return {
      included: true,
      reason: 'included by packages/game-contracts/vitest.config.ts',
    };
  }

  if (normalizedPath.startsWith('packages/content/src/') && normalizedPath.endsWith('.test.ts')) {
    return {
      included: true,
      reason: 'included by packages/content/vitest.config.ts',
    };
  }

  if (normalizedPath.startsWith('packages/presenter/src/') && normalizedPath.endsWith('.test.ts')) {
    return {
      included: true,
      reason: 'included by packages/presenter/vitest.config.ts',
    };
  }

  return {
    included: false,
    reason: 'not matched by any workspace Vitest config',
  };
}
