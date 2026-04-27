import { describe, it, expect } from 'vitest';
import { handleAttack } from './combat.js';
import { createTestGameState } from '../testing/test-builders.js';
import { SeededRNG } from '../../utils/rng.js';

describe('handleAttack integration', () => {
  it('should pass weapon damage profile to combat resolver', () => {
    const state = createTestGameState();
    const rng = new SeededRNG(42);

    // Create game state with a player attack stat and enemy
    if (!state.run || state.run.enemies.size === 0) {
      throw new Error('Test state must have active run with enemies');
    }

    // Get first enemy
    const [, enemy] = state.run.enemies.entries().next().value;

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
    // If range is too narrow (5-8), weapon profile wasn't passed
    expect(maxDamage - minDamage).toBeGreaterThanOrEqual(5);
  });
});
