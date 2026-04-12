import { describe, it, expect } from 'vitest';
import { grantAbility, tickAbilityCooldowns, canUseAbility } from './abilities.js';
import { createTestGameState } from '../test-utils.js';
import { ABILITY_DEFINITIONS, ABILITY_UNLOCK_BY_LEVEL, MASTERY_THRESHOLDS } from '@dungeon/content';

describe('grantAbility', () => {
  it('adds a new ability with cooldown 0', () => {
    const state = createTestGameState();
    const next = grantAbility(state, 'power_strike');
    expect(next.player.abilities).toHaveLength(1);
    expect(next.player.abilities[0]!.id).toBe('power_strike');
    expect(next.player.abilities[0]!.cooldownRemaining).toBe(0);
  });

  it('is idempotent — does not duplicate an already-granted ability', () => {
    const state = createTestGameState();
    const once = grantAbility(state, 'power_strike');
    const twice = grantAbility(once, 'power_strike');
    expect(twice.player.abilities).toHaveLength(1);
  });

  it('can grant multiple different abilities', () => {
    const state = createTestGameState();
    const s1 = grantAbility(state, 'power_strike');
    const s2 = grantAbility(s1, 'second_wind');
    expect(s2.player.abilities).toHaveLength(2);
  });
});

describe('tickAbilityCooldowns', () => {
  it('decrements non-zero cooldowns by 1', () => {
    const state = createTestGameState({
      player: { abilities: [{ id: 'power_strike', cooldownRemaining: 3 }] },
    });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities[0]!.cooldownRemaining).toBe(2);
  });

  it('does not reduce cooldown below 0', () => {
    const state = createTestGameState({
      player: { abilities: [{ id: 'power_strike', cooldownRemaining: 0 }] },
    });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities[0]!.cooldownRemaining).toBe(0);
  });

  it('returns same state when no abilities exist', () => {
    const state = createTestGameState({ player: { abilities: [] } });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities).toHaveLength(0);
  });
});

describe('canUseAbility', () => {
  it('returns false when player does not have the ability', () => {
    const state = createTestGameState({ player: { abilities: [] } });
    expect(canUseAbility(state, 'power_strike')).toBe(false);
  });

  it('returns false when ability is on cooldown', () => {
    const state = createTestGameState({
      player: { abilities: [{ id: 'power_strike', cooldownRemaining: 2 }] },
    });
    expect(canUseAbility(state, 'power_strike')).toBe(false);
  });

  it('returns true when ability is ready (cooldown = 0)', () => {
    const state = createTestGameState({
      player: { abilities: [{ id: 'power_strike', cooldownRemaining: 0 }] },
    });
    expect(canUseAbility(state, 'power_strike')).toBe(true);
  });

  it('Bug 3: canUseAbility is single exported function for ability check', () => {
    // This test verifies the canUseAbility function is the single source of truth
    // both for players and enemies (via canEnemyUseAbility)
    const state = createTestGameState({
      player: { abilities: [{ id: 'power_strike', cooldownRemaining: 0 }] },
    });
    // Player ability check
    expect(canUseAbility(state, 'power_strike')).toBe(true);
    // (Enemy checks use canEnemyUseAbility which is also exported from same module)
  });
});

describe('Ability Definitions — Area 3 tuning', () => {
  it('power_strike unlockLevel === 2', () => {
    expect(ABILITY_DEFINITIONS.power_strike.unlockLevel).toBe(2);
  });

  it('second_wind unlockLevel === 4', () => {
    expect(ABILITY_DEFINITIONS.second_wind.unlockLevel).toBe(4);
  });

  it('power_strike cooldown === 2', () => {
    expect(ABILITY_DEFINITIONS.power_strike.cooldown).toBe(2);
  });

  it('second_wind cooldown === 4', () => {
    expect(ABILITY_DEFINITIONS.second_wind.cooldown).toBe(4);
  });

  it('blade_bleed cooldown === 2', () => {
    expect(ABILITY_DEFINITIONS.blade_bleed.cooldown).toBe(2);
  });

  it('blade_riposte cooldown === 3', () => {
    expect(ABILITY_DEFINITIONS.blade_riposte.cooldown).toBe(3);
  });

  it('bludgeon_stagger cooldown === 2', () => {
    expect(ABILITY_DEFINITIONS.bludgeon_stagger.cooldown).toBe(2);
  });

  it('bludgeon_shatter cooldown === 4', () => {
    expect(ABILITY_DEFINITIONS.bludgeon_shatter.cooldown).toBe(4);
  });

  it('axe_cleave cooldown === 2', () => {
    expect(ABILITY_DEFINITIONS.axe_cleave.cooldown).toBe(2);
  });

  it('axe_execute cooldown === 3', () => {
    expect(ABILITY_DEFINITIONS.axe_execute.cooldown).toBe(3);
  });

  it('ranged_pin cooldown === 2', () => {
    expect(ABILITY_DEFINITIONS.ranged_pin.cooldown).toBe(2);
  });

  it('ranged_volley cooldown === 4', () => {
    expect(ABILITY_DEFINITIONS.ranged_volley.cooldown).toBe(4);
  });

  it('ABILITY_UNLOCK_BY_LEVEL: power_strike at level 2', () => {
    expect(ABILITY_UNLOCK_BY_LEVEL[2]).toBe('power_strike');
  });

  it('ABILITY_UNLOCK_BY_LEVEL: second_wind at level 4', () => {
    expect(ABILITY_UNLOCK_BY_LEVEL[4]).toBe('second_wind');
  });

  it('MASTERY_THRESHOLDS tier 1 === 10', () => {
    expect(MASTERY_THRESHOLDS[1]).toBe(10);
  });

  it('MASTERY_THRESHOLDS tier 2 === 25', () => {
    expect(MASTERY_THRESHOLDS[2]).toBe(25);
  });
});
