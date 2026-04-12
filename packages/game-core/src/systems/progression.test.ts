import { describe, it, expect } from 'vitest';
import { checkLevelUp } from './progression.js';
import { BASE_PLAYER_STATS, XP_TABLE, LEVEL_UP_GAINS } from '@dungeon/content';
import { BASE_TEST_STATS, createTestGameState } from '../test-utils.js';


describe('checkLevelUp', () => {
  it('does nothing when XP is insufficient', () => {
    const state = createTestGameState({ player: { experience: 50 } });
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBe(0);
    expect(result.events).toHaveLength(0);
    expect(result.state.player.level).toBe(1);
  });

  it('levels up once when XP meets threshold', () => {
    const state = createTestGameState({ player: { experience: 100 } }); // XP_TABLE[2] = 100
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.state.player.level).toBe(2);
    expect(result.events[0]!.type).toBe('LEVEL_UP');
  });

  it('levels up multiple times when XP is very high', () => {
    const state = createTestGameState({ player: { experience: 500 } }); // XP_TABLE[4] = 500
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBe(3); // levels 2, 3, 4
    expect(result.events).toHaveLength(3);
    expect(result.state.player.level).toBe(4);
  });

  it('applies stat gains correctly', () => {
    const state = createTestGameState({ player: { experience: 100 } });
    const result = checkLevelUp(state);
    const p = result.state.player;
    expect(p.stats.maxHealth).toBe(BASE_PLAYER_STATS.maxHealth + LEVEL_UP_GAINS.maxHealth);
    expect(p.stats.attack).toBe(BASE_PLAYER_STATS.attack + LEVEL_UP_GAINS.attack);
    expect(p.stats.defense).toBe(BASE_PLAYER_STATS.defense + LEVEL_UP_GAINS.defense);
    expect(p.baseStats.maxHealth).toBe(BASE_PLAYER_STATS.maxHealth + LEVEL_UP_GAINS.maxHealth);
  });

  it('heals HP equal to maxHealth gain on level up', () => {
    const state = createTestGameState({ player: { experience: 100, stats: { ...BASE_TEST_STATS, health: 50 } } });
    const result = checkLevelUp(state);
    expect(result.state.player.stats.health).toBe(50 + LEVEL_UP_GAINS.maxHealth);
  });

  it('does not exceed max level', () => {
    const state = createTestGameState({ player: { level: 10, experience: 99999 } });
    const result = checkLevelUp(state);
    expect(result.levelsGained).toBe(0);
    expect(result.state.player.level).toBe(10);
  });
});

describe('checkLevelUp ability grants', () => {
  it('grants power_strike when reaching level 3', () => {
    // XP_TABLE[3] = 250
    const state = createTestGameState({ player: { experience: 250 } });
    const result = checkLevelUp(state);
    expect(result.state.player.level).toBe(3);
    const ids = result.state.player.abilities.map(a => a.id);
    expect(ids).toContain('power_strike');
  });

  it('grants second_wind when reaching level 5', () => {
    // XP_TABLE[5] = 850
    const state = createTestGameState({ player: { experience: 850 } });
    const result = checkLevelUp(state);
    expect(result.state.player.level).toBe(5);
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
