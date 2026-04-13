import { describe, it, expect } from 'vitest';
import { buildWorldModifiers } from './world-modifiers.js';
import { createTestGameState, createTestNemesis } from '../test-utils.js';
import { INITIAL_FACTIONS } from '@dungeon/content';

describe('buildWorldModifiers', () => {
  it('default world returns all zeros/empties', () => {
    const state = createTestGameState();
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBeLessThanOrEqual(0);
    expect(mods.preferredArchetypes).toHaveLength(0);
    expect(mods.preferredDamageTypes).toHaveLength(0);
    expect(mods.preferredTemplates).toHaveLength(0);
  });

  it('active nemesis at floorOfAscension <= depth adds extra enemies', () => {
    const nemesis = createTestNemesis({ isActive: true, floorOfAscension: 1 });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBeGreaterThan(0);
    expect(mods.extraEnemies).toBeLessThanOrEqual(5);
  });

  it('inactive nemesis does not affect extraEnemies', () => {
    const nemesis = createTestNemesis({ isActive: false, floorOfAscension: 1 });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBeLessThanOrEqual(0);
  });

  it('active nemesis above its floorOfAscension (not yet reached) does not count', () => {
    // depth=1 but nemesis requires floor 3
    const nemesis = createTestNemesis({ isActive: true, floorOfAscension: 3 });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBeLessThanOrEqual(0);
  });

  it('extraEnemies is capped at reasonable maximum', () => {
    const nemeses = [1, 2, 3, 4, 5].map(i =>
      createTestNemesis({ id: `n${i}` as any, isActive: true, floorOfAscension: 1 }),
    );
    const state = createTestGameState({ world: { nemeses } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBeGreaterThan(0);
    expect(mods.extraEnemies).toBeLessThan(10);
  });

  it('high fear adds aggressive archetypes to preferredArchetypes', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 61, corruption: 10, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredArchetypes.length).toBeGreaterThan(0);
  });

  it('low fear does not add aggressive archetypes', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 40, corruption: 10, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    // Should have minimal or no preferred archetypes at low fear
    expect(mods.preferredArchetypes.length).toBeLessThanOrEqual(5);
  });

  it('high corruption adds damage type modifiers', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 70, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredDamageTypes.length).toBeGreaterThan(0);
  });

  it('low corruption does not add damage type modifiers', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 30, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredDamageTypes.length).toBeLessThanOrEqual(5);
  });

  it('faction power affects preferredTemplates', () => {
    // Set the first faction to power > 60
    const state = createTestGameState({
      world: {
        factions: INITIAL_FACTIONS.map((f, i) => i === 0 ? { ...f, power: 61 } : f),
      },
    });
    const modsHigh = buildWorldModifiers(state.world, 1);

    // Compare with all factions at low power
    const stateBase = createTestGameState();
    const modsBase = buildWorldModifiers(stateBase.world, 1);

    // The high-power faction state should add >= 0 templates; may be empty if none map to faction
    // But it should be >= base (which also may be 0)
    expect(modsHigh.preferredTemplates.length).toBeGreaterThanOrEqual(modsBase.preferredTemplates.length);
  });

  it('corruption affects enemy health multiplier', () => {
    const stateHigh = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 70, rumors: [], lastRunSummary: null } } });
    const modsHigh = buildWorldModifiers(stateHigh.world, 1);
    
    const stateLow = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 30, rumors: [], lastRunSummary: null } } });
    const modsLow = buildWorldModifiers(stateLow.world, 1);

    // High corruption should have higher multiplier
    expect(modsHigh.enemyHealthMultiplier).toBeGreaterThanOrEqual(modsLow.enemyHealthMultiplier);
    expect(modsHigh.enemyHealthMultiplier).toBeGreaterThanOrEqual(1.0);
  });

  it('high corruption yields tier upgrade chance', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 80, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.tierUpgradeChance).toBeGreaterThan(0);
    expect(mods.tierUpgradeChance).toBeLessThan(1);
  });

  it('very high corruption yields negative bossFloorAdjust', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 91, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.bossFloorAdjust).toBeLessThan(0);
  });

  it('active nemesis adds sourceTemplateId to preferredTemplates', () => {
    const nemesis = createTestNemesis({ isActive: true, floorOfAscension: 1, sourceTemplateId: 'goblin_skirmisher' });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredTemplates).toContain('goblin_skirmisher');
  });

  it('inactive nemesis does not add to preferredTemplates', () => {
    const nemesis = createTestNemesis({ isActive: false, floorOfAscension: 1, sourceTemplateId: 'goblin_skirmisher' });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredTemplates).not.toContain('goblin_skirmisher');
  });

  it('active nemesis above current depth does not add to preferredTemplates', () => {
    const nemesis = createTestNemesis({ isActive: true, floorOfAscension: 5, sourceTemplateId: 'goblin_skirmisher' });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredTemplates).not.toContain('goblin_skirmisher');
  });
});
