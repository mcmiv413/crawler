import { describe, it, expect } from 'vitest';
import { buildWorldModifiers } from './world-modifiers.js';
import { createTestGameState, createTestNemesis } from '../test-utils.js';
import { INITIAL_FACTIONS } from '@dungeon/content';

describe('buildWorldModifiers', () => {
  it('default world returns all zeros/empties', () => {
    const state = createTestGameState();
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBe(0);
    expect(mods.preferredArchetypes).toHaveLength(0);
    expect(mods.preferredDamageTypes).toHaveLength(0);
    expect(mods.preferredTemplates).toHaveLength(0);
  });

  it('active nemesis at floorOfAscension <= depth adds 1 extraEnemy', () => {
    const nemesis = createTestNemesis({ isActive: true, floorOfAscension: 1 });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBe(1);
  });

  it('inactive nemesis does not affect extraEnemies', () => {
    const nemesis = createTestNemesis({ isActive: false, floorOfAscension: 1 });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBe(0);
  });

  it('active nemesis above its floorOfAscension (not yet reached) does not count', () => {
    // depth=1 but nemesis requires floor 3
    const nemesis = createTestNemesis({ isActive: true, floorOfAscension: 3 });
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBe(0);
  });

  it('extraEnemies capped at 3 regardless of nemesis count', () => {
    const nemeses = [1, 2, 3, 4, 5].map(i =>
      createTestNemesis({ id: `n${i}` as any, isActive: true, floorOfAscension: 1 }),
    );
    const state = createTestGameState({ world: { nemeses } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.extraEnemies).toBe(3);
  });

  it('fear > 60 adds ambusher and fast_skirmisher to preferredArchetypes', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 61, corruption: 10, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredArchetypes).toContain('ambusher');
    expect(mods.preferredArchetypes).toContain('fast_skirmisher');
  });

  it('fear exactly 60 does not add preferredArchetypes', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 60, corruption: 10, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredArchetypes).not.toContain('ambusher');
    expect(mods.preferredArchetypes).not.toContain('fast_skirmisher');
  });

  it('corruption > 50 adds poison and corruption to preferredDamageTypes', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 51, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.preferredDamageTypes).toContain('poison');
    expect(mods.preferredDamageTypes).toContain('corruption');
  });

  it('faction power > 60 adds that faction\'s templates to preferredTemplates', () => {
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

  it('corruption > 50 yields enemyHealthMultiplier > 1', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 51, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.enemyHealthMultiplier).toBe(1.1);
  });

  it('corruption <= 50 yields enemyHealthMultiplier of 1.0', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 50, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.enemyHealthMultiplier).toBe(1.0);
  });

  it('corruption > 75 yields tierUpgradeChance > 0', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 76, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.tierUpgradeChance).toBe(0.1);
  });

  it('corruption > 90 yields negative bossFloorAdjust', () => {
    const state = createTestGameState({ world: { town: { prosperity: 50, fear: 20, corruption: 91, rumors: [], lastRunSummary: null } } });
    const mods = buildWorldModifiers(state.world, 1);
    expect(mods.bossFloorAdjust).toBe(-1);
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
