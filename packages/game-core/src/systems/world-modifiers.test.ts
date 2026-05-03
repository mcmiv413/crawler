import { describe, expect, it } from 'vitest';
import { buildWorldModifiers } from './world-modifiers.js';
import { createTestGameState } from '../test-utils.js';

describe('buildWorldModifiers', () => {
  it('default world returns empty preferences and stable faction multipliers', () => {
    const state = createTestGameState();
    const mods = buildWorldModifiers(state.world, 1);

    expect(mods.extraEnemies).toBeGreaterThanOrEqual(0);
    expect(mods.extraEnemies).toBeLessThan(1);
    expect(mods.preferredArchetypes).toHaveLength(0);
    expect(mods.preferredDamageTypes).toHaveLength(0);
    expect(mods.reservedEncounterSlots).toBeGreaterThanOrEqual(0);
    expect(mods.reservedEncounterSlots).toBeLessThan(1);
    expect(mods.factions).toEqual(state.world.factions);
    for (const faction of state.world.factions) {
      expect(mods.factionWeightMultipliers[faction.id]).toBeDefined();
    }
  });

  it('high fear adds aggressive archetype preferences', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 61, corruption: 10, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredArchetypes).toEqual(expect.arrayContaining(['ambusher', 'fast_skirmisher']));
  });

  it('high corruption adds corrupt damage preferences and stronger enemies', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 80, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);

    expect(mods.preferredDamageTypes).toEqual(expect.arrayContaining(['poison', 'corruption']));
    expect(mods.enemyHealthMultiplier).toBeGreaterThan(1);
    expect(mods.tierUpgradeChance).toBeGreaterThan(0);
  });

  it('faction status maps to spawn weight multipliers', () => {
    const baseFactions = createTestGameState().world.factions;
    const state = createTestGameState({
      world: {
        factions: baseFactions.map((faction, index) => {
          if (index === 0) return { ...faction, status: 'broken' as const, leaderSlain: true, power: 0 };
          if (index === 1) return { ...faction, status: 'led' as const, power: 85 };
          return faction;
        }),
      },
    });

    const mods = buildWorldModifiers(state.world, 1);

    expect(mods.factionWeightMultipliers[state.world.factions[0]!.id]).toBeLessThan(1);
    expect(mods.factionWeightMultipliers[state.world.factions[1]!.id]).toBeGreaterThan(1);
  });

  it('passes reserved encounter slots through untouched', () => {
    const state = createTestGameState();
    const reservedEncounterSlots = 2;
    const mods = buildWorldModifiers(state.world, 3, reservedEncounterSlots);
    expect(mods.reservedEncounterSlots).toBe(reservedEncounterSlots);
  });
});
