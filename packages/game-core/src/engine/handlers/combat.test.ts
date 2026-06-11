import { describe, it, expect } from 'vitest';
import { handleAttack } from './combat.js';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import { entityId } from '@dungeon/contracts';

describe('handleAttack integration', () => {
  it('rejects attacks against a missing target', () => {
    const state = createTestGameStateInCombat();

    const result = handleAttack(state, entityId('missing_target'), new SeededRNG(1000));

    expect(result.state).toBe(state);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'TARGET_NOT_FOUND',
    }));
  });

  it('should pass weapon damage profile to combat resolver', () => {
    const state = createTestGameStateInCombat();

    // Game state should have enemies to attack
    if (!state.run || state.run.enemies.size === 0) {
      throw new Error('Test state must have active run with enemies');
    }

    // Get first enemy
    const entryResult = state.run.enemies.entries().next();
    if (entryResult.done || !entryResult.value) {
      throw new Error('No enemies found');
    }
    const [, enemy] = entryResult.value;

    // Run attack multiple times and collect damage results
    const damages: number[] = [];
    for (let i = 0; i < 20; i++) {
      const result = handleAttack({ ...state }, enemy.id, new SeededRNG(i + 1000));

      if (result.events.length > 0) {
        const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
        if (attackEvent && 'damage' in attackEvent) {
          damages.push(attackEvent.damage);
        }
      }
    }

    // With weapon profile passing:
    // - Player has attack stat (likely 11-15)
    // - Equipped weapon has damage (likely 5-9 range)
    // - Total should be around 16-24 range
    // Without weapon profile (old broken code):
    // - Would roll with 0.15 variance on attack stat only
    // - Much narrower range

    const minDamage = Math.min(...damages.filter(d => d > 0));
    const maxDamage = Math.max(...damages);

    // Verify we get a reasonable range (indicates weapon profile is being used)
    // With weapon profile: damage should vary (attack + weapon range variation)
    // Without weapon profile: would be much narrower (just attack variance)
    // Note: defense mitigation affects final damage, but we should still see variation
    expect(damages.length).toBeGreaterThan(0);
    expect(maxDamage - minDamage).toBeGreaterThanOrEqual(3);
  });
});
