/**
 * Test layer: unit
 * Behavior: Factions covers faction progression; member kills reduce power and increment faction kill tracking; player death against a leaderless faction creates a l....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/factions.test.ts
 */
import { describe, expect, it } from 'vitest';
import type { EnemyTemplate, EntityId, FactionState } from '@dungeon/contracts';
import {
  applyFactionDeathConsequences,
  applyFactionLeaderSlain,
  applyNewDeepestFloorPressure,
  applyFactionMemberKill,
  calculateFactionTownImpact,
  getFactionMemberStrengthMultiplier,
  getFactionPowerBand,
  maybeEmergeDungeonOgre,
} from './factions.js';
import { createTestGameState } from '../test-utils.js';
import { createEnemyInstance } from '../generation/enemy-instantiation.js';

// ---------------------------------------------------------------------------
// Local fixtures — no @dungeon/content import
// ---------------------------------------------------------------------------

/** Minimal power constants matching FACTION_CONFIG.power in balance/tables.ts */
const POWER = {
  memberKillPowerLoss: 1,
  playerDeathPowerGain: 20,
  playerDeathWithLeaderPowerGain: 8,
  newDeepestFloorPowerGain: 1,
} as const;

/** Three stub factions that cover every status path exercised in this file */
const STUB_FACTIONS: readonly FactionState[] = [
  {
    id: 'goblin_warband',
    name: 'Goblin Warband',
    power: 40,
    disposition: -30,
    status: 'leaderless',
    leader: null,
    leaderSlain: false,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
  {
    id: 'undead_legion',
    name: 'Undead Legion',
    power: 50,
    disposition: -20,
    status: 'leaderless',
    leader: null,
    leaderSlain: false,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
  {
    id: 'shadow_cult',
    name: 'Shadow Cult',
    power: 45,
    disposition: -25,
    status: 'leaderless',
    leader: null,
    leaderSlain: false,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
];

/** Minimal goblin_archer template — only the fields createEnemyInstance needs */
const STUB_GOBLIN_ARCHER_TEMPLATE: EnemyTemplate = {
  templateId: 'goblin_archer',
  name: 'Goblin Archer',
  archetype: 'ranged',
  tier: 2,
  stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 },
  equipment: {
    weapon: { damageMultiplier: 1.0, damageType: 'physical', weaponRange: 1 },
  },
  affinities: {},
  spawn: { floorRange: [1, 3], weight: 1 },
  lootTableId: 'goblin',
  experienceValue: 20,
  description: 'A sneaky goblin scout.',
  ascii: 'g',
  biomes: [],
  factions: [{ factionId: 'goblin_warband', weight: 1 }],
};

// ---------------------------------------------------------------------------

const context = {
  timestamp: 123,
  turnNumber: 10,
  depth: 3,
};

describe('faction progression', () => {
  it('member kills reduce power and increment faction kill tracking', () => {
    const state = createTestGameState({ world: { factions: [...STUB_FACTIONS] } });
    const before = state.world.factions.find(f => f.id === 'goblin_warband')!;

    const result = applyFactionMemberKill(state.world, 'goblin_warband', context);
    const after = result.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(after.power).toBe(before.power - POWER.memberKillPowerLoss);
    expect(after.membersKilledByPlayer).toBe(before.membersKilledByPlayer + 1);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'FACTION_POWER_CHANGED',
      factionId: 'goblin_warband',
      reason: 'member_killed',
    }));
  });

  it('player death against a leaderless faction creates a leader and boosts power', () => {
    const state = createTestGameState({ world: { factions: [...STUB_FACTIONS] } });
    const before = state.world.factions.find(f => f.id === 'goblin_warband')!;

    const result = applyFactionDeathConsequences(state.world, 'goblin_warband', context);
    const faction = result.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(faction.status).toBe('led');
    expect(faction.leader).not.toBeNull();
    expect(faction.activeLeaderId).toBe(faction.leader?.id);
    expect(faction.playerDeathsCaused).toBe(before.playerDeathsCaused + 1);
    expect(faction.power).toBe(before.power + POWER.playerDeathPowerGain);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'FACTION_LEADER_EMERGED',
      factionId: 'goblin_warband',
    }));
  });

  it('player death against a led faction adds pressure without replacing the leader', () => {
    const state = createTestGameState({ world: { factions: [...STUB_FACTIONS] } });
    const firstResult = applyFactionDeathConsequences(state.world, 'goblin_warband', context);
    const ledFaction = firstResult.world.factions.find(f => f.id === 'goblin_warband')!;

    const secondResult = applyFactionDeathConsequences(firstResult.world, 'goblin_warband', {
      ...context,
      turnNumber: context.turnNumber + 1,
    });
    const updatedFaction = secondResult.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(updatedFaction.activeLeaderId).toBe(ledFaction.activeLeaderId);
    expect(updatedFaction.playerDeathsCaused).toBe(ledFaction.playerDeathsCaused + 1);
    expect(updatedFaction.power).toBe(ledFaction.power + POWER.playerDeathWithLeaderPowerGain);
    expect(secondResult.events).not.toContainEqual(expect.objectContaining({ type: 'FACTION_LEADER_EMERGED' }));
  });

  it('broken factions ignore later player deaths', () => {
    const state = createTestGameState({
      world: {
        factions: STUB_FACTIONS.map(faction => faction.id === 'goblin_warband'
          ? { ...faction, status: 'broken' as const, leaderSlain: true }
          : faction),
      },
    });

    const result = applyFactionDeathConsequences(state.world, 'goblin_warband', context);

    expect(result.world).toEqual(state.world);
    expect(result.events).toEqual([]);
  });

  it('slaying a faction leader breaks the faction and can emerge the dungeon ogre', () => {
    const state = createTestGameState({
      world: {
        factions: STUB_FACTIONS.map(faction =>
          faction.id === 'goblin_warband'
            ? {
                ...faction,
                status: 'led',
                activeLeaderId: 'goblin_warlord' as EntityId,
                leaderSlain: false,
                leader: {
                  id: 'goblin_warlord' as EntityId,
                  factionId: faction.id,
                  name: 'Grak',
                  title: 'Warlord',
                  templateId: 'goblin_warlord',
                  isActive: true,
                  isSlain: false,
                  emergedOnRun: 1,
                  emergedOnDepth: 2,
                },
              }
            : { ...faction, status: 'broken', leaderSlain: true },
        ),
      },
    });

    const result = applyFactionLeaderSlain(state.world, 'goblin_warband', context, 42);
    const faction = result.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(faction.status).toBe('broken');
    expect(faction.leaderSlain).toBe(true);
    expect(faction.leader?.isSlain).toBe(true);
    expect(result.world.dungeonOgre.status).toBe('emerged');
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'FACTION_LEADER_SLAIN', factionId: 'goblin_warband' }),
      expect.objectContaining({ type: 'FACTION_BROKEN', factionId: 'goblin_warband' }),
      expect.objectContaining({ type: 'DUNGEON_OGRE_EMERGED', ogreId: 'dungeon_ogre' }),
    ]));
  });

  it('derives power bands and town impact from faction state', () => {
    const factions = [
      { ...STUB_FACTIONS[0]!, power: 10 },
      { ...STUB_FACTIONS[1]!, power: 85, status: 'led' as const },
      { ...STUB_FACTIONS[2]!, status: 'broken' as const, leaderSlain: true },
    ];

    expect(getFactionPowerBand(factions[0]!)).toBe('weak');
    expect(getFactionPowerBand(factions[1]!)).toBe('dominant');
    expect(getFactionPowerBand(factions[2]!)).toBe('broken');
    expect(calculateFactionTownImpact(factions)).toEqual({ prosperityDelta: 0, corruptionDelta: 0 });
  });

  it('applies new deepest floor pressure to each unbroken faction', () => {
    const state = createTestGameState({ world: { factions: [...STUB_FACTIONS] } });

    const result = applyNewDeepestFloorPressure(state.world, 2, 3, context);

    expect(result.events).toHaveLength(state.world.factions.length);
    for (const faction of result.world.factions) {
      const before = state.world.factions.find(candidate => candidate.id === faction.id)!;
      expect(faction.power).toBe(before.power + POWER.newDeepestFloorPowerGain);
    }
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'FACTION_POWER_CHANGED', reason: 'new_deepest_floor' }),
    ]));
  });

  it('revisiting an old floor is a no-op for faction pressure', () => {
    const state = createTestGameState({ world: { factions: [...STUB_FACTIONS] } });

    const result = applyNewDeepestFloorPressure(state.world, 4, 4, context);

    expect(result.world).toEqual(state.world);
    expect(result.events).toEqual([]);
  });

  it('skips broken factions when applying new deepest floor pressure', () => {
    const state = createTestGameState({
      world: {
        factions: STUB_FACTIONS.map(faction => faction.id === 'goblin_warband'
          ? { ...faction, status: 'broken' as const, leaderSlain: true }
          : faction),
      },
    });

    const result = applyNewDeepestFloorPressure(state.world, 2, 3, context);
    const brokenFaction = result.world.factions.find(faction => faction.id === 'goblin_warband')!;
    const stableFaction = result.world.factions.find(faction => faction.id === 'undead_legion')!;

    expect(brokenFaction.power).toBe(state.world.factions.find(faction => faction.id === 'goblin_warband')!.power);
    expect(stableFaction.power).toBe(state.world.factions.find(faction => faction.id === 'undead_legion')!.power + POWER.newDeepestFloorPowerGain);
    expect(result.events.some(event => event.type === 'FACTION_POWER_CHANGED' && event.factionId === 'goblin_warband')).toBe(false);
  });

  it('scales faction member strength by band without affecting leaders', () => {
    const stableFaction = { ...STUB_FACTIONS[0]!, power: 40 };
    const dominantFaction = { ...stableFaction, power: 85 };
    const brokenFaction = { ...stableFaction, status: 'broken' as const, leaderSlain: true, power: 5 };

    const stableEnemy = createEnemyInstance(STUB_GOBLIN_ARCHER_TEMPLATE, { x: 1, y: 1 }, 2, { factions: [stableFaction] });
    const dominantEnemy = createEnemyInstance(STUB_GOBLIN_ARCHER_TEMPLATE, { x: 1, y: 1 }, 2, { factions: [dominantFaction] });
    const brokenEnemy = createEnemyInstance(STUB_GOBLIN_ARCHER_TEMPLATE, { x: 1, y: 1 }, 2, { factions: [brokenFaction] });

    expect(getFactionMemberStrengthMultiplier(dominantFaction)).toBeGreaterThan(getFactionMemberStrengthMultiplier(stableFaction));
    expect(getFactionMemberStrengthMultiplier(brokenFaction)).toBeLessThan(getFactionMemberStrengthMultiplier(stableFaction));
    expect(dominantEnemy.stats.maxHealth).toBeGreaterThan(stableEnemy.stats.maxHealth);
    expect(dominantEnemy.stats.attack).toBeGreaterThan(stableEnemy.stats.attack);
    expect(brokenEnemy.stats.maxHealth).toBeLessThan(stableEnemy.stats.maxHealth);
    expect(brokenEnemy.stats.attack).toBeLessThan(stableEnemy.stats.attack);
  });

  it('chooses the same ogre spawn depth for the same sealed world and does not reroll after emergence', () => {
    const state = createTestGameState({
      world: {
        deepestFloor: 4,
        totalRuns: 3,
        factions: STUB_FACTIONS.map(faction => ({ ...faction, status: 'broken' as const, leaderSlain: true })),
      },
    });

    const firstResult = maybeEmergeDungeonOgre(state.world, context, 42);
    const secondResult = maybeEmergeDungeonOgre(state.world, context, 42);
    const noReroll = maybeEmergeDungeonOgre(firstResult.world, { ...context, depth: 7 }, 99);

    expect(firstResult.world.dungeonOgre.selectedSpawnDepth).toBe(secondResult.world.dungeonOgre.selectedSpawnDepth);
    expect(firstResult.events).toHaveLength(1);
    expect(noReroll.world).toEqual(firstResult.world);
    expect(noReroll.events).toEqual([]);
  });
});
