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
  layer: 'unit' | 'contract' | 'integration' | 'balance' | 'smoke';
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
  const issues: Issue[] = [];
  const suggestions: string[] = [];

  // Parse imports
  const imports = parseImports(code);
  const usesLiveConfig = imports.some((i) => i.from === '@dungeon/content');
  const usesSeededRng = imports.some((i) => i.name === 'SeededRng' || i.name === 'Rng');

  // Analyze code patterns
  const hasConfigValueAssertion = /expect\(\s*\w+\..*\)\s*\.toBe\(\s*\d+/.test(code);
  const hasUnseededRandom = /Math\.random\(\)|randomInt\(|Math\.floor\(Math\.random/.test(code);
  const createsFullGameState = /new GameState|createGameState|GameEngine/.test(code);
  const hasFormatEvent = /formatEvent|combatLog|gameView/i.test(code);
  const hasEventAssertion = /expectEventEmitted|eventType|\.events\./.test(code);
  void code; // Mark as used

  // Layer-specific validation
  if (proposedLayer === 'unit') {
    validateUnitLayer(code, imports, hasConfigValueAssertion, hasUnseededRandom, issues, suggestions);
  } else if (proposedLayer === 'contract') {
    validateContractLayer(code, usesLiveConfig, hasConfigValueAssertion, issues, suggestions);
  } else if (proposedLayer === 'integration') {
    validateIntegrationLayer(
      code,
      createsFullGameState,
      hasEventAssertion,
      hasFormatEvent,
      issues,
      suggestions,
    );
  } else if (proposedLayer === 'balance') {
    validateBalanceLayer(code, hasUnseededRandom, hasConfigValueAssertion, issues, suggestions);
  }

  // General anti-patterns (all layers)
  if (hasUnseededRandom && !usesSeededRng) {
    issues.push({
      severity: 'error',
      code: 'UNSEEDED_RNG',
      description: 'Test uses Math.random() or unseeded randomness. Use SeededRng for reproducibility.',
    });
    suggestions.push('Replace Math.random() with SeededRng');
  }

  if (hasConfigValueAssertion && proposedLayer !== 'contract') {
    issues.push({
      severity: 'warning',
      code: 'VALUE_ASSERTION',
      description: 'Test asserts exact config values. Consider testing behavior instead.',
    });
    suggestions.push('Replace value assertions with behavior assertions (e.g., damage > 0)');
  }

  if (usesLiveConfig && proposedLayer === 'unit') {
    issues.push({
      severity: 'error',
      code: 'CONFIG_IMPORT_IN_UNIT',
      description: 'Unit test imports @dungeon/content directly. Use fixtures and builders instead.',
    });
    suggestions.push('Use test fixtures or builders instead of live config');
  }

  return {
    layer: (proposedLayer as any) || 'unit',
    issues,
    suggestions,
    validated: issues.filter((i) => i.severity === 'error').length === 0,
    confidence: calculateConfidence(issues, code),
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
  issues: Issue[],
  suggestions: string[],
): void {
  void hasValueAssertions; // Mark as used in comments
  void hasUnseededRng;
  void code;
  // Unit tests should NOT create full game state
  if (/GameEngine|new GameState|createGameState\(/.test(code)) {
    issues.push({
      severity: 'warning',
      code: 'UNIT_TEST_TOO_LARGE',
      description: 'Unit test appears to use GameEngine or full GameState. Consider breaking into smaller tests.',
    });
    suggestions.push(
      'Use focused unit tests for single functions; move integration flows to integration tests',
    );
  }

  // Unit tests should use builders/fixtures
  const hasBuilder = imports.some((i) => i.name.includes('Builder'));
  if (!hasBuilder && /new.*\(.*\{/.test(code)) {
    suggestions.push('Consider using builders (PlayerBuilder, EnemyBuilder) for object construction');
  }
}

function validateContractLayer(
  code: string,
  usesLiveConfig: boolean,
  hasValueAssertions: boolean,
  issues: Issue[],
  suggestions: string[],
): void {
  // Contract tests SHOULD use live config
  if (!usesLiveConfig) {
    suggestions.push('Contract tests should validate live config. Consider importing @dungeon/content');
  }

  // Contract tests should NOT use randomness
  if (/random|rng|Math\.random/.test(code)) {
    issues.push({
      severity: 'warning',
      code: 'CONTRACT_TEST_RANDOMNESS',
      description: 'Contract tests should be deterministic. Avoid randomness.',
    });
  }

  // Contract tests should focus on structure, not values
  if (hasValueAssertions && /===|\===|toBe\(\d+\)/.test(code)) {
    suggestions.push(
      'Contract tests should validate schema and relationships, not exact values. Use toMatchObject() instead.',
    );
  }
}

function validateIntegrationLayer(
  code: string,
  usesFullState: boolean,
  hasEventAssertions: boolean,
  hasFormatEvent: boolean,
  issues: Issue[],
  suggestions: string[],
): void {
  void code; // Mark as used in comments
  void issues;
  // Integration tests SHOULD use full state
  if (!usesFullState) {
    suggestions.push('Integration tests should use full GameState and GameEngine for realistic flows');
  }

  // Integration tests SHOULD verify events
  if (!hasEventAssertions) {
    suggestions.push('Integration tests should verify events are emitted (use assertFeatureChain)');
  }

  // Integration tests should verify view output
  if (!hasFormatEvent) {
    suggestions.push('Integration tests should verify presenter output (buildGameView, formatEvent)');
  }
}

function validateBalanceLayer(
  code: string,
  hasUnseededRng: boolean,
  hasValueAssertions: boolean,
  issues: Issue[],
  suggestions: string[],
): void {
  // Balance tests SHOULD use seeded RNG
  if (hasUnseededRng && !/SeededRng|fixedSeed|seed:/.test(code)) {
    issues.push({
      severity: 'error',
      code: 'BALANCE_TEST_UNSEEDED',
      description: 'Balance test uses unseeded randomness. Results will not be reproducible.',
    });
  }

  // Balance tests should NOT assert exact values
  if (hasValueAssertions && /toBe\(\d+\)/.test(code)) {
    issues.push({
      severity: 'warning',
      code: 'BALANCE_TEST_EXACT_VALUE',
      description: 'Balance test asserts exact value. Use ranges (e.g., toBeGreaterThan, toBeWithin).',
    });
    suggestions.push('Replace exact value assertions with range or distribution assertions');
  }

  // Balance tests should assert distributions/ranges
  if (!/ > | < | Between | Range | Distribution /.test(code)) {
    suggestions.push('Balance tests should assert ranges or distributions (e.g., between 40-60)');
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface ImportDecl {
  name: string;
  from: string;
}

function parseImports(code: string): ImportDecl[] {
  const imports: ImportDecl[] = [];
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(code))) {
    const names = match[1] ? match[1].split(',').map((n) => n.trim()) : (match[2] ? [match[2]] : []);
    const from = match[3] ?? '';
    names.forEach((name) => {
      if (name && from) {
        imports.push({ name, from });
      }
    });
  }

  return imports;
}

function calculateConfidence(issues: Issue[], code: string): number {
  // Higher confidence if fewer ambiguous patterns
  let confidence = 0.9;

  if (issues.length > 3) confidence -= 0.1;
  if (code.length < 100) confidence -= 0.1; // Too small to fully analyze
  if (code.includes('TODO') || code.includes('FIXME')) confidence -= 0.1; // Incomplete

  return Math.max(0.5, confidence);
}
