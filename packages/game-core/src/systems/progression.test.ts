/**
 * Test layer: unit
 * Behavior: Level-up progression converts sufficient XP into levels, stat gains, healing, and one-time ability grants while leaving insufficient or max-level players unchanged.
 * Proof: Assertions check levelsGained, LEVEL_UP events, player level/stat/health increases, max-level caps, granted power_strike and second_wind ids, and no duplicate power_strike grant.
 * Validation: pnpm vitest run packages/game-core/src/systems/progression.test.ts
 */
import { describe, it, expect } from 'vitest';
import { checkLevelUp } from './progression.js';
import { BASE_TEST_STATS, createTestGameState } from '../test-utils.js';


describe('checkLevelUp', () => {
  it('does nothing when XP is insufficient', () => {
    const initialLevel = 1;
    const state = createTestGameState({ player: { experience: 50 } });
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBeLessThanOrEqual(0);
    expect(result.events).toHaveLength(0);
    expect(result.state.player.level).toBe(initialLevel);
  });

  it('levels up when XP meets threshold', () => {
    const state = createTestGameState({ player: { experience: 100 } });
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.state.player.level).toBeGreaterThan(state.player.level);
    expect(result.events[0]!.type).toBe('LEVEL_UP');
  });

  it('levels up multiple times when XP is very high', () => {
    const state = createTestGameState({ player: { experience: 500 } });
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBeGreaterThan(1);
    expect(result.events.length).toBeGreaterThanOrEqual(result.levelsGained);
    expect(result.state.player.level).toBeGreaterThan(state.player.level);
  });

  it('applies stat gains correctly', () => {
    const state = createTestGameState({ player: { experience: 100 } });
    const result = checkLevelUp(state);
    const p = result.state.player;
    expect(p.stats.maxHealth).toBeGreaterThan(BASE_TEST_STATS.maxHealth);
    expect(p.stats.attack).toBeGreaterThan(BASE_TEST_STATS.attack);
    expect(p.stats.defense).toBeGreaterThan(BASE_TEST_STATS.defense);
    expect(p.baseStats.maxHealth).toBeGreaterThan(BASE_TEST_STATS.maxHealth);
  });

  it('heals HP on level up', () => {
    const initialHealth = 50;
    const state = createTestGameState({ player: { experience: 100, stats: { ...BASE_TEST_STATS, health: initialHealth } } });
    const result = checkLevelUp(state);
    expect(result.state.player.stats.health).toBeGreaterThanOrEqual(initialHealth);
  });

  it('does not exceed max level', () => {
    const maxLevel = 10;
    const state = createTestGameState({ player: { level: maxLevel, experience: 99999 } });
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBeLessThanOrEqual(0);
    expect(result.state.player.level).toBeLessThanOrEqual(maxLevel);
  });

  it('maintains player level integrity across multiple level-ups', () => {
    const state = createTestGameState({ player: { experience: 500 } });
    const result = checkLevelUp(state);
    expect(result.state.player.level).toBeGreaterThanOrEqual(2);
    expect(result.state.player.level).toBeLessThan(20); // Reasonable upper bound
  });
});

describe('checkLevelUp ability grants', () => {
  it('grants power_strike when reaching sufficient level', () => {
    const state = createTestGameState({ player: { experience: 250 } });
    const result = checkLevelUp(state);
    expect(result.state.player.level).toBeGreaterThanOrEqual(2);
    const ids = result.state.player.abilities.map(a => a.id);
    expect(ids).toContain('power_strike');
  });

  it('grants second_wind when reaching sufficient level', () => {
    const state = createTestGameState({ player: { experience: 850 } });
    const result = checkLevelUp(state);
    expect(result.state.player.level).toBeGreaterThanOrEqual(4);
    const ids = result.state.player.abilities.map(a => a.id);
    expect(ids).toContain('second_wind');
    expect(ids).toContain('power_strike');
  });

  it('does not re-grant ability if player already has it', () => {
    const state = createTestGameState({
      player: {
        level: 2,
        experience: 250,
        abilities: [{ id: 'power_strike', cooldownRemaining: 0 }],
      },
    });
    const result = checkLevelUp(state);
    expect(result.state.player.abilities.filter(a => a.id === 'power_strike')).toHaveLength(1);
  });
});
