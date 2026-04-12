import { describe, it, expect } from 'vitest';
import type { EnemyAction } from './enemy-ai.js';
import { createTestGameState, createTestEnemy } from '../test-utils.js';
import { resolveEnemyAbility } from './enemy-abilities.js';
import { SeededRNG } from '../utils/rng.js';
import { posKey } from '@dungeon/contracts';

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
    const state = createTestGameState({ phase: 'dungeon' });
    const enemy = {
      ...createTestEnemy(),
      abilityCooldowns: {
        crushing_blow: 3,
        fire_bolt: 0,
      },
    };

    expect(enemy.abilityCooldowns.crushing_blow).toBe(3);
    expect(enemy.abilityCooldowns.fire_bolt).toBe(0);
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

    // Add enemy to state
    const stateWithEnemy = {
      ...state,
      run: {
        ...state.run!,
        enemies: new Map([[posKey(enemy.position), enemy]]),
      },
    };

    const rng = new SeededRNG(42);
    const result = resolveEnemyAbility('roar', enemy, stateWithEnemy, rng);

    // Find the updated enemy in the result
    const updatedEnemy = result.state.run!.enemies.get(posKey(enemy.position));
    expect(updatedEnemy?.abilityCooldowns?.roar).toBe(5); // roar has cooldown of 5
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
      expect(statusEvent.statusId).toBe('strength'); // roar applies strength
    }
  });

  it('should handle zero damage abilities (like roar) without damage events', () => {
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

    // roar has damageMultiplier of 0, so no attack should be performed
    const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
    expect(attackEvent).toBeUndefined();

    // Player health should not change
    expect(result.state.player.stats.health).toBe(initialHealth);

    // But status should be applied
    const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED');
    expect(statusEvent).toBeDefined();
  });
});
