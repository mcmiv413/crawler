import { describe, expect, it } from 'vitest';
import { ENEMY_TEMPLATES, INITIAL_FACTIONS } from '@dungeon/content';
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

const context = {
  timestamp: 123,
  turnNumber: 10,
  depth: 3,
};

describe('faction progression', () => {
  it('member kills reduce power and increment faction kill tracking', () => {
    const state = createTestGameState();
    const before = state.world.factions.find(f => f.id === 'goblin_warband')!;

    const result = applyFactionMemberKill(state.world, 'goblin_warband', context);
    const after = result.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(after.power).toBe(before.power - 1);
    expect(after.membersKilledByPlayer).toBe(before.membersKilledByPlayer + 1);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'FACTION_POWER_CHANGED',
      factionId: 'goblin_warband',
      reason: 'member_killed',
    }));
  });

  it('player death against a leaderless faction creates a leader and boosts power', () => {
    const state = createTestGameState();

    const result = applyFactionDeathConsequences(state.world, 'goblin_warband', context);
    const faction = result.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(faction.status).toBe('led');
    expect(faction.leader).not.toBeNull();
    expect(faction.activeLeaderId).toBe(faction.leader?.id);
    expect(faction.playerDeathsCaused).toBe(1);
    expect(faction.power).toBe(state.world.factions.find(f => f.id === 'goblin_warband')!.power + 20);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'FACTION_LEADER_EMERGED',
      factionId: 'goblin_warband',
    }));
  });

  it('player death against a led faction adds pressure without replacing the leader', () => {
    const state = createTestGameState();
    const firstResult = applyFactionDeathConsequences(state.world, 'goblin_warband', context);
    const ledFaction = firstResult.world.factions.find(f => f.id === 'goblin_warband')!;

    const secondResult = applyFactionDeathConsequences(firstResult.world, 'goblin_warband', {
      ...context,
      turnNumber: context.turnNumber + 1,
    });
    const updatedFaction = secondResult.world.factions.find(f => f.id === 'goblin_warband')!;

    expect(updatedFaction.activeLeaderId).toBe(ledFaction.activeLeaderId);
    expect(updatedFaction.playerDeathsCaused).toBe(2);
    expect(updatedFaction.power).toBe(ledFaction.power + 8);
    expect(secondResult.events).not.toContainEqual(expect.objectContaining({ type: 'FACTION_LEADER_EMERGED' }));
  });

  it('broken factions ignore later player deaths', () => {
    const state = createTestGameState({
      world: {
        factions: INITIAL_FACTIONS.map(faction => faction.id === 'goblin_warband'
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
        factions: INITIAL_FACTIONS.map(faction =>
          faction.id === 'goblin_warband'
            ? {
                ...faction,
                status: 'led',
                activeLeaderId: 'goblin_warlord' as never,
                leaderSlain: false,
                leader: {
                  id: 'goblin_warlord' as never,
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
      { ...INITIAL_FACTIONS[0]!, power: 10 },
      { ...INITIAL_FACTIONS[1]!, power: 85, status: 'led' as const },
      { ...INITIAL_FACTIONS[2]!, status: 'broken' as const, leaderSlain: true },
    ];

    expect(getFactionPowerBand(factions[0]!)).toBe('weak');
    expect(getFactionPowerBand(factions[1]!)).toBe('dominant');
    expect(getFactionPowerBand(factions[2]!)).toBe('broken');
    expect(calculateFactionTownImpact(factions)).toEqual({ prosperityDelta: 0, corruptionDelta: 0 });
  });

  it('applies new deepest floor pressure to each unbroken faction', () => {
    const state = createTestGameState();

    const result = applyNewDeepestFloorPressure(state.world, 2, 3, context);

    expect(result.events).toHaveLength(state.world.factions.length);
    for (const faction of result.world.factions) {
      const before = state.world.factions.find(candidate => candidate.id === faction.id)!;
      expect(faction.power).toBe(before.power + 1);
    }
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'FACTION_POWER_CHANGED', reason: 'new_deepest_floor' }),
    ]));
  });

  it('revisiting an old floor is a no-op for faction pressure', () => {
    const state = createTestGameState();

    const result = applyNewDeepestFloorPressure(state.world, 4, 4, context);

    expect(result.world).toEqual(state.world);
    expect(result.events).toEqual([]);
  });

  it('skips broken factions when applying new deepest floor pressure', () => {
    const state = createTestGameState({
      world: {
        factions: INITIAL_FACTIONS.map(faction => faction.id === 'goblin_warband'
          ? { ...faction, status: 'broken' as const, leaderSlain: true }
          : faction),
      },
    });

    const result = applyNewDeepestFloorPressure(state.world, 2, 3, context);
    const brokenFaction = result.world.factions.find(faction => faction.id === 'goblin_warband')!;
    const stableFaction = result.world.factions.find(faction => faction.id === 'undead_legion')!;

    expect(brokenFaction.power).toBe(state.world.factions.find(faction => faction.id === 'goblin_warband')!.power);
    expect(stableFaction.power).toBe(state.world.factions.find(faction => faction.id === 'undead_legion')!.power + 1);
    expect(result.events.some(event => event.type === 'FACTION_POWER_CHANGED' && event.factionId === 'goblin_warband')).toBe(false);
  });

  it('scales faction member strength by band without affecting leaders', () => {
    const goblinTemplate = ENEMY_TEMPLATES.get('goblin_archer')!;
    const stableFaction = { ...INITIAL_FACTIONS.find(faction => faction.id === 'goblin_warband')!, power: 40 };
    const dominantFaction = { ...stableFaction, power: 85 };
    const brokenFaction = { ...stableFaction, status: 'broken' as const, leaderSlain: true, power: 5 };

    const stableEnemy = createEnemyInstance(goblinTemplate, { x: 1, y: 1 }, 2, { factions: [stableFaction] });
    const dominantEnemy = createEnemyInstance(goblinTemplate, { x: 1, y: 1 }, 2, { factions: [dominantFaction] });
    const brokenEnemy = createEnemyInstance(goblinTemplate, { x: 1, y: 1 }, 2, { factions: [brokenFaction] });

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
        factions: INITIAL_FACTIONS.map(faction => ({ ...faction, status: 'broken' as const, leaderSlain: true })),
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
