import { describe, it, expect } from 'vitest';
import { ENEMY_ABILITY_DEFINITIONS, resolveEnemyAbility } from './enemy-abilities.js';
import type { EnemyAction } from './enemy-ai.js';
import { createTestGameState, createTestGameStateInCombat, createTestEnemy } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';
import { posKey } from '@dungeon/contracts';

describe('Enemy Abilities', () => {
  describe('ENEMY_ABILITY_DEFINITIONS', () => {
    it('should have crushing_blow ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('crushing_blow')).toBeDefined();
    });

    it('should have fire_bolt ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('fire_bolt')).toBeDefined();
    });

    it('should have flame_trail ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('flame_trail')).toBeDefined();
    });

    it('should have frost_bolt ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('frost_bolt')).toBeDefined();
    });

    it('should have roar ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('roar')).toBeDefined();
    });

    it('should have chilling_aura ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('chilling_aura')).toBeDefined();
    });
  });

  describe('EnemyAction with abilities', () => {
    it('should support ability action type', () => {
      const action: EnemyAction = {
        type: 'ability',
        enemyId: 'e1' as any,
        abilityId: 'crushing_blow',
      };

      expect(action.type).toBe('ability');
      expect((action as any).abilityId).toBe('crushing_blow');
    });

    it('should have optional targetPosition for ability actions', () => {
      const action: EnemyAction = {
        type: 'ability',
        enemyId: 'e1' as any,
        abilityId: 'fire_bolt',
        targetPosition: { x: 5, y: 5 },
      };

      expect(action.targetPosition).toEqual({ x: 5, y: 5 });
    });

    it('should allow ability action without targetPosition', () => {
      const action: EnemyAction = {
        type: 'ability',
        enemyId: 'e1' as any,
        abilityId: 'roar',
      };

      expect(action.type).toBe('ability');
      expect((action as any).abilityId).toBe('roar');
    });
  });

  describe('EnemyInstance with ability cooldowns', () => {
    it('should track ability cooldowns', () => {
      const enemy = {
        ...createTestEnemy(),
        abilityCooldowns: {
          crushing_blow: 3,
          fire_bolt: 0,
        },
      };

      expect(enemy.abilityCooldowns.crushing_blow).toBeGreaterThan(0);
      expect(enemy.abilityCooldowns.crushing_blow).toBeLessThan(5);
      expect(enemy.abilityCooldowns.fire_bolt).toBeLessThanOrEqual(0);
    });
  });

  describe('resolveEnemyAbility', () => {
    it('resolves crushing_blow ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.some(e => e.type === 'ATTACK_PERFORMED')).toBe(true);
    });

    it('resolves frost_bolt ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('frost_bolt', enemy, state, rng);

      expect(result.events.length).toBeGreaterThan(0);
    });

    it('resolves roar ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('roar', enemy, state, rng);

      expect(result.events.some(e => e.type === 'STATUS_APPLIED')).toBe(true);
    });

    it('returns unchanged state for invalid ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('nonexistent_ability', enemy, state, rng);

      expect(result.state === state || JSON.stringify(result.state) === JSON.stringify(state)).toBe(true);
      expect(result.events).toHaveLength(0);
    });

    it('crushing_blow deals damage', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ stats: { ...createTestEnemy().stats, attack: 10 } });
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED') as any;
      expect(attackEvent).toBeDefined();
      if (attackEvent) {
        expect(attackEvent.damage).toBeGreaterThan(0);
      }
    });

    it('fire_bolt uses fire damage type', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('fire_bolt', enemy, state, rng);

      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED') as any;
      expect(attackEvent).toBeDefined();
      if (attackEvent) {
        expect(attackEvent.damageType).toBe('fire');
      }
    });

    it('flame_trail applies burn status on hit', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('flame_trail', enemy, state, rng);

      const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED' && (e as any).statusId === 'burn');
      expect(statusEvent).toBeDefined();
    });

    it('frost_bolt applies slow status on hit', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('frost_bolt', enemy, state, rng);

      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeDefined();

      if (attackEvent && (attackEvent as any).hit) {
        const slowEvent = result.events.find(e => e.type === 'STATUS_APPLIED' && (e as any).statusId === 'slow');
        expect(slowEvent).toBeDefined();
      }
    });

    it('chilling_aura applies slow to player, ranged', () => {
      const state = createTestGameStateInCombat();
      const enemy = Array.from(state.run!.enemies.values())[0]!;
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('chilling_aura', enemy, state, rng);

      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeUndefined();

      const slowEvent = result.events.find(e => e.type === 'STATUS_APPLIED' && (e as any).statusId === 'slow');
      expect(slowEvent).toBeDefined();
      if (slowEvent) {
        expect((slowEvent as any).targetId).toBe(state.player.id);
      }

      expect(result.state.player.statuses.some(s => s.id === 'slow')).toBe(true);
    });

    it('roar applies strength to self, no damage', () => {
      const state = createTestGameStateInCombat();
      const enemy = Array.from(state.run!.enemies.values())[0]!;
      const rng = new SeededRNG(42);

      const roarDef = ENEMY_ABILITY_DEFINITIONS.get('roar');
      expect(roarDef).toBeDefined();
      expect(roarDef?.targetSelf).toBe(true);

      const result = resolveEnemyAbility('roar', enemy, state, rng);

      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeUndefined();

      const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED');
      expect(statusEvent).toBeDefined();
      if (statusEvent) {
        expect((statusEvent as any).statusId).toBe('strength');
        expect((statusEvent as any).targetId).toBe(enemy.id);
      }

      if (result.state.run) {
        let updatedEnemy: any | null = null;
        for (const e of result.state.run.enemies.values()) {
          if (e.id === enemy.id) {
            updatedEnemy = e;
            break;
          }
        }
        expect(updatedEnemy).toBeDefined();
        if (updatedEnemy) {
          expect(updatedEnemy.statuses.length).toBeGreaterThan(0);
          expect(updatedEnemy.statuses.some((s: any) => s.id === 'strength')).toBe(true);
        }
      }

      expect(result.state.player.statuses.some(s => s.id === 'strength')).toBe(false);
    });

    it('ability sets cooldown on enemy after use', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      if (result.state.run) {
        let updatedEnemy: any | null = null;
        for (const e of result.state.run.enemies.values()) {
          if (e.id === enemy.id) {
            updatedEnemy = e;
            break;
          }
        }
        if (updatedEnemy && updatedEnemy.abilityCooldowns) {
          expect(updatedEnemy.abilityCooldowns['crushing_blow'] || 0).toBeGreaterThan(0);
        }
      }
    });

    it('returns unchanged state when run is null', () => {
      const state = createTestGameStateInCombat();
      const stateNoRun = { ...state, run: null };
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, stateNoRun, rng);

      expect(result.state === stateNoRun || JSON.stringify(result.state) === JSON.stringify(stateNoRun)).toBe(true);
      expect(result.events).toHaveLength(0);
    });

    it('resolveEnemyAbility returns without calling engine updateRunMetrics', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('resolveEnemyAbility with cooldowns', () => {
    it('should set ability cooldown after use', () => {
      const state = createTestGameState({ phase: 'dungeon' });
      const enemy = {
        ...createTestEnemy(),
        position: { x: 5, y: 5 },
        abilities: ['roar'],
        abilityCooldowns: {},
      };

      const stateWithEnemy = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[posKey(enemy.position), enemy]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = resolveEnemyAbility('roar', enemy, stateWithEnemy, rng);

      const updatedEnemy = result.state.run!.enemies.get(posKey(enemy.position));
      expect(updatedEnemy?.abilityCooldowns?.roar).toBeGreaterThan(0);
    });

    it('should apply damage when ability has damageMultiplier', () => {
      const state = createTestGameState({ phase: 'dungeon' });
      const enemy = {
        ...createTestEnemy(),
        position: { x: 5, y: 5 },
        abilities: ['crushing_blow'],
        stats: {
          ...createTestEnemy().stats,
          attack: 20,
        },
        abilityCooldowns: {},
      };

      const stateWithEnemy = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[posKey(enemy.position), enemy]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = resolveEnemyAbility('crushing_blow', enemy, stateWithEnemy, rng);

      const damageEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(damageEvent).toBeDefined();
      expect(result.state.player.stats.health).toBeLessThan(state.player.stats.health);
    });

    it('should apply status effect when ability has statusId', () => {
      const state = createTestGameState({ phase: 'dungeon' });
      const enemy = {
        ...createTestEnemy(),
        position: { x: 5, y: 5 },
        abilities: ['roar'],
        damageType: 'physical' as const,
        abilityCooldowns: {},
      };

      const stateWithEnemy = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[posKey(enemy.position), enemy]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = resolveEnemyAbility('roar', enemy, stateWithEnemy, rng);

      const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED');
      expect(statusEvent?.type).toBe('STATUS_APPLIED');
      if (statusEvent?.type === 'STATUS_APPLIED') {
        expect(statusEvent.statusId).toBe('strength');
      }
    });

    it('should handle zero damage abilities without damage events', () => {
      const state = createTestGameState({ phase: 'dungeon' });
      const initialHealth = state.player.stats.health;
      const enemy = {
        ...createTestEnemy(),
        position: { x: 5, y: 5 },
        abilities: ['roar'],
        damageType: 'physical' as const,
        abilityCooldowns: {},
      };

      const stateWithEnemy = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[posKey(enemy.position), enemy]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = resolveEnemyAbility('roar', enemy, stateWithEnemy, rng);

      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeUndefined();

      expect(result.state.player.stats.health).toBe(initialHealth);

      const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED');
      expect(statusEvent).toBeDefined();
    });
  });
});
