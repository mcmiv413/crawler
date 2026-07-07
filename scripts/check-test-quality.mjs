#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { lineNumberAt, normalizePath } from './guardrails/common.mjs';

const DEFAULT_BASE_REF = process.env.TEST_QUALITY_BASE ?? 'main';
const TEST_LAYER_VALUES = new Set(['unit', 'property', 'contract', 'integration', 'balance', 'e2e']);
const TUNABLE_GAME_CORE_TEST_ROOTS = [
  'packages/game-core/src/systems/',
  'packages/game-core/src/abilities/effects/',
  'packages/game-core/src/abilities/runtime/',
  'packages/game-core/src/engine/handlers/',
];
const PRESENCE_MATCHERS = new Set([
  'toBeVisible',
  'toBeAttached',
  'toBeInViewport',
  'toHaveCount',
  'toBeTruthy',
  'toBeDefined',
]);

function runGit(repoRoot, args, options = {}) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    if (options.allowFailure === true) {
      return '';
    }
    throw new Error((result.stderr || result.stdout || '').trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function splitGitPaths(output) {
  return output
    .split('\n')
    .map((path) => normalizePath(path.trim()))
    .filter(Boolean);
}

function resolveBaseRef(repoRoot, baseRef) {
  const fallbackRef = `origin/${baseRef}`;

  for (const candidateRef of [baseRef, fallbackRef]) {
    const resolved = runGit(repoRoot, ['rev-parse', '--verify', '--quiet', candidateRef], {
      allowFailure: true,
    }).trim();

    if (resolved) {
      return candidateRef;
    }
  }

  throw new Error(
    `Unable to resolve test quality base ref "${baseRef}" or "${fallbackRef}". Fetch the base branch before running this guardrail.`,
  );
}

function listChangedPaths(repoRoot, baseRef = DEFAULT_BASE_REF) {
  const resolvedBaseRef = resolveBaseRef(repoRoot, baseRef);
  const pathSets = [
    splitGitPaths(
      runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR', `${resolvedBaseRef}...HEAD`]),
    ),
    splitGitPaths(runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR'])),
    splitGitPaths(runGit(repoRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])),
    splitGitPaths(runGit(repoRoot, ['ls-files', '--others', '--exclude-standard'])),
  ];

  return [...new Set(pathSets.flat())]
    .filter((relativePath) => existsSync(join(repoRoot, relativePath)))
    .sort();
}

function isChangedTestPath(relativePath) {
  return (
    relativePath.endsWith('.test.ts')
    || relativePath.endsWith('.property.test.ts')
    || (relativePath.startsWith('tests/') && relativePath.endsWith('.ts'))
    || (relativePath.startsWith('tests/e2e/') && relativePath.endsWith('.spec.ts'))
  );
}

function getLayer(relativePath) {
  if (relativePath.startsWith('tests/e2e/') || relativePath.endsWith('.spec.ts')) return 'e2e';
  if (relativePath.startsWith('tests/contracts/') || relativePath.includes('.contract.test.')) return 'contract';
  if (relativePath.startsWith('tests/integration/') || relativePath.includes('.integration.test.')) return 'integration';
  if (relativePath.startsWith('tests/balance/') || relativePath.includes('.balance.test.')) return 'balance';
  if (relativePath.endsWith('.property.test.ts')) return 'property';
  if (relativePath.endsWith('.test.ts')) return 'unit';
  return 'helper';
}

function isUnitOrProperty(relativePath) {
  const layer = getLayer(relativePath);
  return layer === 'unit' || layer === 'property';
}

function isTunableGameCoreTest(relativePath) {
  return TUNABLE_GAME_CORE_TEST_ROOTS.some((root) => relativePath.startsWith(root))
    && relativePath.endsWith('.test.ts');
}

function readSource(repoRoot, relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function createSourceFile(relativePath, source) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function formatSnippet(text) {
  return text
    .split('\n')
    .slice(0, 6)
    .map((line) => `  ${line}`)
    .join('\n');
}

function makeFailure({ title, relativePath, line, found, why, repair }) {
  return {
    title,
    relativePath,
    line,
    found,
    why,
    repair,
  };
}

function formatFailure(failure) {
  const location = `${failure.relativePath}${failure.line ? `:${failure.line}` : ''}`;
  return [
    `Blocked: ${failure.title} in ${location}`,
    '',
    'Found:',
    formatSnippet(failure.found),
    '',
    'Why this is blocked:',
    `  ${failure.why}`,
    '',
    'Repair:',
    ...failure.repair.map((line) => `  ${line}`),
  ].join('\n');
}

function getVitestCall(node) {
  const expression = node.expression;
  if (ts.isIdentifier(expression) && ['test', 'it', 'describe'].includes(expression.text)) {
    return { base: expression.text, modifier: null };
  }

  if (
    ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && ['test', 'it', 'describe'].includes(expression.expression.text)
  ) {
    return { base: expression.expression.text, modifier: expression.name.text };
  }

  return null;
}

function getStringArgText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function isFunctionLikeArg(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function getTestCase(node) {
  const vitestCall = getVitestCall(node);
  if (vitestCall === null || (vitestCall.base !== 'test' && vitestCall.base !== 'it')) {
    return null;
  }

  const callback = node.arguments.find(isFunctionLikeArg);
  if (!callback) return null;

  const titleArg = node.arguments.find((arg) => getStringArgText(arg) !== null);
  return {
    node,
    callback,
    title: titleArg ? getStringArgText(titleArg) ?? '<unnamed test>' : '<unnamed test>',
  };
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function collectVitestCalls(sourceFile) {
  const calls = [];
  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const vitestCall = getVitestCall(node);
      if (vitestCall !== null) {
        calls.push({ node, ...vitestCall });
      }
    }
  });
  return calls;
}

function collectTestCases(sourceFile) {
  const cases = [];
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const testCase = getTestCase(node);
    if (testCase !== null) {
      cases.push(testCase);
    }
  });
  return cases;
}

function findExpectCall(expression) {
  if (ts.isCallExpression(expression)) {
    if (ts.isIdentifier(expression.expression) && expression.expression.text === 'expect') {
      return expression;
    }

    if (
      ts.isPropertyAccessExpression(expression.expression)
      && ts.isIdentifier(expression.expression.expression)
      && expression.expression.expression.text === 'expect'
    ) {
      return expression;
    }

    return findExpectCall(expression.expression);
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return findExpectCall(expression.expression);
  }

  return null;
}

function getExpectMatcher(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return null;
  }

  const matcher = node.expression.name.text;
  const expectCall = findExpectCall(node.expression.expression);
  if (expectCall === null) {
    return null;
  }

  return {
    matcher,
    expectCall,
    text: node.getText(),
  };
}

function isNumericExpression(node) {
  if (ts.isNumericLiteral(node)) return true;
  return (
    ts.isPrefixUnaryExpression(node)
    && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)
    && ts.isNumericLiteral(node.operand)
  );
}

function isBooleanLiteral(node, value) {
  return value ? node.kind === ts.SyntaxKind.TrueKeyword : node.kind === ts.SyntaxKind.FalseKeyword;
}

function numericLiteralValue(node) {
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    const value = Number(node.operand.text);
    return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }

  return null;
}

function isLengthGreaterThanAssertion(assertion, sourceFile) {
  const expected = assertion.expectCall.arguments[0];
  if (!expected) return false;
  const expectedText = expected.getText(sourceFile);
  const firstMatcherArg = assertion.node?.arguments?.[0];

  if (
    assertion.matcher === 'toBeGreaterThan'
    && firstMatcherArg
    && numericLiteralValue(firstMatcherArg) === 0
    && expectedText.includes('.length')
  ) {
    return true;
  }

  if (
    assertion.matcher === 'toBe'
    && firstMatcherArg
    && isBooleanLiteral(firstMatcherArg, true)
    && /\.length\s*>\s*0\b/.test(expectedText)
  ) {
    return true;
  }

  return false;
}

function collectAssertions(callback, sourceFile) {
  const assertions = [];
  walk(callback, (node) => {
    if (!ts.isCallExpression(node)) return;
    const matcher = getExpectMatcher(node);
    if (matcher === null) return;

    assertions.push({
      ...matcher,
      node,
      line: lineNumberAt(sourceFile.text, node.getStart(sourceFile)),
    });
  });
  return assertions;
}

function isWeakAssertion(assertion, sourceFile) {
  return (
    assertion.matcher === 'toBeDefined'
    || assertion.matcher === 'toBeTruthy'
    || isLengthGreaterThanAssertion(assertion, sourceFile)
  );
}

function hasIntentHeader(source) {
  const firstLines = source.split('\n').slice(0, 30).join('\n');
  const fields = {
    layer: firstLines.match(/Test layer:\s*(.+)/i)?.[1]?.trim(),
    behavior: firstLines.match(/Behavior:\s*(.+)/i)?.[1]?.trim(),
    proof: firstLines.match(/Proof:\s*(.+)/i)?.[1]?.trim(),
    validation: firstLines.match(/Validation:\s*(.+)/i)?.[1]?.trim(),
  };

  const missingFields = Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  const layer = fields.layer?.toLowerCase();
  if (layer && TEST_LAYER_VALUES.has(layer) === false) {
    missingFields.push('valid layer');
  }

  if (fields.validation && fields.validation.startsWith('pnpm ') === false) {
    missingFields.push('pnpm validation command');
  }

  return {
    ok: missingFields.length === 0,
    missingFields,
  };
}

function hasContentImport(sourceFile) {
  let contentImport = null;
  walk(sourceFile, (node) => {
    if (contentImport !== null) return;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && /^@dungeon\/content(?:\/|$)/.test(node.moduleSpecifier.text)
    ) {
      contentImport = node;
    }
  });
  return contentImport;
}

function findIdentifier(sourceFile, name) {
  let match = null;
  walk(sourceFile, (node) => {
    if (match !== null) return;
    if (ts.isIdentifier(node) && node.text === name) {
      match = node;
    }
  });
  return match;
}

function hasSkipAllowlist(source, index) {
  const before = source.slice(0, index).split('\n');
  const currentLine = before.length - 1;
  const lines = source.split('\n');
  const nearby = lines.slice(Math.max(0, currentLine - 2), currentLine + 1).join('\n');
  return /test-quality:\s*allow-skip\s+-\s+\S+/i.test(nearby);
}

function hasInteractionSignal(testBody) {
  return /\b(?:click|dblclick|press|fill|type|dragTo|hover)\s*\(/.test(testBody)
    || /\b(?:keyboard|mouse)\s*\./.test(testBody)
    || /\b(?:submitCommand|actionButton|dispatchEvent|startNewGame|newGame)\b/.test(testBody);
}

function isPresenceMatcher(matcher) {
  return PRESENCE_MATCHERS.has(matcher);
}

function checkIntentHeader({ relativePath, source, sourceFile }) {
  const hasTestDeclarations = collectVitestCalls(sourceFile).some(({ base }) =>
    ['test', 'it', 'describe'].includes(base),
  );
  const shouldRequireHeader = relativePath.endsWith('.test.ts')
    || relativePath.endsWith('.property.test.ts')
    || relativePath.endsWith('.spec.ts')
    || hasTestDeclarations;

  if (!shouldRequireHeader) {
    return [];
  }

  const header = hasIntentHeader(source);
  if (header.ok) {
    return [];
  }

  return [
    makeFailure({
      title: 'missing test intent header',
      relativePath,
      line: 1,
      found: source.split('\n').slice(0, 8).join('\n') || '<empty file>',
      why: 'New or changed test files must declare the layer, behavior, proof obligation, and exact validation command before the test body.',
      repair: [
        'Add this header near the top of the file:',
        '/**',
        ' * Test layer: Unit | Property | Contract | Integration | Balance | E2E',
        ' * Behavior: the required behavior this file proves.',
        ' * Proof: the state/event/view/UI evidence asserted by the tests.',
        ' * Validation: <smallest pnpm command that runs this file, e.g. `pnpm vitest run path/to/file.test.ts` or `pnpm test:e2e path/to/file.spec.ts`>',
        ' */',
        `Missing: ${header.missingFields.join(', ')}`,
      ],
    }),
  ];
}

function checkFocusedAndSkipped({ relativePath, source, sourceFile }) {
  const failures = [];
  for (const call of collectVitestCalls(sourceFile)) {
    if (call.modifier !== 'only' && call.modifier !== 'skip') {
      continue;
    }

    const line = lineNumberAt(source, call.node.getStart(sourceFile));
    const found = call.node.getText(sourceFile).split('\n')[0] ?? call.node.getText(sourceFile);

    if (call.modifier === 'only') {
      failures.push(
        makeFailure({
          title: 'focused test',
          relativePath,
          line,
          found,
          why: 'Focused tests hide the rest of the suite and can let broken behavior pass locally.',
          repair: [
            `Replace ${call.base}.only with ${call.base}.`,
            'Run the smallest affected test command, then finish on pnpm validate.',
          ],
        }),
      );
      continue;
    }

    if (hasSkipAllowlist(source, call.node.getStart(sourceFile))) {
      continue;
    }

    failures.push(
      makeFailure({
        title: 'skipped test without allowlist',
        relativePath,
        line,
        found,
        why: 'Skipped tests silently remove proof. This repo only allows them when the reason is explicit and searchable.',
        repair: [
          `Enable the test by replacing ${call.base}.skip with ${call.base}.`,
          'If a skip is intentional, add a nearby comment: // test-quality: allow-skip - tracked reason',
        ],
      }),
    );
  }
  return failures;
}

function checkMathRandom({ relativePath, source, sourceFile }) {
  const failures = [];
  walk(sourceFile, (node) => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === 'Math'
      && node.expression.name.text === 'random'
    ) {
      failures.push(
        makeFailure({
          title: 'unseeded randomness',
          relativePath,
          line: lineNumberAt(source, node.getStart(sourceFile)),
          found: node.getText(sourceFile),
          why: 'Math.random() makes tests nondeterministic and can hide flakes behind lucky runs.',
          repair: [
            'Use SeededRng or an explicit local fake RNG.',
            'Keep the seed in the test so failures can be reproduced.',
          ],
        }),
      );
    }
  });
  return failures;
}

function checkWeakAssertionOnlyTests({ relativePath, sourceFile }) {
  const failures = [];
  for (const testCase of collectTestCases(sourceFile)) {
    const assertions = collectAssertions(testCase.callback, sourceFile);
    const weakAssertions = assertions.filter((assertion) => isWeakAssertion(assertion, sourceFile));
    const strongAssertions = assertions.filter((assertion) => isWeakAssertion(assertion, sourceFile) === false);

    if (weakAssertions.length === 0 || strongAssertions.length > 0) {
      continue;
    }

    failures.push(
      makeFailure({
        title: 'weak assertion-only test',
        relativePath,
        line: weakAssertions[0].line,
        found: weakAssertions.map((assertion) => assertion.text).join('\n'),
        why: 'These assertions can pass while the required game behavior is broken.',
        repair: [
          'Assert the behavior instead of existence:',
          '- emitted event type',
          '- immutable state transition',
          '- presenter/GameView output',
          '- visible UI text or pixel evidence for browser behavior',
          `Test title: ${testCase.title}`,
        ],
      }),
    );
  }
  return failures;
}

function checkUnitLayerBoundaries({ relativePath, source, sourceFile }) {
  if (!isUnitOrProperty(relativePath)) {
    return [];
  }

  const failures = [];
  const contentImport = hasContentImport(sourceFile);
  if (contentImport !== null) {
    failures.push(
      makeFailure({
        title: 'live content import in unit/property test',
        relativePath,
        line: lineNumberAt(source, contentImport.getStart(sourceFile)),
        found: contentImport.getText(sourceFile),
        why: 'Unit and property tests must use local fixtures/builders. Live @dungeon/content belongs in contract, integration, balance, or E2E layers.',
        repair: [
          'Replace live registry data with a builder or local fixture.',
          'Move live ID and cross-reference proof to tests/contracts when that is the behavior under test.',
        ],
      }),
    );
  }

  const gameEngineIdentifier = findIdentifier(sourceFile, 'GameEngine');
  if (gameEngineIdentifier !== null) {
    failures.push(
      makeFailure({
        title: 'GameEngine usage in unit/property test',
        relativePath,
        line: lineNumberAt(source, gameEngineIdentifier.getStart(sourceFile)),
        found: gameEngineIdentifier.getText(sourceFile),
        why: 'GameEngine builds integrated state. Tests that need it belong in integration, contract, balance, or E2E layers, not unit/property files.',
        repair: [
          'Rename and move the test to the correct layer, or replace GameEngine with focused builders/local fixtures.',
          'Use tests/integration for multi-step engine behavior.',
        ],
      }),
    );
  }

  return failures;
}

function checkPlaywrightPresenceOnly({ relativePath, sourceFile }) {
  if (getLayer(relativePath) !== 'e2e') {
    return [];
  }

  const failures = [];
  for (const testCase of collectTestCases(sourceFile)) {
    const bodyText = testCase.callback.getText(sourceFile);
    const assertions = collectAssertions(testCase.callback, sourceFile);
    if (assertions.length === 0 || hasInteractionSignal(bodyText) === false) {
      continue;
    }

    if (assertions.every((assertion) => isPresenceMatcher(assertion.matcher)) === false) {
      continue;
    }

    failures.push(
      makeFailure({
        title: 'Playwright presence-only behavior proof',
        relativePath,
        line: assertions[0].line,
        found: assertions.map((assertion) => assertion.text).join('\n'),
        why: 'A browser test that performs player behavior but only proves DOM/canvas presence can pass while the player-visible result is wrong.',
        repair: [
          'Assert the actual visible outcome after the action:',
          '- text in the combat log, inventory, action list, or status panel',
          '- event-backed presenter output exposed in the UI',
          '- canvas pixel/sample evidence for renderer behavior',
          `Test title: ${testCase.title}`,
        ],
      }),
    );
  }
  return failures;
}

function checkTunableNumericToBe({ relativePath, source, sourceFile }) {
  if (!isTunableGameCoreTest(relativePath)) {
    return [];
  }

  const failures = [];
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const assertion = getExpectMatcher(node);
    if (assertion === null || assertion.matcher !== 'toBe') return;
    const expected = node.arguments[0];
    if (!expected || isNumericExpression(expected) === false) return;

    failures.push(
      makeFailure({
        title: 'exact numeric assertion in tunable game-core test',
        relativePath,
        line: lineNumberAt(source, node.getStart(sourceFile)),
        found: node.getText(sourceFile),
        why: 'Combat, ability, AI, status, and economy numbers in guarded game-core runtime areas are balance-tunable; exact numeric .toBe(...) assertions become brittle tuning locks.',
        repair: [
          'Assert an invariant, range, ordering, event shape, or state transition instead.',
          'If an exact value is a schema/coordinate constant rather than tuning, move that proof outside the guarded tunable runtime areas or assert a named constant.',
        ],
      }),
    );
  });
  return failures;
}

function checkFile(repoRoot, relativePath) {
  const source = readSource(repoRoot, relativePath);
  const sourceFile = createSourceFile(relativePath, source);
  const context = { relativePath, source, sourceFile };

  return [
    ...checkIntentHeader(context),
    ...checkFocusedAndSkipped(context),
    ...checkMathRandom(context),
    ...checkWeakAssertionOnlyTests(context),
    ...checkUnitLayerBoundaries(context),
    ...checkPlaywrightPresenceOnly(context),
    ...checkTunableNumericToBe(context),
  ];
}

function run() {
  const repoRoot = resolve(process.cwd());
  const changedTestPaths = listChangedPaths(repoRoot)
    .filter(isChangedTestPath);

  const failures = changedTestPaths.flatMap((relativePath) => checkFile(repoRoot, relativePath));

  if (failures.length > 0) {
    console.error([
      'Test quality gate failed.',
      `Checked ${changedTestPaths.length} changed test file(s) only.`,
      '',
      ...failures.map(formatFailure),
    ].join('\n\n'));
    process.exit(1);
  }

  console.log(`Test quality gate passed for ${changedTestPaths.length} changed test file(s).`);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error([
    'Blocked: test quality gate could not run',
    '',
    'Found:',
    `  ${message}`,
    '',
    'Why this is blocked:',
    '  The repository cannot verify changed test files when the guardrail itself fails.',
    '',
    'Repair:',
    '  Fix scripts/check-test-quality.mjs or the local git checkout, then rerun pnpm run check:test-quality.',
  ].join('\n'));
  process.exit(1);
}
