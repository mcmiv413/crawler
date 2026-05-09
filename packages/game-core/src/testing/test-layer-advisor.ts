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

/**
 * Analyze test file code and validate layer alignment.
 */
export function analyzeTestFile(code: string, proposedLayer: string): TestAnalysisResult {
  const mutableIssues: Issue[] = [];
  const mutableSuggestions: string[] = [];

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
  void code; // Mark as used

  // Layer-specific validation
  if (proposedLayer === 'unit' || proposedLayer === 'property') {
    validateUnitLayer(code, imports, hasConfigValueAssertion, hasUnseededRandom, mutableIssues, mutableSuggestions);
    if (proposedLayer === 'property') {
      validatePropertyLayer(code, mutableSuggestions);
    }
  } else if (proposedLayer === 'contract') {
    validateContractLayer(code, usesLiveConfig, hasConfigValueAssertion, mutableIssues, mutableSuggestions);
  } else if (proposedLayer === 'integration') {
    validateIntegrationLayer(
      code,
      createsFullGameState,
      hasEventAssertion,
      hasFormatEvent,
      mutableIssues,
      mutableSuggestions,
    );
  } else if (proposedLayer === 'balance') {
    validateBalanceLayer(code, hasUnseededRandom, hasConfigValueAssertion, mutableIssues, mutableSuggestions);
  } else if (proposedLayer === 'e2e') {
    validateE2eLayer(code, mutableSuggestions);
  }

  // General anti-patterns (all layers)
  if (hasUnseededRandom && usesSeededRng !== true) {
    mutableIssues.push({
      severity: 'error',
      code: 'UNSEEDED_RNG',
      description: 'Test uses Math.random() or unseeded randomness. Use SeededRng for reproducibility.',
    });
    mutableSuggestions.push('Replace Math.random() with SeededRng');
  }

  if (hasConfigValueAssertion && proposedLayer !== 'contract') {
    mutableIssues.push({
      severity: 'warning',
      code: 'VALUE_ASSERTION',
      description: 'Test asserts exact config values. Consider testing behavior instead.',
    });
    mutableSuggestions.push('Replace value assertions with behavior assertions (e.g., damage > 0)');
  }

  if (usesLiveConfig === true && (proposedLayer === 'unit' || proposedLayer === 'property')) {
    mutableIssues.push({
      severity: 'error',
      code: 'LIVE_CONTENT_IMPORT_IN_ISOLATED_TEST',
      description: 'Unit/property test imports @dungeon/content directly. Use fixtures and builders instead.',
    });
    mutableSuggestions.push('Use test fixtures or builders instead of live config');
  }

  const validLayers = ['unit', 'property', 'contract', 'integration', 'balance', 'e2e'] as const;
  return {
    layer: (validLayers.includes(proposedLayer as (typeof validLayers)[number])
      ? proposedLayer
      : 'unit') as (typeof validLayers)[number],
    issues: mutableIssues,
    suggestions: mutableSuggestions,
    validated: mutableIssues.filter((i) => i.severity === 'error').length === 0,
    confidence: calculateConfidence(mutableIssues, code),
  };
}

// ============================================================================
// Layer-Specific Validators
// ============================================================================

function validateUnitLayer(
  code: string,
  imports: ImportDecl[],
  hasValueAssertions: boolean,
  hasUnseededRng: boolean,
  mutableIssues: Issue[],
  mutableSuggestions: string[],
): void {
  void hasValueAssertions; // Mark as used in comments
  void hasUnseededRng;
  void code;
  // Unit tests should NOT create full game state
  if (/GameEngine|new GameState|createGameState\(/.test(code)) {
    mutableIssues.push({
      severity: 'warning',
      code: 'UNIT_TEST_TOO_LARGE',
      description: 'Unit test appears to use GameEngine or full GameState. Consider breaking into smaller tests.',
    });
    mutableSuggestions.push(
      'Use focused unit tests for single functions; move integration flows to integration tests',
    );
  }

  // Unit tests should use builders/fixtures
  const hasBuilder = imports.some((i) => i.name.includes('Builder'));
  if (hasBuilder !== true && /new.*\(.*\{/.test(code)) {
    mutableSuggestions.push('Consider using builders (PlayerBuilder, EnemyBuilder) for object construction');
  }
}

function validateContractLayer(
  code: string,
  usesLiveConfig: boolean,
  hasValueAssertions: boolean,
  mutableIssues: Issue[],
  mutableSuggestions: string[],
): void {
  // Contract tests SHOULD use live config
  if (usesLiveConfig !== true) {
    mutableSuggestions.push('Contract tests should validate live config. Consider importing @dungeon/content');
  }

  // Contract tests should NOT use randomness
  if (/random|rng|Math\.random/.test(code)) {
    mutableIssues.push({
      severity: 'warning',
      code: 'CONTRACT_TEST_RANDOMNESS',
      description: 'Contract tests should be deterministic. Avoid randomness.',
    });
  }

  // Contract tests should focus on structure, not values
  if (hasValueAssertions === true && /===|\===|toBe\(\d+\)/.test(code)) {
    mutableSuggestions.push(
      'Contract tests should validate schema and relationships, not exact values. Use toMatchObject() instead.',
    );
  }
}

function validatePropertyLayer(
  code: string,
  mutableSuggestions: string[],
): void {
  if (/fc\.property|test\.prop|fast-check/.test(code) !== true) {
    mutableSuggestions.push(
      'Property tests should exercise invariants over generated inputs (for example, fast-check fc.property).',
    );
  }
}

function validateIntegrationLayer(
  code: string,
  usesFullState: boolean,
  hasEventAssertions: boolean,
  hasFormatEvent: boolean,
  mutableIssues: Issue[],
  mutableSuggestions: string[],
): void {
  void code; // Mark as used in comments
  void mutableIssues;
  // Integration tests SHOULD use full state
  if (usesFullState !== true) {
    mutableSuggestions.push('Integration tests should use full GameState and GameEngine for realistic flows');
  }

  // Integration tests SHOULD verify events
  if (hasEventAssertions !== true) {
    mutableSuggestions.push('Integration tests should verify events are emitted (use assertFeatureChain)');
  }

  // Integration tests should verify view output
  if (hasFormatEvent !== true) {
    mutableSuggestions.push('Integration tests should verify presenter output (buildGameView, formatEvent)');
  }
}

function validateBalanceLayer(
  code: string,
  hasUnseededRng: boolean,
  hasValueAssertions: boolean,
  mutableIssues: Issue[],
  mutableSuggestions: string[],
): void {
  // Balance tests SHOULD use seeded RNG
  if (hasUnseededRng === true && !/SeededRng|fixedSeed|seed:/.test(code)) {
    mutableIssues.push({
      severity: 'error',
      code: 'BALANCE_TEST_UNSEEDED',
      description: 'Balance test uses unseeded randomness. Results will not be reproducible.',
    });
  }

  // Balance tests should NOT assert exact values
  if (hasValueAssertions === true && /toBe\(\d+\)/.test(code)) {
    mutableIssues.push({
      severity: 'warning',
      code: 'BALANCE_TEST_EXACT_VALUE',
      description: 'Balance test asserts exact value. Use ranges (e.g., toBeGreaterThan, toBeWithin).',
    });
    mutableSuggestions.push('Replace exact value assertions with range or distribution assertions');
  }

  // Balance tests should assert distributions/ranges
  if (/ > | < | Between | Range | Distribution /.test(code) !== true) {
    mutableSuggestions.push('Balance tests should assert ranges or distributions (e.g., between 40-60)');
  }
}

function validateE2eLayer(
  code: string,
  mutableSuggestions: string[],
): void {
  if (/@playwright\/test/.test(code) !== true) {
    mutableSuggestions.push('E2E tests should use Playwright and verify browser-visible behavior.');
  }
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
  const mutableImports: ImportDecl[] = [];
  const importRegex = /import\s+(type\s+)?(?:(?:\{([^}]+)\})|(?:\*\s+as\s+(\w+))|(\w+)(?:\s*,\s*\{([^}]+)\})?)\s+from\s+['\"]([^'\"]+)['\"]/g;

  let match;
  while ((match = importRegex.exec(code))) {
    const typeOnly = match[1] !== undefined;
    const namedImports = match[2] ?? match[5];
    const namespaceImport = match[3];
    const defaultImport = match[4];
    const names = [
      ...(defaultImport !== undefined ? [defaultImport] : []),
      ...(namespaceImport !== undefined ? [namespaceImport] : []),
      ...((namedImports ?? '') !== '' ? (namedImports ?? '').split(',').map((n) => n.trim()) : []),
    ];
    const from = match[6] ?? '';
    names.forEach((name) => {
      if (name !== '' && from !== '') {
        mutableImports.push({ name: name.replace(/\s+as\s+\w+$/, ''), from, typeOnly });
      }
    });
  }

  return mutableImports;
}

function calculateConfidence(issues: Issue[], code: string): number {
  // Higher confidence if fewer ambiguous patterns
  let confidence = 0.9;

  if (issues.length > 3) confidence -= 0.1;
  if (code.length < 100) confidence -= 0.1; // Too small to fully analyze
  if (code.includes('TODO') || code.includes('FIXME')) confidence -= 0.1; // Incomplete

  return Math.max(0.5, confidence);
}
