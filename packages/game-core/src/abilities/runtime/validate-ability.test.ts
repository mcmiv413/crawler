/**
 * Test layer: unit
 * Behavior: validateRequirements enforces has_tile_target only when a targetPosition is supplied.
 * Proof: Assertions check result.valid is true with targetPosition and false with reason "Requires a target tile" when targetPosition is undefined or omitted.
 * Validation: pnpm vitest run packages/game-core/src/abilities/runtime/validate-ability.test.ts
 */
import { describe, it, expect } from 'vitest';
import type { AbilityContext } from '../types.js';
import { validateRequirements } from './validate-ability.js';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';

describe('validate-ability: has_tile_target requirement', () => {
  it('should pass when targetPosition is provided', () => {
    const state = createTestGameStateInCombat();
    const context: AbilityContext = {
      state,
      rng: new SeededRNG(0),
      player: state.player,
      run: state.run,
      equippedWeaponId: state.player.equipment.weapon,
      targetPosition: { x: 5, y: 5 },
    };

    const result = validateRequirements(context, [{ kind: 'has_tile_target' }]);
    expect(result.valid).toBe(true);
  });

  it('should fail when targetPosition is undefined', () => {
    const state = createTestGameStateInCombat();
    const context: AbilityContext = {
      state,
      rng: new SeededRNG(0),
      player: state.player,
      run: state.run,
      equippedWeaponId: state.player.equipment.weapon,
      targetPosition: undefined,
    };

    const result = validateRequirements(context, [{ kind: 'has_tile_target' }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Requires a target tile');
  });

  it('should fail when targetPosition is omitted', () => {
    const state = createTestGameStateInCombat();
    const context: AbilityContext = {
      state,
      rng: new SeededRNG(0),
      player: state.player,
      run: state.run,
      equippedWeaponId: state.player.equipment.weapon,
    };

    const result = validateRequirements(context, [{ kind: 'has_tile_target' }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Requires a target tile');
  });
});
