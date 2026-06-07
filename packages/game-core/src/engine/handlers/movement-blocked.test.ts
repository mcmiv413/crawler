import { describe, it, expect } from 'vitest';
import { handleMove } from './movement.js';
import { SeededRNG } from '../../utils/rng.js';
import type { DomainEvent, GameState } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { createTestGameStateInCombat, createTestGameState } from '../../test-utils.js';

function getMovementBlockedEvent(
  events: readonly DomainEvent[],
): Extract<DomainEvent, { type: 'MOVEMENT_BLOCKED' }> | undefined {
  return events.find(
    (event): event is Extract<DomainEvent, { type: 'MOVEMENT_BLOCKED' }> => event.type === 'MOVEMENT_BLOCKED',
  );
}

describe('handleMove - blocked movement observability (Phase 4A)', () => {
  it('emits MOVEMENT_BLOCKED with OUT_OF_BOUNDS when moving off the map', () => {
    // Player at (0,0); moving W targets (-1,0) which has no cell.
    // Move the enemy away so the only failure is bounds.
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const turnsBefore = state.turnNumber;
    const positionBefore = state.player.position;
    const rng = new SeededRNG(42);

    const result = handleMove(state, 'W', rng);

    const blocked = getMovementBlockedEvent(result.events);
    expect(blocked).toBeDefined();
    expect(blocked?.reasonCode).toBe('OUT_OF_BOUNDS');
    expect(blocked?.message.length).toBeGreaterThan(0);
    expect(blocked?.from).toEqual(positionBefore);
    expect(blocked?.direction).toBe('W');

    // No silent success, no attack
    expect(result.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
    expect(result.events.some((e) => e.type === 'ATTACK_PERFORMED')).toBe(false);

    // State / turn preserved
    expect(result.state.player.position).toEqual(positionBefore);
    expect(result.state.turnNumber).toBe(turnsBefore);
    expect(result.runEnded).toBe(false);
  });

  it('emits MOVEMENT_BLOCKED with NOT_WALKABLE when moving into a wall', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    // Turn the (0,1) cell into a non-walkable wall.
    const wallKey = posKey({ x: 0, y: 1 });
    const cells = new Map(state.run!.floor.cells);
    cells.set(wallKey, {
      tile: { type: 'wall', walkable: false, blocksVision: true, ascii: '#', color: '#444' },
      visibility: 'visible',
    });
    const stateWithWall: GameState = {
      ...state,
      run: { ...state.run!, floor: { ...state.run!.floor, cells } },
    };
    const turnsBefore = stateWithWall.turnNumber;
    const positionBefore = stateWithWall.player.position;
    const rng = new SeededRNG(42);

    const result = handleMove(stateWithWall, 'S', rng);

    const blocked = getMovementBlockedEvent(result.events);
    expect(blocked).toBeDefined();
    expect(blocked?.reasonCode).toBe('NOT_WALKABLE');
    expect(blocked?.message.length).toBeGreaterThan(0);

    expect(result.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
    expect(result.state.player.position).toEqual(positionBefore);
    expect(result.state.turnNumber).toBe(turnsBefore);
    expect(result.runEnded).toBe(false);
  });

  it('emits MOVEMENT_BLOCKED with NOT_IN_DUNGEON when there is no active run', () => {
    // createTestGameState has run === null (town phase).
    const state = createTestGameState();
    const turnsBefore = state.turnNumber;
    const positionBefore = state.player.position;
    const rng = new SeededRNG(42);

    const result = handleMove(state, 'E', rng);

    const blocked = getMovementBlockedEvent(result.events);
    expect(blocked).toBeDefined();
    expect(blocked?.reasonCode).toBe('NOT_IN_DUNGEON');
    expect(blocked?.message.length).toBeGreaterThan(0);

    expect(result.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
    expect(result.state.player.position).toEqual(positionBefore);
    expect(result.state.turnNumber).toBe(turnsBefore);
    expect(result.runEnded).toBe(false);
  });

  it('does not advance the turn, regen mana, or process enemy turns on blocked movement', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const rng = new SeededRNG(42);

    const result = handleMove(state, 'W', rng);

    // No enemy movement / spawn / status ticks from enemy turns
    expect(result.events.some((e) => e.type === 'ENEMY_MOVED')).toBe(false);
    expect(result.events.some((e) => e.type === 'MANA_CHANGED')).toBe(false);
    expect(result.events.some((e) => e.type === 'TRAP_TRIGGERED')).toBe(false);
    // State object is returned unchanged (no metrics update / FOV recompute)
    expect(result.state).toBe(state);
    expect(result.state.turnNumber).toBe(state.turnNumber);
  });

  it('still performs bump-to-attack when moving into an enemy (no MOVEMENT_BLOCKED)', () => {
    // Default enemy is at (1,0); player at (0,0); moving E bumps the enemy.
    const state = createTestGameStateInCombat();
    const rng = new SeededRNG(42);

    const result = handleMove(state, 'E', rng);

    // Bump-to-attack path: must emit combat feedback, not blocked movement.
    expect(getMovementBlockedEvent(result.events)).toBeUndefined();
    expect(result.events.some((e) => e.type === 'ATTACK_PERFORMED')).toBe(true);
    // Player should not have moved onto the enemy tile.
    expect(result.state.player.position).toEqual({ x: 0, y: 0 });
  });
});
