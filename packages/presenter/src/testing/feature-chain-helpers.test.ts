/**
 * Test layer: unit
 * Behavior: Feature Chain Helpers covers assertFeatureChain; runs entryCheck, viewChecks, and uiCheck against the presenter view contract; fails when entryCheck reports the featu....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/presenter/src/testing/feature-chain-helpers.test.ts
 */
import { describe, expect, it } from 'vitest';
import { handleCommand, SeededRNG } from '@dungeon/core';
import { createTestGameStateInCombat } from '@dungeon/core/testing';
import { buildGameView } from '../game-view-builder.js';
import { assertFeatureChain } from './feature-chain-helpers.js';

function createMoveResult() {
  const before = createTestGameStateInCombat({ enemyAt: { x: 3, y: 3 } });
  const result = handleCommand(before, { type: 'MOVE', direction: 'E' }, new SeededRNG(1));

  return { before, result };
}

describe('assertFeatureChain', () => {
  it('runs entryCheck, viewChecks, and uiCheck against the presenter view contract', () => {
    const { before, result } = createMoveResult();

    assertFeatureChain(result, before, {
      eventType: 'PLAYER_MOVED',
      entryCheck: (state) =>
        buildGameView(state).availableActions.some(
          (action) => action.id === 'move_e' && action.type === 'move' && action.enabled,
        ),
      stateChanges: (previous, after) =>
        after.player.position.x === previous.player.position.x + 1 &&
        after.player.position.y === previous.player.position.y,
      viewChecks: (beforeView, afterView) =>
        beforeView.map?.playerPosition.x === 0 &&
        beforeView.map?.playerPosition.y === 0 &&
        afterView.map?.playerPosition.x === 1 &&
        afterView.map?.playerPosition.y === 0,
      uiCheck: (view) =>
        view.map?.playerPosition.x === result.state.player.position.x &&
        view.map?.playerPosition.y === result.state.player.position.y,
    });
  });

  it('fails when entryCheck reports the feature is not triggerable', () => {
    const { before, result } = createMoveResult();

    expect(() =>
      assertFeatureChain(result, before, {
        entryCheck: () => false,
      }),
    ).toThrowError('Expected the feature entry point to be triggerable from the before-state');
  });

  it('fails when uiCheck reports the UI-facing data is missing', () => {
    const { before, result } = createMoveResult();

    expect(() =>
      assertFeatureChain(result, before, {
        eventType: 'PLAYER_MOVED',
        uiCheck: () => false,
      }),
    ).toThrowError('Expected the GameView to contain the UI-facing data for this feature');
  });
});
