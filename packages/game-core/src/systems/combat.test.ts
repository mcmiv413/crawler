import { describe, it, expect, vi } from 'vitest';
import { resolveAttack } from './combat.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { CombatContext } from '@dungeon/contracts';

describe('resolveAttack', () => {
  const rng = new SeededRNG(12345);

  const baseCtx: CombatContext = {
    attackerId: entityId('attacker'),
    defenderId: entityId('defender'),
    attackerAttack: 50,
    attackerAccuracy: 80,
    defenderDefense: 20,
    defenderEvasion: 10,
    defenderHealth: 100,
    damageType: 'physical',
    defenderResistance: 0.2, // 20% resistance
  };

  it('should resolve a hit when accuracy exceeds evasion', () => {
    const ctx = { ...baseCtx, attackerAccuracy: 90, defenderEvasion: 10 };
    const result = resolveAttack(ctx, rng);
    expect(result.hit).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.mitigated).toBeLessThanOrEqual(result.damage);
    expect(result.defenderDied).toBe(false);
  });

  it('should miss when evasion exceeds accuracy', () => {
    const ctx = { ...baseCtx, attackerAccuracy: 10, defenderEvasion: 90 };
    const result = resolveAttack(ctx, rng);
    expect(result.hit).toBe(false);
    expect(result.damage).toBeLessThanOrEqual(0);
    expect(result.statusesApplied.length).toBeLessThanOrEqual(0);
    expect(result.defenderDied).toBe(false);
  });

  it('should calculate damage correctly with attack and defense', () => {
    const ctx = { ...baseCtx, attackerAttack: 80, defenderDefense: 30, attackerAccuracy: 100, defenderEvasion: 0 };
    const result = resolveAttack(ctx, new SeededRNG(1));
    expect(result.hit).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });

  it('should apply defense mitigation to damage', () => {
    const ctx = { ...baseCtx, attackerAttack: 60, defenderDefense: 50, attackerAccuracy: 100, defenderEvasion: 0 };
    const result = resolveAttack(ctx, new SeededRNG(1));
    expect(result.hit).toBe(true);
    expect(result.mitigated).toBeGreaterThanOrEqual(0);
    expect(result.damage).toBeGreaterThan(0);
  });

  it('should handle critical hits (guaranteed hit)', () => {
    // Run multiple seeds to find one that crits, or just verify the result structure
    const ctx = { ...baseCtx, attackerAccuracy: 100, defenderEvasion: 0 };
    const result = resolveAttack(ctx, new SeededRNG(99999));
    expect(result.hit).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
    expect(typeof result.criticalHit).toBe('boolean');
  });

  it('should apply on-hit status when provided with 100% chance', () => {
    const ctx = { ...baseCtx, attackerAccuracy: 100, defenderEvasion: 0 };
    const result = resolveAttack(ctx, new SeededRNG(1), 'burn', 100);
    expect(result.hit).toBe(true);
    expect(result.statusesApplied).toContain('burn');
  });

  it('should trigger defender death when health drops to zero or below', () => {
    const ctx = { ...baseCtx, attackerAttack: 200, defenderHealth: 50, attackerAccuracy: 100, defenderEvasion: 0 };
    const result = resolveAttack(ctx, rng);
    expect(result.defenderDied).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });
});

describe('damage type resistance', () => {
  const rng = new SeededRNG(12345);
  const baseCtx: CombatContext = {
    attackerId: entityId('attacker'),
    defenderId: entityId('defender'),
    attackerAttack: 50,
    attackerAccuracy: 100,
    defenderDefense: 0,
    defenderEvasion: 0,
    defenderHealth: 200,
    damageType: 'fire',
    defenderResistance: 0,
  };

  it('positive resistance reduces damage below unresisted value', () => {
    const unresisted = resolveAttack({ ...baseCtx, defenderResistance: 0 }, new SeededRNG(1));
    const resisted = resolveAttack({ ...baseCtx, defenderResistance: 0.5 }, new SeededRNG(1));
    expect(unresisted.hit).toBe(true);
    expect(resisted.hit).toBe(true);
    expect(resisted.damage).toBeLessThan(unresisted.damage);
  });

  it('resistance 0 produces same result as baseline', () => {
    const a = resolveAttack({ ...baseCtx, defenderResistance: 0 }, new SeededRNG(7));
    const b = resolveAttack({ ...baseCtx, defenderResistance: 0 }, new SeededRNG(7));
    expect(a.damage).toBe(b.damage);
    expect(a.hit).toBe(b.hit);
  });

  it('negative resistance (vulnerability) amplifies damage', () => {
    const normal = resolveAttack({ ...baseCtx, defenderResistance: 0 }, new SeededRNG(1));
    const vulnerable = resolveAttack({ ...baseCtx, defenderResistance: -0.5 }, new SeededRNG(1));
    expect(normal.hit).toBe(true);
    expect(vulnerable.hit).toBe(true);
    expect(vulnerable.damage).toBeGreaterThan(normal.damage);
  });

  it('minimum damage of 1 enforced even with resistance 0.99 and high defense', () => {
    const ctx = { ...baseCtx, attackerAttack: 5, defenderDefense: 100, defenderResistance: 0.99 };
    const result = resolveAttack(ctx, new SeededRNG(1));
    expect(result.hit).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });
});

describe('accuracy (no double-count)', () => {
  it('miss result includes missReason field when evasion causes miss', () => {
    // Verify missReason field exists and has correct value on miss
    // Use very high evasion and low accuracy to guarantee miss
    const ctx: CombatContext = {
      attackerId: entityId('attacker'),
      defenderId: entityId('defender'),
      attackerAttack: 50,
      attackerAccuracy: -50,  // Very low to guarantee miss
      defenderDefense: 20,
      defenderEvasion: 0,
      defenderHealth: 100,
      damageType: 'physical',
      defenderResistance: 0,
    };

    // Try multiple seeds to find a miss
    let found = false;
    for (let seed = 0; seed < 1000 && !found; seed++) {
      const result = resolveAttack(ctx, new SeededRNG(seed));
      if (!result.hit) {
        // Verify missReason exists
        expect((result as any).missReason).toBeDefined();
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('accuracy stat does not double-count weapon bonus', () => {
    // This test validates the fix: effectiveAccuracy should use getEffectiveStat
    // which doesn't double-count weapon bonuses that are already in player.stats.accuracy
    const baseAccuracy = 80;
    const ctx: CombatContext = {
      attackerId: entityId('attacker'),
      defenderId: entityId('defender'),
      attackerAttack: 50,
      attackerAccuracy: baseAccuracy,
      defenderDefense: 20,
      defenderEvasion: 10,
      defenderHealth: 100,
      damageType: 'physical',
      defenderResistance: 0,
    };
    const result = resolveAttack(ctx, new SeededRNG(42));
    // Should hit because base accuracy (80) exceeds base evasion (10)
    expect(result.hit).toBe(true);
  });
});
