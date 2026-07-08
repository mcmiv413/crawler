/**
 * Test layer: unit
 * Behavior: shouldCancelAutoWalk cancels only when movement leaves dungeon, health decreases, or a new threat appears.
 * Proof: Assertions check boolean returns for unchanged dungeon phase, combat, town, and game_over phase transitions, health loss versus steady or increased health, new map entity threats, and unchanged known enemy positions.
 * Validation: pnpm vitest run packages/game-core/src/utils/auto-walk.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldCancelAutoWalk } from './auto-walk.js';
import { createTestGameState } from '../test-utils.js';

// Minimal view type matching the GameViewRef interface in auto-walk.ts
interface MockView {
  phase: string;
  player: { health: number };
  map?: { entities?: Array<{ id: string; type: string }> };
}

describe('shouldCancelAutoWalk', () => {
  let prevView: MockView;
  let newView: MockView;

  beforeEach(() => {
    // Create minimal game views for testing
    // Using test utils to generate views
    const state = createTestGameState();
    void state;

    // These would normally come from buildGameView(state)
    // For now, we'll create mock views
    prevView = {
      phase: 'dungeon',
      player: {
        health: 100,
      },
      map: {
        entities: [],
      },
    };

    newView = { ...prevView };
  });

  it('returns false when phase is still dungeon and no threats', () => {
    const result = shouldCancelAutoWalk(prevView, newView);
    expect(result).toBe(false);
  });

  it('returns true when phase changes from dungeon to combat', () => {
    const newViewWithCombat: MockView = { ...newView, phase: 'combat' };
    const result = shouldCancelAutoWalk(prevView, newViewWithCombat);
    expect(result).toBe(true);
  });

  it('returns true when phase changes from dungeon to town', () => {
    const newViewWithTown: MockView = { ...newView, phase: 'town' };
    const result = shouldCancelAutoWalk(prevView, newViewWithTown);
    expect(result).toBe(true);
  });

  it('returns true when phase changes from dungeon to game_over', () => {
    const newViewGameOver: MockView = { ...newView, phase: 'game_over' };
    const result = shouldCancelAutoWalk(prevView, newViewGameOver);
    expect(result).toBe(true);
  });

  it('returns true when player health decreases', () => {
    const newViewDamaged: MockView = {
      ...newView,
      player: { ...newView.player, health: 80 },
    };
    const result = shouldCancelAutoWalk(prevView, newViewDamaged);
    expect(result).toBe(true);
  });

  it('returns false when player health stays the same', () => {
    const newViewSameHealth: MockView = {
      ...newView,
      player: { ...newView.player, health: 100 },
    };
    const result = shouldCancelAutoWalk(prevView, newViewSameHealth);
    expect(result).toBe(false);
  });

  it('returns false when player health increases (healing)', () => {
    const prevViewLowHealth: MockView = {
      ...prevView,
      player: { ...prevView.player, health: 80 },
    };
    const newViewHealed: MockView = {
      ...newView,
      player: { ...newView.player, health: 100 },
    };
    const result = shouldCancelAutoWalk(prevViewLowHealth, newViewHealed);
    expect(result).toBe(false);
  });

  it('returns true when new threat appears (new entity in map)', () => {
    const newViewWithEnemy: MockView = {
      ...newView,
      map: {
        ...newView.map,
        entities: [
          {
            type: 'enemy',
            id: 'enemy1',
          },
        ],
      },
    };
    const result = shouldCancelAutoWalk(prevView, newViewWithEnemy);
    expect(result).toBe(true);
  });

  it('returns false when known enemy is still in same position', () => {
    const enemy = {
      type: 'enemy' as const,
      id: 'enemy1',
    };
    const prevViewWithEnemy: MockView = {
      ...prevView,
      map: { ...prevView.map, entities: [enemy] },
    };
    const newViewSameEnemy: MockView = {
      ...newView,
      map: { ...newView.map, entities: [enemy] },
    };
    const result = shouldCancelAutoWalk(prevViewWithEnemy, newViewSameEnemy);
    expect(result).toBe(false);
  });
});
