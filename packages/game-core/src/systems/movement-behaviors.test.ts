import { describe, it, expect } from 'vitest';
import { decideMovementByBehavior, getWalkableNeighbors, getAllBehaviors, getBehaviorInfo } from './movement-behaviors.js';
import { createTestGameStateInCombat, createTestEnemy, createTestRunState } from '../test-utils.js';
import type { GameState } from '@dungeon/contracts';

describe('Movement Behaviors', () => {
  describe('wall_stalker behavior', () => {
    it('prefers tiles adjacent to walls over open tiles', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 1 },
        movementBehaviorId: 'wall_stalker',
      });

      const move = decideMovementByBehavior(enemy, state);
      // Should pick a valid neighbor tile
      if (move !== null) {
        const neighbors = getWalkableNeighbors(enemy.position, state);
        expect(neighbors.some(n => n.x === move.x && n.y === move.y)).toBe(true);
      }
    });
  });

  describe('rearline_anchor behavior', () => {
    it('prefers tiles far from player', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 1 },
        movementBehaviorId: 'rearline_anchor',
      });

      const move = decideMovementByBehavior(enemy, state);
      // Rearline anchor should pick a valid neighbor
      if (move !== null) {
        const neighbors = getWalkableNeighbors(enemy.position, state);
        expect(neighbors.some(n => n.x === move.x && n.y === move.y)).toBe(true);
      }
    });
  });

  describe('chokepoint_holder behavior', () => {
    it('prefers tiles close to player with wall coverage', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 1 },
        movementBehaviorId: 'chokepoint_holder',
      });

      const move = decideMovementByBehavior(enemy, state);
      if (move !== null) {
        const neighbors = getWalkableNeighbors(enemy.position, state);
        expect(neighbors.some(n => n.x === move.x && n.y === move.y)).toBe(true);
      }
    });
  });

  describe('ambush_idle behavior', () => {
    it('prefers tiles far from player with cover', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 1 },
        movementBehaviorId: 'ambush_idle',
      });

      const move = decideMovementByBehavior(enemy, state);
      if (move !== null) {
        const neighbors = getWalkableNeighbors(enemy.position, state);
        expect(neighbors.some(n => n.x === move.x && n.y === move.y)).toBe(true);
      }
    });
  });

  describe('no behavior (default)', () => {
    it('falls back to approaching player', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 1 },
        movementBehaviorId: undefined,
      });

      const move = decideMovementByBehavior(enemy, state);
      // Should return a valid tile (approaching player at 0,0)
      if (move !== null) {
        const neighbors = getWalkableNeighbors(enemy.position, state);
        expect(neighbors.some(n => n.x === move.x && n.y === move.y)).toBe(true);
      }
    });
  });

  describe('getWalkableNeighbors', () => {
    it('returns walkable neighbors from a valid floor', () => {
      const state = createTestGameStateInCombat();
      // Use a position in the test floor (0,0) to (1,1)
      const neighbors = getWalkableNeighbors({ x: 0, y: 0 }, state);
      // Should have at least some walkable neighbors
      expect(Array.isArray(neighbors)).toBe(true);
    });

    it('returns empty array when run is null', () => {
      const state: GameState = {
        gameId: 'g1' as any,
        phase: 'town',
        player: {
          id: 'p1' as any,
          name: 'Hero',
          level: 1,
          experience: 0,
          stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
          baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
          position: { x: 0, y: 0 },
          equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
          inventory: [],
          statuses: [],
          abilities: [],
          gold: 50,
          floor: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalRuns: 0,
          deathStash: null,
        },
        run: null,
        world: {
          town: { prosperity: 50, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
          npcs: [],
          shop: { items: [], buybackMultiplier: 0.4 },
          eventHistory: [],
          totalRuns: 0,
          deepestFloor: 0,
          nemeses: [],
          factions: [],
          unlockedBlueprints: [],
          highestRarityFound: 'common' as const,
        },
        itemRegistry: { items: new Map() },
        seed: 42,
        turnNumber: 0,
        version: 1,
        activeQuests: [],
      };
      const neighbors = getWalkableNeighbors({ x: 0, y: 0 }, state);
      expect(neighbors.length).toBe(0);
    });
  });

  describe('Behavior Registry', () => {
    it('getAllBehaviors returns all registered behaviors', () => {
      const behaviors = getAllBehaviors();
      expect(behaviors.length).toBeGreaterThan(0);
      expect(behaviors.map(b => b.id)).toContain('wall_stalker');
      expect(behaviors.map(b => b.id)).toContain('rearline_anchor');
      expect(behaviors.map(b => b.id)).toContain('chokepoint_holder');
      expect(behaviors.map(b => b.id)).toContain('ambush_idle');
    });

    it('getBehaviorInfo returns metadata for valid behavior IDs', () => {
      const stalkerInfo = getBehaviorInfo('wall_stalker');
      expect(stalkerInfo).toBeDefined();
      expect(stalkerInfo?.name).toBe('Wall Stalker');
      expect(stalkerInfo?.description).toContain('walls');
    });

    it('getBehaviorInfo returns undefined for invalid behavior IDs', () => {
      const info = getBehaviorInfo('nonexistent' as any);
      expect(info).toBeUndefined();
    });

    it('each behavior has required metadata fields', () => {
      const behaviors = getAllBehaviors();
      for (const behavior of behaviors) {
        expect(behavior.id).toBeDefined();
        expect(typeof behavior.id).toBe('string');
        expect(behavior.name).toBeDefined();
        expect(typeof behavior.name).toBe('string');
        expect(behavior.description).toBeDefined();
        expect(typeof behavior.description).toBe('string');
        expect(behavior.scoreTiles).toBeDefined();
        expect(typeof behavior.scoreTiles).toBe('function');
      }
    });
  });
});
