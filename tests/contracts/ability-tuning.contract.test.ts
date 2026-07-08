/**
 * Test layer: contract
 * Behavior: Ability Tuning covers Ability Definitions — Area 3 tuning; power_strike has a reasonable unlock level; second_wind has a reasonable unlock level.
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/ability-tuning.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ABILITY_DEFINITIONS, ABILITY_UNLOCK_BY_LEVEL, MASTERY_THRESHOLDS } from '@dungeon/content';

describe('Ability Definitions — Area 3 tuning', () => {
  it('power_strike has a reasonable unlock level', () => {
    expect(ABILITY_DEFINITIONS.get('power_strike')!.unlockLevel).toBeGreaterThanOrEqual(1);
    expect(ABILITY_DEFINITIONS.get('power_strike')!.unlockLevel).toBeLessThan(10);
  });

  it('second_wind has a reasonable unlock level', () => {
    expect(ABILITY_DEFINITIONS.get('second_wind')!.unlockLevel).toBeGreaterThanOrEqual(2);
    expect(ABILITY_DEFINITIONS.get('second_wind')!.unlockLevel).toBeLessThan(10);
  });

  it('power_strike has a reasonable cooldown', () => {
    expect(ABILITY_DEFINITIONS.get('power_strike')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('power_strike')!.cooldown).toBeLessThan(10);
  });

  it('second_wind has a reasonable cooldown', () => {
    expect(ABILITY_DEFINITIONS.get('second_wind')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('second_wind')!.cooldown).toBeLessThan(10);
  });

  it('blade abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.get('blade_bleed')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('blade_bleed')!.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.get('blade_riposte')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('blade_riposte')!.cooldown).toBeLessThan(10);
  });

  it('bludgeon abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.get('bludgeon_stagger')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('bludgeon_stagger')!.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.get('bludgeon_shatter')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('bludgeon_shatter')!.cooldown).toBeLessThan(10);
  });

  it('axe abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.get('axe_cleave')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('axe_cleave')!.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.get('axe_execute')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('axe_execute')!.cooldown).toBeLessThan(10);
  });

  it('ranged abilities have reasonable cooldowns', () => {
    expect(ABILITY_DEFINITIONS.get('ranged_pin')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('ranged_pin')!.cooldown).toBeLessThan(10);
    expect(ABILITY_DEFINITIONS.get('ranged_volley')!.cooldown).toBeGreaterThan(0);
    expect(ABILITY_DEFINITIONS.get('ranged_volley')!.cooldown).toBeLessThan(10);
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
      expect(thresholds[i]!).toBeGreaterThan(thresholds[i - 1]!);
    }
  });

  it('MASTERY_THRESHOLDS have reasonable values', () => {
    Object.values(MASTERY_THRESHOLDS).forEach((threshold) => {
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThan(1000);
    });
  });
});
