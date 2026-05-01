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
  'tests/**/*.spec.ts',
  'tests/**/*.e2e.test.ts',
  'tests/**/*.integration.test.ts',
  'tests/**/*.contract.test.ts',
  'tests/**/*.property.test.ts',
] as const;

export const ROOT_TEST_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
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
