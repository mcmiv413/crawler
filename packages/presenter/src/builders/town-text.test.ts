/**
 * Test layer: unit
 * Behavior: Deterministic town text derives rumors and run summaries from faction, town, and run metric state and exposes the same strings through buildTownView.
 * Proof: Assertions compare two rumor passes for equality, verify three rumors including faction content and excluding Ogre text, check summary substrings for player, faction, prosperity, and corruption, and compare view.rumors and view.lastRunSummary to the deterministic builders.
 * Validation: pnpm vitest run packages/presenter/src/builders/town-text.test.ts
 */
import { describe, expect, it } from 'vitest';
import { createTestGameState } from '@dungeon/core/testing';
import type { FactionState, GameState } from '@dungeon/contracts';
import { buildDeterministicRunSummary, buildDeterministicTownRumors } from './town-text.js';
import { buildTownView } from './town-view-builder.js';

// ---------------------------------------------------------------------------
// Local stubs — avoids @dungeon/content runtime imports.
// ---------------------------------------------------------------------------

/** Minimal faction states matching the real IDs used by town-text logic. */
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
    power: 40,
    disposition: -20,
    status: 'leaderless',
    leader: null,
    leaderSlain: false,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
  {
    id: 'beast_swarm',
    name: 'Beast Swarm',
    power: 35,
    disposition: -10,
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
    power: 30,
    disposition: -25,
    status: 'leaderless',
    leader: null,
    leaderSlain: false,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
];

/** Known goblin_warband faction rumor strings (subset of content) used to
 *  validate the rumor picker without importing @dungeon/content at runtime. */
const GOBLIN_WARBAND_RUMORS: readonly string[] = [
  'The goblin patrols have grown bold — they were spotted at the third gate last night.',
  'Traders refuse to use the east road. Too many goblin ambushes near the dungeon mouth.',
  'The warband has a leader now. Something changed them.',
  'I saw smoke rising from deep below — goblin cookfires, they say. Many of them.',
];

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
        factions: STUB_FACTIONS.map((faction) => {
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
    expect(firstPass.some(rumor => GOBLIN_WARBAND_RUMORS.includes(rumor))).toBe(true);
    expect(firstPass.some(rumor => rumor.includes('Ogre'))).toBe(false);
  });

  it('summarizes the run from metrics, faction pressure, and town impact', () => {
    const state = buildFactionTownState();

    const summary = buildDeterministicRunSummary(state, state.lastRunMetrics!);

    expect(summary).toContain('Avery retreated from floor 4');
    expect(summary).toContain('Goblin Warband');
    expect(summary).toContain('Town prosperity');
    expect(summary).toContain('corruption');
  });

  it('exposes presenter-built rumors and run summary through the town view', () => {
    const state = buildFactionTownState();

    const view = buildTownView(state);

    expect(view.rumors).toEqual(buildDeterministicTownRumors(state));
    expect(view.lastRunSummary).toBe(buildDeterministicRunSummary(state, state.lastRunMetrics!));
    expect(view.rumors.length).toBeGreaterThan(0);
  });
});
