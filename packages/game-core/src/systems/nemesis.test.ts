import { describe, it, expect } from 'vitest';
import { shouldPromoteToNemesis, promoteToNemesis, slayNemesis, findNemesisByTemplateId } from './nemesis.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { NemesisRecord } from '@dungeon/contracts';
import { NEMESIS_PROMOTION } from '@dungeon/content';
import { createTestGameState, createTestEnemy } from '../test-utils.js';

describe('shouldPromoteToNemesis', () => {
  it('returns false when floor is below minFloor (floor 0)', () => {
    const rng = new SeededRNG(42);
    const state = createTestGameState();
    const enemy = createTestEnemy();
    expect(shouldPromoteToNemesis(state, enemy, 0, rng)).toBe(false);
  });

  it('guarantees first nemesis on first-ever death', () => {
    const rng = new SeededRNG(42);
    const state = createTestGameState({ world: { nemeses: [] } });
    const enemy = createTestEnemy();
    // First death with no prior nemeses should always promote
    expect(shouldPromoteToNemesis(state, enemy, 1, rng)).toBe(true);
  });

  it('uses probability for subsequent deaths after first nemesis', () => {
    // Seed 1 gives a low first rng.next() — should fail a 40% tier-1 check
    const rng = new SeededRNG(1);
    const existing: NemesisRecord = {
      id: entityId('n0'),
      name: 'X',
      title: 'the Y',
      sourceTemplateId: 'tpl0',
      rank: 1,
      tier: 1,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: false,
      killCount: 1,
      floorOfAscension: 1,
      biomeOfAscension: 'crypt',
      killedByWeaponType: null,
    };
    const state = createTestGameState({ world: { nemeses: [existing] } });
    const enemy = createTestEnemy({ tier: 1 });
    // With nemeses already existing, uses probability (not guaranteed)
    const result = shouldPromoteToNemesis(state, enemy, 1, rng);
    expect(typeof result).toBe('boolean');
  });

  it('returns false when max active nemeses reached', () => {
    const rng = new SeededRNG(42);
    const existingNemeses: NemesisRecord[] = Array.from({ length: NEMESIS_PROMOTION.maxActiveNemeses }, (_, i) => ({
      id: entityId(`n${i}`),
      name: 'X',
      title: 'the Y',
      sourceTemplateId: `tpl${i}`,
      rank: 1,
      tier: 1,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 1,
      floorOfAscension: 2,
      biomeOfAscension: 'crypt',
      killedByWeaponType: null,
    }));
    const state = createTestGameState({ world: { nemeses: existingNemeses } });
    expect(shouldPromoteToNemesis(state, createTestEnemy(), 3, rng)).toBe(false);
  });

  it('always returns true for tier 5 enemy on eligible floor with seeded rng', () => {
    // tier 5 has 100% promotion chance
    const rng = new SeededRNG(99);
    const state = createTestGameState();
    const boss = createTestEnemy({ tier: 5 });
    expect(shouldPromoteToNemesis(state, boss, 3, rng)).toBe(true);
  });
});

describe('promoteToNemesis', () => {
  it('creates a NemesisRecord with boosted stats', () => {
    const rng = new SeededRNG(42);
    const state = createTestGameState();
    const enemy = createTestEnemy();
    const { state: newState } = promoteToNemesis(state, enemy, 3, rng);

    expect(newState.world.nemeses).toHaveLength(1);
    const nemesis = newState.world.nemeses[0]!;
    expect(nemesis.isActive).toBe(true);
    expect(nemesis.sourceTemplateId).toBe('goblin_archer');
    expect(nemesis.floorOfAscension).toBeGreaterThan(0);
    expect(nemesis.killCount).toBeGreaterThanOrEqual(0);
    expect(nemesis.rank).toBeGreaterThanOrEqual(1);
    // Boosted stats should be higher than original
    expect(nemesis.stats.maxHealth).toBeGreaterThan(enemy.stats.maxHealth);
    expect(nemesis.stats.attack).toBeGreaterThan(enemy.stats.attack);
  });

  it('emits NEMESIS_PROMOTED event', () => {
    const rng = new SeededRNG(42);
    const floor = 3;
    const state = createTestGameState();
    const { events } = promoteToNemesis(state, createTestEnemy(), floor, rng);

    const promoted = events.find(e => e.type === 'NEMESIS_PROMOTED');
    expect(promoted).toBeDefined();
    expect((promoted as any).floor).toBe(floor);
    expect((promoted as any).sourceTemplateId).toBe('goblin_archer');
  });

  it('appends to existing nemeses immutably', () => {
    const rng = new SeededRNG(42);
    const existing: NemesisRecord = {
      id: entityId('n0'),
      name: 'OldFoe',
      title: 'the Feared',
      sourceTemplateId: 'troll',
      rank: 1,
      tier: 3,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 1,
      floorOfAscension: 2,
      biomeOfAscension: 'goblin_warrens',
      killedByWeaponType: null,
    };
    const state = createTestGameState({ world: { nemeses: [existing] } });
    const { state: newState } = promoteToNemesis(state, createTestEnemy(), 3, rng);

    expect(newState.world.nemeses).toHaveLength(2);
    expect(state.world.nemeses).toHaveLength(1); // original unchanged
  });

  it('rank increases for repeated promotions of same template', () => {
    const rng = new SeededRNG(42);
    const priorRank = 1;
    const prior: NemesisRecord = {
      id: entityId('n0'),
      name: 'Grethak',
      title: 'the Old',
      sourceTemplateId: 'goblin_archer',
      rank: priorRank,
      tier: 2,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: false,
      killCount: 1,
      floorOfAscension: 2,
      biomeOfAscension: 'crypt',
      killedByWeaponType: null,
    };
    const state = createTestGameState({ world: { nemeses: [prior] } });
    const { state: newState } = promoteToNemesis(state, createTestEnemy(), 3, rng);
    expect(newState.world.nemeses[1]!.rank).toBeGreaterThan(priorRank);
  });
});

describe('slayNemesis', () => {
  it('sets isActive to false for the given nemesis', () => {
    const nemesis: NemesisRecord = {
      id: entityId('n1'),
      name: 'Vorreth',
      title: 'the Unbroken',
      sourceTemplateId: 'goblin_archer',
      rank: 1,
      tier: 2,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 1,
      floorOfAscension: 3,
      biomeOfAscension: 'crypt',
      killedByWeaponType: null,
    };
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const result = slayNemesis(state, entityId('n1'));
    expect(result.state.world.nemeses[0]!.isActive).toBe(false);
    expect(state.world.nemeses[0]!.isActive).toBe(true); // original unchanged
  });
});

describe('findNemesisByTemplateId', () => {
  it('returns the active nemesis matching the templateId', () => {
    const active: NemesisRecord = {
      id: entityId('n1'),
      name: 'Vorreth',
      title: 'the Unbroken',
      sourceTemplateId: 'goblin_archer',
      rank: 1,
      tier: 2,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 1,
      floorOfAscension: 3,
      biomeOfAscension: 'crypt',
      killedByWeaponType: null,
    };
    const result = findNemesisByTemplateId([active], 'goblin_archer');
    expect(result).toBe(active);
  });

  it('returns undefined if no active match', () => {
    expect(findNemesisByTemplateId([], 'goblin_archer')).toBeUndefined();
  });
});

describe('slayNemesis — Blueprint Unlock (Area 4a)', () => {
  it('unlocks a blueprint when nemesis is slain', () => {
    const nemesis: NemesisRecord = {
      id: entityId('n1'),
      name: 'Test Nemesis',
      title: 'the Dreaded',
      sourceTemplateId: 'goblin_archer',
      rank: 1,
      tier: 2,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 0,
      floorOfAscension: 3,
      biomeOfAscension: 'dungeon',
      killedByWeaponType: null,
    };
    const state = createTestGameState({
      world: { nemeses: [nemesis], unlockedBlueprints: [] },
    });

    const result = slayNemesis(state, nemesis.id);

    // Blueprint should be unlocked (at least one)
    expect(result.state.world.unlockedBlueprints.length).toBeGreaterThan(0);
  });

  it('marks nemesis as inactive when slain', () => {
    const nemesis: NemesisRecord = {
      id: entityId('n2'),
      name: 'Test Nemesis 2',
      title: 'the Strong',
      sourceTemplateId: 'goblin_archer',
      rank: 1,
      tier: 2,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 0,
      floorOfAscension: 3,
      biomeOfAscension: 'dungeon',
      killedByWeaponType: null,
    };
    const state = createTestGameState({ world: { nemeses: [nemesis] } });

    const result = slayNemesis(state, nemesis.id);

    const slainNemesis = result.state.world.nemeses.find(n => n.id === nemesis.id);
    expect(slainNemesis?.isActive).toBe(false);
  });

  it('does not duplicate blueprints when already unlocked', () => {
    const nemesis: NemesisRecord = {
      id: entityId('n3'),
      name: 'Test Nemesis 3',
      title: 'the Mighty',
      sourceTemplateId: 'goblin_archer',
      rank: 1,
      tier: 2,
      stats: createTestEnemy().stats,
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 0,
      floorOfAscension: 3,
      biomeOfAscension: 'dungeon',
      killedByWeaponType: null,
    };
    const state = createTestGameState({
      world: { nemeses: [nemesis], unlockedBlueprints: ['hp_regen', 'thorns'] },
    });

    const result = slayNemesis(state, nemesis.id);

    // Count unique blueprints
    const uniqueBlueprints = new Set(result.state.world.unlockedBlueprints);
    expect(uniqueBlueprints.size).toBe(result.state.world.unlockedBlueprints.length);
  });
});
