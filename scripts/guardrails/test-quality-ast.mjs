import ts from 'typescript';
import { lineNumberAt } from './common.mjs';

const VITEST_CALL_BASES = new Set(['test', 'it', 'describe']);
const PRESENCE_MATCHERS = new Set([
  'toBeVisible',
  'toBeAttached',
  'toBeInViewport',
  'toHaveCount',
  'toBeTruthy',
  'toBeDefined',
]);

export function createSourceFile(relativePath, source) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

export function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function* childNodes(root) {
  let emitChildren = function* emptyChildNodes() {};
  ts.forEachChild(root, (child) => {
    const emitPreviousChildren = emitChildren;
    emitChildren = function* nextChildNodes() {
      yield* emitPreviousChildren();
      yield child;
    };
  });
  yield* emitChildren();
}

function* matchingNodes(root, matches) {
  if (matches(root)) {
    yield root;
  }
  for (const child of childNodes(root)) {
    yield* matchingNodes(child, matches);
  }
}

function collectMatchingNodes(root, matches) {
  return [...matchingNodes(root, matches)];
}

function getPropertyAccessParts(expression) {
  if (!ts.isPropertyAccessExpression(expression)) {
    return { root: expression, propertyNames: [] };
  }

  const parts = getPropertyAccessParts(expression.expression);
  return {
    root: parts.root,
    propertyNames: [expression.name.text, ...parts.propertyNames],
  };
}

function getVitestCall(node) {
  const expression = node.expression;

  if (ts.isIdentifier(expression) && VITEST_CALL_BASES.has(expression.text)) {
    return { base: expression.text, modifier: null };
  }

  if (!ts.isPropertyAccessExpression(expression)) {
    return null;
  }

  // Walk the whole member-access chain so chained/nested forms like
  // test.describe.only(...), test.describe.skip(...), and test.only.each(...)
  // are detected, not just single-level test.only(...).
  const { root, propertyNames } = getPropertyAccessParts(expression);
  if (!ts.isIdentifier(root) || VITEST_CALL_BASES.has(root.text) === false) {
    return null;
  }

  const modifier = propertyNames.includes('only')
    ? 'only'
    : propertyNames.includes('skip')
      ? 'skip'
      : null;

  return { base: root.text, modifier };
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

export function collectVitestCalls(sourceFile) {
  return collectMatchingNodes(sourceFile, ts.isCallExpression)
    .map((node) => ({ node, vitestCall: getVitestCall(node) }))
    .filter(({ vitestCall }) => vitestCall !== null)
    .map(({ node, vitestCall }) => ({ node, ...vitestCall }));
}

export function collectTestCases(sourceFile) {
  return collectMatchingNodes(sourceFile, ts.isCallExpression)
    .map(getTestCase)
    .filter((testCase) => testCase !== null);
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

export function getExpectMatcher(node) {
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

export function isNumericExpression(node) {
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

export function collectAssertions(callback, sourceFile) {
  return collectMatchingNodes(callback, ts.isCallExpression)
    .map((node) => ({ node, matcher: getExpectMatcher(node) }))
    .filter(({ matcher }) => matcher !== null)
    .map(({ node, matcher }) => ({
      ...matcher,
      node,
      line: lineNumberAt(sourceFile.text, node.getStart(sourceFile)),
    }));
}

export function isWeakAssertion(assertion, sourceFile) {
  return (
    assertion.matcher === 'toBeDefined'
    || assertion.matcher === 'toBeTruthy'
    || isLengthGreaterThanAssertion(assertion, sourceFile)
  );
}

export function hasContentImport(sourceFile) {
  return collectMatchingNodes(
    sourceFile,
    (node) => (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && /^@dungeon\/content(?:\/|$)/.test(node.moduleSpecifier.text)
    ),
  )[0] ?? null;
}

export function findIdentifier(sourceFile, name) {
  return collectMatchingNodes(
    sourceFile,
    (node) => ts.isIdentifier(node) && node.text === name,
  )[0] ?? null;
}

export function hasInteractionSignal(testBody) {
  return /\b(?:click|dblclick|press|fill|type|dragTo|hover)\s*\(/.test(testBody)
    || /\b(?:keyboard|mouse)\s*\./.test(testBody)
    || /\b(?:submitCommand|actionButton|dispatchEvent|startNewGame|newGame)\b/.test(testBody);
}

export function isPresenceMatcher(matcher) {
  return PRESENCE_MATCHERS.has(matcher);
}
