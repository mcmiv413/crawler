#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isCliMain, normalizePath } from './common.mjs';

export const BROWSER_FACING_WEB_UI_PREFIXES = [
  'apps/web/src/components/',
  'apps/web/src/hooks/',
  'apps/web/src/animation-runtime/',
  'apps/web/src/rendering/',
  'apps/web/src/store/',
];

export const BROWSER_FACING_WEB_UI_EXACT_PATHS = [
  'apps/web/src/App.tsx',
];

export const BROWSER_FACING_PREFIXES = [
  ...BROWSER_FACING_WEB_UI_PREFIXES,
  'apps/web/src/animations/',
  'packages/presenter/src/',
  'packages/game-contracts/src/events/',
  'packages/game-contracts/src/commands/',
  'packages/game-contracts/src/schemas/',
  'packages/content/src/animation-refs/',
  'tests/e2e/support/',
  'fixtures/scenarios/',
];

export const BROWSER_FACING_EXACT_PATHS = [
  ...BROWSER_FACING_WEB_UI_EXACT_PATHS,
  'packages/game-core/src/engine/command-handler.ts',
  'packages/game-core/src/engine/game-engine.ts',
];

export function isBrowserFacingPath(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  return (
    BROWSER_FACING_EXACT_PATHS.includes(normalizedPath)
    || BROWSER_FACING_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  );
}

export function isBrowserFacingWebUiPath(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  return (
    BROWSER_FACING_WEB_UI_EXACT_PATHS.includes(normalizedPath)
    || BROWSER_FACING_WEB_UI_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  );
}

function readChangedPathsFromStdin() {
  return readFileSync(0, 'utf8')
    .split(/\r?\n/u)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

if (isCliMain(import.meta.url)) {
  process.exit(readChangedPathsFromStdin().some(isBrowserFacingPath) ? 0 : 1);
}
