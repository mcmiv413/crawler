import { FACTION_RUMORS, INITIAL_FACTIONS } from '@dungeon/content';
import { createTestGameState } from '@dungeon/core/testing';
import type { GameState } from '@dungeon/contracts';
import { buildDeterministicRunSummary, buildDeterministicTownRumors } from './town-text.js';

function buildFactionTownState(): GameState {
  return {
    ...createTestGameState({
      player: {
        name: 'Avery',
        floor: 4,
      },
      world: {
        totalRuns: 4,
        deepestFloor: 4,
        factions: INITIAL_FACTIONS.map((faction) => {
          if (faction.id === 'goblin_warband') {
            return {
              ...faction,
              power: 82,
              status: 'led' as const,
              activeLeaderId: 'goblin_warlord' as never,
              leader: {
                id: 'goblin_warlord' as never,
                factionId: faction.id,
                name: 'Brakka',
                title: 'Knife-King',
                templateId: 'goblin_warlord',
                isActive: true,
                isSlain: false,
                emergedOnRun: 3,
                emergedOnDepth: 3,
              },
            };
          }

          if (faction.id === 'undead_legion') {
            return {
              ...faction,
              status: 'broken' as const,
              leaderSlain: true,
              power: 12,
            };
          }

          return faction;
        }),
      },
    }),
    lastRetreatFloor: 4,
    lastRunMetrics: {
      damageDealt: 80,
      damageTaken: 30,
      turnsElapsed: 14,
      enemiesKilled: 6,
      itemsUsed: 1,
      goldEarned: 17,
      floorsCleared: 3,
      causeOfEnd: 'retreat',
      consecutiveMisses: 0,
    },
  };
}

describe('deterministic town text', () => {
  it('builds rumors from faction state and town impact without randomness', () => {
    const state = buildFactionTownState();

    const firstPass = buildDeterministicTownRumors(state);
    const secondPass = buildDeterministicTownRumors(state);

    expect(firstPass).toEqual(secondPass);
    expect(firstPass).toHaveLength(3);
    expect(firstPass.some(rumor => FACTION_RUMORS['goblin_warband']!.includes(rumor))).toBe(true);
    expect(firstPass.some(rumor => rumor.includes('Ogre'))).toBe(false);
  });

  it('summarizes the run from metrics, faction pressure, and town impact', () => {
    const state = buildFactionTownState();

    const summary = buildDeterministicRunSummary(state, state.lastRunMetrics!, []);

    expect(summary).toContain('Avery retreated from floor 4');
    expect(summary).toContain('Goblin Warband');
    expect(summary).toContain('Town prosperity');
    expect(summary).toContain('corruption');
  });
});
