import { describe, it, expect } from 'vitest';
import { updateFactionOnKill, tickFactionPowerForNemeses } from './factions.js';
import type { NemesisRecord } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { createTestGameState } from '../test-utils.js';

describe('updateFactionOnKill', () => {
  it('reduces power of the faction matching the killed template', () => {
    const state = createTestGameState();
    const goblinFaction = state.world.factions.find(f => f.id === 'goblin_warband')!;
    const before = goblinFaction.power;

    const newState = updateFactionOnKill(state, 'goblin_archer');
    const after = newState.world.factions.find(f => f.id === 'goblin_warband')!.power;

    expect(after).toBeLessThan(before);
    expect(after).toBe(before - 3);
  });

  it('does not change other factions', () => {
    const state = createTestGameState();
    const newState = updateFactionOnKill(state, 'goblin_archer');
    const undead = newState.world.factions.find(f => f.id === 'undead_legion')!;
    const undeadBefore = state.world.factions.find(f => f.id === 'undead_legion')!;
    expect(undead.power).toBe(undeadBefore.power);
  });

  it('does not go below 0', () => {
    const state = createTestGameState({
      world: { factions: [{ id: 'goblin_warband', name: 'Goblin Warband', power: 1, disposition: -30 }] },
    });
    const newState = updateFactionOnKill(state, 'goblin_archer');
    expect(newState.world.factions[0]!.power).toBe(0);
  });

  it('ignores unknown template', () => {
    const state = createTestGameState();
    const newState = updateFactionOnKill(state, 'unknown_enemy');
    expect(newState.world.factions).toEqual(state.world.factions);
  });
});

describe('tickFactionPowerForNemeses', () => {
  it('increases power of faction with an active nemesis', () => {
    const nemesis: NemesisRecord = {
      id: entityId('n1'),
      name: 'Vorreth',
      title: 'the Unbroken',
      sourceTemplateId: 'goblin_archer',
      rank: 1,
      tier: 2,
      stats: { maxHealth: 40, health: 40, attack: 10, defense: 4, accuracy: 70, evasion: 15, speed: 120 },
      traits: [],
      weaknesses: [],
      killEventId: null,
      encounterCount: 0,
      isActive: true,
      killCount: 1,
      floorOfAscension: 2,
      biomeOfAscension: 'crypt',
      killedByWeaponType: null,
    };
    const state = createTestGameState({ world: { nemeses: [nemesis] } });
    const before = state.world.factions.find(f => f.id === 'goblin_warband')!.power;
    const newState = tickFactionPowerForNemeses(state);
    const after = newState.world.factions.find(f => f.id === 'goblin_warband')!.power;
    expect(after).toBeGreaterThan(before);
  });

  it('does nothing when no active nemeses', () => {
    const state = createTestGameState();
    const newState = tickFactionPowerForNemeses(state);
    expect(newState.world.factions).toEqual(state.world.factions);
  });
});
