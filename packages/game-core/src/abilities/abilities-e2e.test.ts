import { describe, it, expect } from 'vitest';
import { ALL_ABILITY_DEFINITIONS } from './index.js';
import { handleUseAbility } from '../engine/handlers/combat.js';
import { createTestGameStateInCombat } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';

/**
 * E2E test for all abilities: Ensures no ability silently fails or becomes a no-op.
 * This catches cases like Bug 1 where self-targeted abilities fail when enemies are in range.
 */
describe('All Abilities E2E', () => {
  for (const ability of ALL_ABILITY_DEFINITIONS) {
    it(`${ability.id} emits event when executed`, () => {
      // Create combat state and grant ability
      let state = createTestGameStateInCombat();
      if (state.run === null || !state.run.enemies.size) {
        throw new Error('test setup failed: no combat');
      }

      // Add ability to player
      state = {
        ...state,
        player: {
          ...state.player,
          abilities: [...state.player.abilities, ability.id as any],
        },
      };

      const rng = new SeededRNG(12345);
      if (!state.run) throw new Error('run cleared');
      const firstEnemy = [...state.run.enemies.values()][0];
      if (!firstEnemy) throw new Error('no enemies in combat');

      // Try using ability - this is the core test: no silent failures
      const result = handleUseAbility(state, ability.id, rng, firstEnemy.id);

      // CRITICAL: Events must be non-empty (catches silent no-ops like Bug 1)
      if (result.events.length === 0) {
        console.error(`[${ability.id}] No events emitted. State:`, {
          playerAbilities: state.player.abilities,
          enemyId: firstEnemy.id,
        });
      }
      expect(result.events.length).toBeGreaterThan(
        0,
        `Ability ${ability.id} silently failed (no events emitted)`
      );

      // Verify at least ABILITY_USED is present
      const hasEvent = result.events.some((e) => e.type === 'ABILITY_USED');
      expect(hasEvent).toBe(true);
    });
  }
});
