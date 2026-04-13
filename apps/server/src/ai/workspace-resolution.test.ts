/**
 * Regression guard: verifies that @dungeon/core root and subpath exports
 * all resolve correctly under Vitest.
 *
 * If these break, the fix is NOT in the test config — it is in:
 *   - packages/game-core/package.json (exports field)
 *   - pnpm workspace linkage (run `pnpm list --filter @dungeon/server`)
 *   - built dist/ files (run `pnpm -r build`)
 */
import { describe, it, expect } from 'vitest';
import * as core from '@dungeon/core';
import * as aiService from '@dungeon/core/ai/ai-service.js';
import * as promptBuilders from '@dungeon/core/ai/prompt-builders.js';

describe('workspace package resolution', () => {
  it('resolves @dungeon/core root export', () => {
    expect(core).toBeDefined();
  });

  it('resolves @dungeon/core/ai/ai-service.js subpath', () => {
    expect(aiService).toBeDefined();
  });

  it('resolves @dungeon/core/ai/prompt-builders.js subpath', () => {
    expect(promptBuilders).toBeDefined();
  });

  it('prompt builder functions are callable', () => {
    expect(typeof promptBuilders.buildNpcDialoguePrompt).toBe('function');
    expect(typeof promptBuilders.buildRumorPrompt).toBe('function');
    expect(typeof promptBuilders.buildRunSummaryPrompt).toBe('function');
  });
});
