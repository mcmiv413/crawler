/**
 * Test layer: unit
 * Behavior: Validators covers state validators; validateGameState; accepts valid game state.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/state/validators.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  validateGameState,
  validatePlayer,
  validateRunState,
  validateEnemy,
  validateWorldState,
  isGameStateValid,
} from './validators.js';
import { createTestGameState, createTestPlayer, createTestRunState, createTestEnemy } from '../test-utils.js';
import { entityId, type GameState } from '@dungeon/contracts';

describe('state validators', () => {
  describe('validateGameState', () => {
    it('accepts valid game state', () => {
      const state = createTestGameState();
      const result = validateGameState(state);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects state missing gameId', () => {
      const state = createTestGameState();
      const invalid = { ...state, gameId: '' as any };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'gameId')).toBe(true);
    });

    it('rejects state missing phase', () => {
      const state = createTestGameState();
      const invalid = { ...state, phase: '' as any };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'phase')).toBe(true);
    });

    it('rejects state with negative version', () => {
      const state = createTestGameState();
      const invalid = { ...state, version: -1 };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'version')).toBe(true);
    });

    it('rejects state with negative turn number', () => {
      const state = createTestGameState();
      const invalid = { ...state, turnNumber: -1 };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'turnNumber')).toBe(true);
    });

    it('rejects dungeon phase without run', () => {
      const state = createTestGameState({ phase: 'dungeon' });
      const invalid = { ...state, run: null };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('dungeon phase requires an active run'))).toBe(true);
    });

    it('rejects town phase with active run', () => {
      const state = createTestGameState({
        phase: 'town',
      });
      const run = createTestRunState();
      const invalid = { ...state, run, phase: 'town' as const };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('town phase should not have an active run'))).toBe(true);
    });

    it('includes player validation errors with path prefix', () => {
      const state = createTestGameState();
      const invalid = {
        ...state,
        player: { ...state.player, level: 0 },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.startsWith('player.'))).toBe(true);
    });

    it('includes run validation errors with path prefix', () => {
      const state = createTestGameState({ phase: 'dungeon' });
      const invalid = {
        ...state,
        run: {
          ...state.run!,
          turnCount: -1,
        },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.startsWith('run.'))).toBe(true);
    });
  });

  describe('validatePlayer', () => {
    it('accepts valid player', () => {
      const player = createTestPlayer();
      const errors = validatePlayer(player);
      expect(errors.length).toBe(0);
    });

    it('rejects player missing id', () => {
      const player = createTestPlayer();
      const invalid = { ...player, id: '' as any };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('rejects player with level < 1', () => {
      const player = createTestPlayer();
      const invalid = { ...player, level: 0 };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'level')).toBe(true);
    });

    it('rejects player with negative experience', () => {
      const player = createTestPlayer();
      const invalid = { ...player, experience: -1 };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'experience')).toBe(true);
    });

    it('rejects player with health > maxHealth', () => {
      const player = createTestPlayer();
      const invalid = {
        ...player,
        stats: { ...player.stats, health: 100, maxHealth: 50 },
      };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'stats.health' && e.message.includes('cannot exceed'))).toBe(true);
    });

    it('rejects player with negative health', () => {
      const player = createTestPlayer();
      const invalid = {
        ...player,
        stats: { ...player.stats, health: -1 },
      };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'stats.health')).toBe(true);
    });

    it('rejects player with non-positive maxHealth', () => {
      const player = createTestPlayer();
      const invalid = {
        ...player,
        stats: { ...player.stats, maxHealth: 0 },
      };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'stats.maxHealth')).toBe(true);
    });

    it('rejects player with negative attack', () => {
      const player = createTestPlayer();
      const invalid = {
        ...player,
        stats: { ...player.stats, attack: -1 },
      };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'stats.attack')).toBe(true);
    });

    it('rejects player with negative defense', () => {
      const player = createTestPlayer();
      const invalid = {
        ...player,
        stats: { ...player.stats, defense: -1 },
      };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'stats.defense')).toBe(true);
    });

    it('rejects player without position', () => {
      const player = createTestPlayer();
      const invalid = { ...player, position: null as any };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'position')).toBe(true);
    });

    it('rejects player with negative gold', () => {
      const player = createTestPlayer();
      const invalid = { ...player, gold: -1 };
      const errors = validatePlayer(invalid);
      expect(errors.some(e => e.path === 'gold')).toBe(true);
    });
  });

  describe('validateEnemy', () => {
    it('accepts valid enemy', () => {
      const enemy = createTestEnemy();
      const errors = validateEnemy(enemy);
      expect(errors.length).toBe(0);
    });

    it('rejects enemy missing id', () => {
      const enemy = createTestEnemy();
      const invalid = { ...enemy, id: '' as any };
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'id')).toBe(true);
    });

    it('rejects enemy missing templateId', () => {
      const enemy = createTestEnemy();
      const invalid = { ...enemy, templateId: '' };
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'templateId')).toBe(true);
    });

    it('rejects enemy with negative tier', () => {
      const enemy = createTestEnemy();
      const invalid = { ...enemy, tier: -1 } as any;
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'tier')).toBe(true);
    });

    it('rejects enemy with health > maxHealth', () => {
      const enemy = createTestEnemy();
      const invalid = {
        ...enemy,
        stats: { ...enemy.stats, health: 100, maxHealth: 50 },
      };
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'stats.health' && e.message.includes('cannot exceed'))).toBe(true);
    });

    it('rejects enemy with negative health', () => {
      const enemy = createTestEnemy();
      const invalid = {
        ...enemy,
        stats: { ...enemy.stats, health: -1 },
      };
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'stats.health')).toBe(true);
    });

    it('rejects enemy without position', () => {
      const enemy = createTestEnemy();
      const invalid = { ...enemy, position: null as any };
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'position')).toBe(true);
    });

    it('rejects enemy without archetype', () => {
      const enemy = createTestEnemy();
      const invalid = { ...enemy, archetype: '' as any };
      const errors = validateEnemy(invalid);
      expect(errors.some(e => e.path === 'archetype')).toBe(true);
    });
  });

  describe('validateRunState', () => {
    it('accepts valid run state', () => {
      const run = createTestRunState();
      const errors = validateRunState(run);
      expect(errors.length).toBe(0);
    });

    it('rejects run missing runId', () => {
      const run = createTestRunState();
      const invalid = { ...run, runId: '' as any };
      const errors = validateRunState(invalid);
      expect(errors.some(e => e.path === 'runId')).toBe(true);
    });

    it('rejects run with negative turnCount', () => {
      const run = createTestRunState();
      const invalid = { ...run, turnCount: -1 };
      const errors = validateRunState(invalid);
      expect(errors.some(e => e.path === 'turnCount')).toBe(true);
    });

    it('rejects run with invalid isActive', () => {
      const run = createTestRunState();
      const invalid = { ...run, isActive: 'yes' as any };
      const errors = validateRunState(invalid);
      expect(errors.some(e => e.path === 'isActive')).toBe(true);
    });

    it('rejects run missing enemies map', () => {
      const run = createTestRunState();
      const invalid = { ...run, enemies: null as any };
      const errors = validateRunState(invalid);
      expect(errors.some(e => e.path === 'enemies')).toBe(true);
    });

    it('validates enemies in run', () => {
      const enemy = createTestEnemy({ tier: -1 as any });
      const run = createTestRunState({
        enemies: new Map([['0,0', enemy]]),
      });
      const errors = validateRunState(run);
      expect(errors.some(e => e.path.includes('enemies.'))).toBe(true);
    });

    it('rejects run missing speedAccumulators', () => {
      const run = createTestRunState();
      const invalid = { ...run, speedAccumulators: null as any };
      const errors = validateRunState(invalid);
      expect(errors.some(e => e.path === 'speedAccumulators')).toBe(true);
    });
  });

  describe('validateWorldState', () => {
    it('accepts valid world state', () => {
      const state = createTestGameState();
      const errors = validateWorldState(state.world);
      expect(errors.length).toBe(0);
    });

    it('rejects world missing town', () => {
      const state = createTestGameState();
      const invalid = { ...state.world, town: null as any };
      const errors = validateWorldState(invalid);
      expect(errors.some(e => e.path === 'town')).toBe(true);
    });

    it('rejects world with negative totalRuns', () => {
      const state = createTestGameState();
      const invalid = { ...state.world, totalRuns: -1 };
      const errors = validateWorldState(invalid);
      expect(errors.some(e => e.path === 'totalRuns')).toBe(true);
    });

    it('rejects world with negative deepestFloor', () => {
      const state = createTestGameState();
      const invalid = { ...state.world, deepestFloor: -1 };
      const errors = validateWorldState(invalid);
      expect(errors.some(e => e.path === 'deepestFloor')).toBe(true);
    });

    it('rejects world with non-array factions', () => {
      const state = createTestGameState();
      const invalid = { ...state.world, factions: {} as any };
      const errors = validateWorldState(invalid);
      expect(errors.some(e => e.path === 'factions')).toBe(true);
    });
  });

  describe('isGameStateValid', () => {
    it('returns true for valid state', () => {
      const state = createTestGameState();
      expect(isGameStateValid(state)).toBe(true);
    });

    it('returns false for invalid state', () => {
      const state = createTestGameState();
      const invalid = { ...state, version: -1 };
      expect(isGameStateValid(invalid)).toBe(false);
    });

    it('detects multiple errors', () => {
      const state = createTestGameState();
      const invalid = {
        ...state,
        version: -1,
        turnNumber: -5,
      };
      const result = validateGameState(invalid);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('accepts zero experience', () => {
      const player = createTestPlayer({ experience: 0 });
      const errors = validatePlayer(player);
      expect(errors.some(e => e.path === 'experience')).toBe(false);
    });

    it('accepts zero gold', () => {
      const player = createTestPlayer({ gold: 0 });
      const errors = validatePlayer(player);
      expect(errors.some(e => e.path === 'gold')).toBe(false);
    });

    it('accepts equal health and maxHealth', () => {
      const player = createTestPlayer({
        stats: { ...createTestPlayer().stats, health: 50, maxHealth: 50 },
      });
      const errors = validatePlayer(player);
      expect(errors.some(e => e.path === 'stats.health')).toBe(false);
    });

    it('accepts zero turnCount', () => {
      const run = createTestRunState();
      const invalid = { ...run, turnCount: 0 };
      const errors = validateRunState(invalid);
      expect(errors.some(e => e.path === 'turnCount')).toBe(false);
    });

    it('accepts zero deepestFloor', () => {
      const state = createTestGameState();
      const invalid = { ...state.world, deepestFloor: 0 };
      const errors = validateWorldState(invalid);
      expect(errors.some(e => e.path === 'deepestFloor')).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('detects player health constraint violation', () => {
      const state = createTestGameState();
      const invalid = {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: 150, maxHealth: 100 },
        },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.includes('stats.health'))).toBe(true);
    });

    it('detects multiple invalid enemies in run', () => {
      const enemy1 = createTestEnemy({ id: entityId('e1'), tier: -1 as any });
      const enemy2 = createTestEnemy({ id: entityId('e2'), tier: -5 as any });
      const run = createTestRunState({
        enemies: new Map([
          ['0,0', enemy1],
          ['1,1', enemy2],
        ]),
      });

      const state = createTestGameState({ phase: 'dungeon' });
      const invalid = {
        ...state,
        run,
      };
      const result = validateGameState(invalid);
      expect(result.errors.map(error => error.path)).toEqual(expect.arrayContaining([
        'run.enemies.0,0.tier',
        'run.enemies.1,1.tier',
      ]));
    });
  });

  describe('faction validation', () => {
    it('rejects invalid faction status', () => {
      const state = createTestGameState();
      const invalid = {
        ...state,
        world: {
          ...state.world,
          factions: [
            ...state.world.factions.slice(1),
            { ...state.world.factions[0]!, status: 'invalid_status' as any },
          ],
        },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.includes('factions.status'))).toBe(true);
    });

    it('rejects faction with power out of range', () => {
      const state = createTestGameState();
      const invalid = {
        ...state,
        world: {
          ...state.world,
          factions: [
            ...state.world.factions.slice(1),
            { ...state.world.factions[0]!, power: 150 },
          ],
        },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.includes('factions.power'))).toBe(true);
    });
  });

  describe('dungeon ogre validation', () => {
    it('rejects invalid ogre status', () => {
      const state = createTestGameState();
      const invalid = {
        ...state,
        world: {
          ...state.world,
          dungeonOgre: {
            ...state.world.dungeonOgre,
            status: 'active' as any,
          },
        },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.includes('dungeonOgre.status'))).toBe(true);
    });

    it('rejects emerged ogre without selectedSpawnDepth', () => {
      const state = createTestGameState();
      const invalid: GameState = {
        ...state,
        world: {
          ...state.world,
          dungeonOgre: {
            ...state.world.dungeonOgre,
            status: 'emerged',
            selectedSpawnDepth: undefined as any,
          },
        },
      };
      const result = validateGameState(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path.includes('dungeonOgre.selectedSpawnDepth'))).toBe(true);
    });
  });
});
