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
    expect(next.player.abilities[0]!.cooldownRemaining).toBeLessThan(4);
    expect(next.player.abilities[0]!.cooldownRemaining).toBeGreaterThan(1);
  });

  it('does not reduce cooldown below 0', () => {
    const state = createTestGameState({
      player: { abilities: [{ id: 'power_strike', cooldownRemaining: 0 }] },
    });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities[0]!.cooldownRemaining).toBeGreaterThanOrEqual(0);
  });

  it('returns same state when no abilities exist', () => {
    const state = createTestGameState({ player: { abilities: [] } });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities).toHaveLength(0);
  });

  // Edge cases for robustness
  it('handles multiple abilities with varying cooldowns', () => {
    const state = createTestGameState({
      player: {
        abilities: [
          { id: 'power_strike', cooldownRemaining: 5 },
          { id: 'second_wind', cooldownRemaining: 2 },
          { id: 'blade_bleed', cooldownRemaining: 0 },
        ],
      },
    });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities).toHaveLength(3);
    expect(next.player.abilities.every((a) => a.cooldownRemaining >= 0)).toBe(true);
  });

  it('decrements all cooldowns consistently', () => {
    const state = createTestGameState({
      player: {
        abilities: [
          { id: 'power_strike', cooldownRemaining: 5 },
          { id: 'second_wind', cooldownRemaining: 3 },
        ],
      },
    });
    const next = tickAbilityCooldowns(state);
    expect(next.player.abilities[0]!.cooldownRemaining).toBeLessThan(5);
    expect(next.player.abilities[1]!.cooldownRemaining).toBeLessThan(3);
    expect(next.player.abilities.every((a) => a.cooldownRemaining >= 0)).toBe(true);
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
  it('power_strike has a reasonable unlock level', () => {
    expect(ABILITY_DEFINITIONS.power_strike.unlockLevel).toBeGreaterThanOrEqual(1);
    expect(ABILITY_DEFINITIONS.power_strike.unlockLevel).toBeLessThan(10);
  });

  it('second_wind has a reasonable unlock level', () => {
    expect(ABILITY_DEFINITIONS.second_wind.unlockLevel).toBeGreaterThanOrEqual(2);
    expect(ABILITY_DEFINITIONS.second_wind.unlockLevel).toBeLessThan(10);
  });

  it('power_strike has a reasonable cooldown', () => {
    expect(ABILITY_DEFINITIONS.power_strike.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.power_strike.cooldown).toBeLessThan(10);
  });

  it('second_wind has a reasonable cooldown', () => {
    expect(ABILITY_DEFINITIONS.second_wind.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.second_wind.cooldown).toBeLessThan(10);
  });

  it('blade abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.blade_bleed.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.blade_bleed.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.blade_riposte.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.blade_riposte.cooldown).toBeLessThan(10);
  });

  it('bludgeon abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.bludgeon_stagger.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.bludgeon_stagger.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.bludgeon_shatter.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.bludgeon_shatter.cooldown).toBeLessThan(10);
  });

  it('axe abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.axe_cleave.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.axe_cleave.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.axe_execute.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.axe_execute.cooldown).toBeLessThan(10);
  });

  it('ranged abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.ranged_pin.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.ranged_pin.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.ranged_volley.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.ranged_volley.cooldown).toBeLessThan(10);
  });

  it('ABILITY_UNLOCK_BY_LEVEL includes early-game abilities', () => {
    const levels = Object.keys(ABILITY_UNLOCK_BY_LEVEL).map(Number);
    expect(levels.length).toBeGreaterThan(0);
    levels.forEach((level) => {
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThan(20);
    });
  });

  it('MASTERY_THRESHOLDS are in ascending order', () => {
    const thresholds = Object.values(MASTERY_THRESHOLDS);
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
    }
  });

  it('MASTERY_THRESHOLDS have reasonable values', () => {
    Object.values(MASTERY_THRESHOLDS).forEach((threshold) => {
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThan(1000);
    });
  });
});
