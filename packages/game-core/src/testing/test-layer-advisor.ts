/**
 * test-layer-advisor.ts
 *
 * Validates test layer alignment and flags anti-patterns.
 * This is a working implementation that can be imported and used in tests.
 *
 * Usage:
 *   const result = analyzeTestFile(code, 'unit');
 *   if (result.issues.length > 0) { console.log(result.issues); }
 */

export interface TestAnalysisResult {
  layer: 'unit' | 'property' | 'contract' | 'integration' | 'balance' | 'e2e';
  issues: Issue[];
  suggestions: string[];
  validated: boolean;
  confidence: number; // 0-1
}

export interface Issue {
  severity: 'error' | 'warning' | 'info';
  code: string; // e.g., 'CONFIG_IMPORT', 'UNSEEDED_RNG', 'VALUE_ASSERTION'
  line?: number;
  description: string;
}

interface Findings {
  readonly issues: Issue[];
  readonly suggestions: string[];
}

/**
 * Analyze test file code and validate layer alignment.
 */
export function analyzeTestFile(code: string, proposedLayer: string): TestAnalysisResult {
  // Parse imports
  const imports = parseImports(code);
  const usesLiveConfig = imports.some((i) => i.from === '@dungeon/content' && i.typeOnly !== true);
  const usesSeededRng = imports.some((i) => i.name === 'SeededRng' || i.name === 'Rng');

  // Analyze code patterns
  const hasConfigValueAssertion = /expect\(\s*\w+\..*\)\s*\.toBe\(\s*\d+/.test(code);
  const hasUnseededRandom = /Math\.random\(\)|randomInt\(|Math\.floor\(Math\.random/.test(code);
  const createsFullGameState = /new GameState|createGameState|GameEngine/.test(code);
  const hasFormatEvent = /formatEvent|combatLog|gameView/i.test(code);
  const hasEventAssertion = /expectEventEmitted|eventType|\.events\./.test(code);

  // Layer-specific validation
  const layerFindings = validateProposedLayer({
    code,
    proposedLayer,
    imports,
    usesLiveConfig,
    hasConfigValueAssertion,
    hasUnseededRandom,
    createsFullGameState,
    hasFormatEvent,
    hasEventAssertion,
  });
  const generalFindings = validateGeneralPatterns(
    proposedLayer,
    hasUnseededRandom,
    usesSeededRng,
    hasConfigValueAssertion,
    usesLiveConfig,
  );
  const issues = [...layerFindings.issues, ...generalFindings.issues];
  const suggestions = [...layerFindings.suggestions, ...generalFindings.suggestions];

  const validLayers = ['unit', 'property', 'contract', 'integration', 'balance', 'e2e'] as const;
  return {
    layer: (validLayers.includes(proposedLayer as (typeof validLayers)[number])
      ? proposedLayer
      : 'unit') as (typeof validLayers)[number],
    issues,
    suggestions,
    validated: issues.filter((i) => i.severity === 'error').length === 0,
    confidence: calculateConfidence(issues, code),
  };
}

// ============================================================================
// Layer-Specific Validators
// ============================================================================

function validateProposedLayer(input: {
  readonly code: string;
  readonly proposedLayer: string;
  readonly imports: ImportDecl[];
  readonly usesLiveConfig: boolean;
  readonly hasConfigValueAssertion: boolean;
  readonly hasUnseededRandom: boolean;
  readonly createsFullGameState: boolean;
  readonly hasFormatEvent: boolean;
  readonly hasEventAssertion: boolean;
}): Findings {
  if (input.proposedLayer === 'unit' || input.proposedLayer === 'property') {
    return combineFindings(
      validateUnitLayer(input.code, input.imports),
      input.proposedLayer === 'property' ? validatePropertyLayer(input.code) : noFindings(),
    );
  }

  if (input.proposedLayer === 'contract') {
    return validateContractLayer(input.code, input.usesLiveConfig, input.hasConfigValueAssertion);
  }

  if (input.proposedLayer === 'integration') {
    return validateIntegrationLayer(
      input.createsFullGameState,
      input.hasEventAssertion,
      input.hasFormatEvent,
    );
  }

  if (input.proposedLayer === 'balance') {
    return validateBalanceLayer(input.code, input.hasUnseededRandom, input.hasConfigValueAssertion);
  }

  if (input.proposedLayer === 'e2e') {
    return validateE2eLayer(input.code);
  }

  return noFindings();
}

function validateGeneralPatterns(
  proposedLayer: string,
  hasUnseededRandom: boolean,
  usesSeededRng: boolean,
  hasConfigValueAssertion: boolean,
  usesLiveConfig: boolean,
): Findings {
  return {
    issues: [
      ...(hasUnseededRandom && usesSeededRng !== true ? [{
        severity: 'error',
        code: 'UNSEEDED_RNG',
        description: 'Test uses Math.random() or unseeded randomness. Use SeededRng for reproducibility.',
      } satisfies Issue] : []),
      ...(hasConfigValueAssertion && proposedLayer !== 'contract' ? [{
        severity: 'warning',
        code: 'VALUE_ASSERTION',
        description: 'Test asserts exact config values. Consider testing behavior instead.',
      } satisfies Issue] : []),
      ...(usesLiveConfig === true && (proposedLayer === 'unit' || proposedLayer === 'property') ? [{
        severity: 'error',
        code: 'LIVE_CONTENT_IMPORT_IN_ISOLATED_TEST',
        description: 'Unit/property test imports @dungeon/content directly. Use fixtures and builders instead.',
      } satisfies Issue] : []),
    ],
    suggestions: [
      ...(hasUnseededRandom && usesSeededRng !== true ? ['Replace Math.random() with SeededRng'] : []),
      ...(hasConfigValueAssertion && proposedLayer !== 'contract'
        ? ['Replace value assertions with behavior assertions (e.g., damage > 0)']
        : []),
      ...(usesLiveConfig === true && (proposedLayer === 'unit' || proposedLayer === 'property')
        ? ['Use test fixtures or builders instead of live config']
        : []),
    ],
  };
}

function validateUnitLayer(
  code: string,
  imports: ImportDecl[],
): Findings {
  const usesGameEngineOrFullState = /GameEngine|new GameState|createGameState\(/.test(code);
  const hasBuilder = imports.some((i) => i.name.includes('Builder'));

  return {
    issues: [
      ...(usesGameEngineOrFullState === true ? [{
        severity: 'warning',
        code: 'UNIT_TEST_TOO_LARGE',
        description: 'Unit test appears to use GameEngine or full GameState. Consider breaking into smaller tests.',
      } satisfies Issue] : []),
    ],
    suggestions: [
      ...(usesGameEngineOrFullState === true
        ? ['Use focused unit tests for single functions; move integration flows to integration tests']
        : []),
      ...(hasBuilder !== true && /new.*\(.*\{/.test(code)
        ? ['Consider using builders (PlayerBuilder, EnemyBuilder) for object construction']
        : []),
    ],
  };
}

function validateContractLayer(
  code: string,
  usesLiveConfig: boolean,
  hasValueAssertions: boolean,
): Findings {
  return {
    issues: [
      ...(/random|rng|Math\.random/.test(code) ? [{
        severity: 'warning',
        code: 'CONTRACT_TEST_RANDOMNESS',
        description: 'Contract tests should be deterministic. Avoid randomness.',
      } satisfies Issue] : []),
    ],
    suggestions: [
      ...(usesLiveConfig !== true
        ? ['Contract tests should validate live config. Consider importing @dungeon/content']
        : []),
      ...(hasValueAssertions === true && /===|\===|toBe\(\d+\)/.test(code)
        ? ['Contract tests should validate schema and relationships, not exact values. Use toMatchObject() instead.']
        : []),
    ],
  };
}

function validatePropertyLayer(
  code: string,
): Findings {
  return {
    issues: [],
    suggestions: [
      ...(/fc\.property|test\.prop|fast-check/.test(code) !== true
        ? ['Property tests should exercise invariants over generated inputs (for example, fast-check fc.property).']
        : []),
    ],
  };
}

function validateIntegrationLayer(
  usesFullState: boolean,
  hasEventAssertions: boolean,
  hasFormatEvent: boolean,
): Findings {
  return {
    issues: [],
    suggestions: [
      ...(usesFullState !== true
        ? ['Integration tests should use full GameState and GameEngine for realistic flows']
        : []),
      ...(hasEventAssertions !== true
        ? ['Integration tests should verify events are emitted (use assertFeatureChain)']
        : []),
      ...(hasFormatEvent !== true
        ? ['Integration tests should verify presenter output (buildGameView, formatEvent)']
        : []),
    ],
  };
}

function validateBalanceLayer(
  code: string,
  hasUnseededRng: boolean,
  hasValueAssertions: boolean,
): Findings {
  return {
    issues: [
      ...(hasUnseededRng === true && !/SeededRng|fixedSeed|seed:/.test(code) ? [{
        severity: 'error',
        code: 'BALANCE_TEST_UNSEEDED',
        description: 'Balance test uses unseeded randomness. Results will not be reproducible.',
      } satisfies Issue] : []),
      ...(hasValueAssertions === true && /toBe\(\d+\)/.test(code) ? [{
        severity: 'warning',
        code: 'BALANCE_TEST_EXACT_VALUE',
        description: 'Balance test asserts exact value. Use ranges (e.g., toBeGreaterThan, toBeWithin).',
      } satisfies Issue] : []),
    ],
    suggestions: [
      ...(hasValueAssertions === true && /toBe\(\d+\)/.test(code)
        ? ['Replace exact value assertions with range or distribution assertions']
        : []),
      ...(/ > | < | Between | Range | Distribution /.test(code) !== true
        ? ['Balance tests should assert ranges or distributions (e.g., between 40-60)']
        : []),
    ],
  };
}

function validateE2eLayer(
  code: string,
): Findings {
  return {
    issues: [],
    suggestions: [
      ...(/@playwright\/test/.test(code) !== true
        ? ['E2E tests should use Playwright and verify browser-visible behavior.']
        : []),
    ],
  };
}

function noFindings(): Findings {
  return { issues: [], suggestions: [] };
}

function combineFindings(...findings: readonly Findings[]): Findings {
  return {
    issues: findings.flatMap(finding => finding.issues),
    suggestions: findings.flatMap(finding => finding.suggestions),
  };
}

// ============================================================================
// Helpers
// ============================================================================

interface ImportDecl {
  name: string;
  from: string;
  typeOnly: boolean;
}

function parseImports(code: string): ImportDecl[] {
  const importRegex = /import\s+(type\s+)?(?:(?:\{([^}]+)\})|(?:\*\s+as\s+(\w+))|(\w+)(?:\s*,\s*\{([^}]+)\})?)\s+from\s+['\"]([^'\"]+)['\"]/g;

  return [...code.matchAll(importRegex)].flatMap((match) => {
    const typeOnly = match[1] !== undefined;
    const namedImports = match[2] ?? match[5];
    const namespaceImport = match[3];
    const defaultImport = match[4];
    const from = match[6] ?? '';
    const names = [
      ...(defaultImport !== undefined ? [defaultImport] : []),
      ...(namespaceImport !== undefined ? [namespaceImport] : []),
      ...((namedImports ?? '') !== '' ? (namedImports ?? '').split(',').map((n) => n.trim()) : []),
    ];
    return names
      .filter((name) => name !== '' && from !== '')
      .map((name) => ({ name: name.replace(/\s+as\s+\w+$/, ''), from, typeOnly }));
  });
}

function calculateConfidence(issues: Issue[], code: string): number {
  // Higher confidence if fewer ambiguous patterns
  let confidence = 0.9;

  if (issues.length > 3) confidence -= 0.1;
  if (code.length < 100) confidence -= 0.1; // Too small to fully analyze
  if (code.includes('TODO') || code.includes('FIXME')) confidence -= 0.1; // Incomplete

  return Math.max(0.5, confidence);
}
