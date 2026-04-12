import { describe, it, expect, beforeEach } from 'vitest';
import { shouldCancelAutoWalk } from './auto-walk.js';
import { createTestGameState } from '../test-utils.js';
import type { GameView } from '@dungeon/presenter';

describe('shouldCancelAutoWalk', () => {
  let prevView: GameView;
  let newView: GameView;

  beforeEach(() => {
    // Create minimal game views for testing
    // Using test utils to generate views
    const state = createTestGameState();

    // These would normally come from buildGameView(state)
    // For now, we'll create mock views
    prevView = {
      gameId: 'test',
      phase: 'dungeon',
      player: {
        id: 'p1',
        name: 'Test',
        level: 1,
        health: 100,
        maxHealth: 100,
        stats: { attack: 10, defense: 5, accuracy: 10, evasion: 5, speed: 10, maxHealth: 100 },
        abilities: [],
        weaponMastery: { blade: 0, bludgeon: 0, axe: 0, ranged: 0 },
        equipment: {
          weapon: null,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
          secondaryWeapon: null,
        },
      },
      map: {
        cells: [],
        entities: [],
        playerPosition: { x: 0, y: 0 },
      },
      combatLog: [],
      availableActions: [],
      town: null,
      inventory: { items: [] },
      activeQuests: [],
      runResult: null,
      deathStashFloor: null,
      deathSummary: null,
    };

    newView = { ...prevView };
  });

  it('returns false when phase is still dungeon and no threats', () => {
    const result = shouldCancelAutoWalk(prevView, newView);
    expect(result).toBe(false);
  });

  it('returns true when phase changes from dungeon to combat', () => {
    const newViewWithCombat: GameView = { ...newView, phase: 'combat' };
    const result = shouldCancelAutoWalk(prevView, newViewWithCombat);
    expect(result).toBe(true);
  });

  it('returns true when phase changes from dungeon to town', () => {
    const newViewWithTown: GameView = { ...newView, phase: 'town' };
    const result = shouldCancelAutoWalk(prevView, newViewWithTown);
    expect(result).toBe(true);
  });

  it('returns true when phase changes from dungeon to game_over', () => {
    const newViewGameOver: GameView = { ...newView, phase: 'game_over' };
    const result = shouldCancelAutoWalk(prevView, newViewGameOver);
    expect(result).toBe(true);
  });

  it('returns true when player health decreases', () => {
    const newViewDamaged: GameView = {
      ...newView,
      player: { ...newView.player, health: 80 },
    };
    const result = shouldCancelAutoWalk(prevView, newViewDamaged);
    expect(result).toBe(true);
  });

  it('returns false when player health stays the same', () => {
    const newViewSameHealth: GameView = {
      ...newView,
      player: { ...newView.player, health: 100 },
    };
    const result = shouldCancelAutoWalk(prevView, newViewSameHealth);
    expect(result).toBe(false);
  });

  it('returns false when player health increases (healing)', () => {
    const prevViewLowHealth: GameView = {
      ...prevView,
      player: { ...prevView.player, health: 80 },
    };
    const newViewHealed: GameView = {
      ...newView,
      player: { ...newView.player, health: 100 },
    };
    const result = shouldCancelAutoWalk(prevViewLowHealth, newViewHealed);
    expect(result).toBe(false);
  });

  it('returns true when new threat appears (new entity in map)', () => {
    const newViewWithEnemy: GameView = {
      ...newView,
      map: {
        ...newView.map!,
        entities: [
          {
            type: 'enemy',
            id: 'enemy1',
            name: 'Orc',
            x: 1,
            y: 1,
            health: 20,
            maxHealth: 20,
            ascii: 'O',
            color: '#f00',
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
      name: 'Orc',
      x: 1,
      y: 1,
      health: 20,
      maxHealth: 20,
      ascii: 'O',
      color: '#f00',
    };
    const prevViewWithEnemy: GameView = {
      ...prevView,
      map: { ...prevView.map!, entities: [enemy] },
    };
    const newViewSameEnemy: GameView = {
      ...newView,
      map: { ...newView.map!, entities: [enemy] },
    };
    const result = shouldCancelAutoWalk(prevViewWithEnemy, newViewSameEnemy);
    expect(result).toBe(false);
  });
});
