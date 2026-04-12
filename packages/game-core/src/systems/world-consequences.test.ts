import { describe, it, expect } from 'vitest';
import { applyRunConsequences, evaluateEventChains } from './world-consequences.js';
import type { RunMetrics, NpcState } from '@dungeon/contracts';
import { entityId, EMPTY_RUN_METRICS } from '@dungeon/contracts';
import { createTestGameState } from '../test-utils.js';

const metrics = (overrides: Partial<RunMetrics> = {}): RunMetrics => ({
  ...EMPTY_RUN_METRICS,
  causeOfEnd: 'death',
  enemiesKilled: 2,
  floorsCleared: 1,
  ...overrides,
});

describe('applyRunConsequences', () => {
  it('decreases prosperity on death', () => {
    const state = createTestGameState();
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'death' }));
    expect(newState.world.town.prosperity).toBeLessThan(state.world.town.prosperity);
  });

  it('increases prosperity on retreat', () => {
    const state = createTestGameState();
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'retreat', floorsCleared: 2 }));
    expect(newState.world.town.prosperity).toBeGreaterThan(state.world.town.prosperity);
  });

  it('increases prosperity more on victory with many kills', () => {
    const state = createTestGameState();
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'victory', floorsCleared: 3, enemiesKilled: 12 }));
    expect(newState.world.town.prosperity).toBeGreaterThan(state.world.town.prosperity + 10);
  });

  it('ticks corruption up when nemeses are active', () => {
    const nemesis = {
      id: entityId('n1'),
      name: 'Vorreth',
      title: 'the Unbroken',
      sourceTemplateId: 'goblin_archer',
      rank: 1 as const,
      tier: 2 as const,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 },
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
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'retreat', floorsCleared: 1 }));
    expect(newState.world.town.corruption).toBeGreaterThan(state.world.town.corruption);
  });

  it('emits TOWN_STATE_CHANGED events for changes', () => {
    const state = createTestGameState();
    const { events } = applyRunConsequences(state, metrics({ causeOfEnd: 'death' }));
    const changes = events.filter(e => e.type === 'TOWN_STATE_CHANGED');
    expect(changes.length).toBeGreaterThan(0);
  });
});

describe('applyRunConsequences shopkeeper availability', () => {
  const shopkeeper: NpcState = {
    id: entityId('npc_shopkeeper'),
    name: 'Torben',
    role: 'shopkeeper',
    disposition: 50,
    available: true,
    dialogueKey: 'shopkeeper',
  };

  it('shopkeeper becomes unavailable when prosperity drops below 25', () => {
    // Prosperity 27 - 3 (death) = 24 < 25 → unavailable
    const state = createTestGameState({
      world: {
        npcs: [shopkeeper],
        town: { prosperity: 27, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
      },
    });
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'death', enemiesKilled: 0 }));
    const npc = newState.world.npcs.find(n => n.role === 'shopkeeper')!;
    expect(npc.available).toBe(false);
  });

  it('shopkeeper remains available when prosperity stays at or above 25', () => {
    // Prosperity 50 - 3 = 47 ≥ 25 → still available
    const state = createTestGameState({
      world: {
        npcs: [shopkeeper],
        town: { prosperity: 50, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
      },
    });
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'death', enemiesKilled: 0 }));
    const npc = newState.world.npcs.find(n => n.role === 'shopkeeper')!;
    expect(npc.available).toBe(true);
  });

  it('shopkeeper becomes available again when prosperity recovers to 40+', () => {
    // Prosperity 38 + 10 (victory, 1 floor) = 48 ≥ 40 → available
    const unavailableShopkeeper: NpcState = { ...shopkeeper, available: false };
    const state = createTestGameState({
      world: {
        npcs: [unavailableShopkeeper],
        town: { prosperity: 38, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
      },
    });
    const { state: newState } = applyRunConsequences(
      state,
      metrics({ causeOfEnd: 'victory', floorsCleared: 1, enemiesKilled: 0 }),
    );
    const npc = newState.world.npcs.find(n => n.role === 'shopkeeper')!;
    expect(npc.available).toBe(true);
  });
});

describe('evaluateEventChains', () => {
  it('triggers fear spike when 3+ deaths in recent history', () => {
    const deathEvent = {
      type: 'PLAYER_DIED' as const,
      killerId: null,
      floor: 1,
      cause: 'test',
      timestamp: Date.now(),
      turnNumber: 1,
    };
    const state = createTestGameState({
      world: {
        eventHistory: [deathEvent, deathEvent, deathEvent],
        town: { prosperity: 50, fear: 30, corruption: 10, rumors: [], lastRunSummary: null },
      },
    });
    const { state: newState } = evaluateEventChains(state);
    expect(newState.world.town.fear).toBeGreaterThan(state.world.town.fear);
  });

  it('does not spike fear when already at 80+', () => {
    const deathEvent = {
      type: 'PLAYER_DIED' as const,
      killerId: null,
      floor: 1,
      cause: 'test',
      timestamp: Date.now(),
      turnNumber: 1,
    };
    const state = createTestGameState({
      world: {
        eventHistory: [deathEvent, deathEvent, deathEvent],
        town: { prosperity: 50, fear: 80, corruption: 10, rumors: [], lastRunSummary: null },
      },
    });
    const { state: newState } = evaluateEventChains(state);
    expect(newState.world.town.fear).toBe(state.world.town.fear);
  });

  it('faction at 0 power gets improved disposition', () => {
    const weakFaction = { id: 'goblin_warband', name: 'Goblin Warband', power: 0, disposition: -30 };
    const state = createTestGameState({ world: { factions: [weakFaction] } });
    const { state: newState } = evaluateEventChains(state);
    expect(newState.world.factions[0]!.disposition).toBeGreaterThan(weakFaction.disposition);
  });
});

describe('event history capping', () => {
  it('caps eventHistory to 100 entries after applyRunConsequences', () => {
    const fakeEvent = {
      type: 'PLAYER_MOVED' as const,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      timestamp: Date.now(),
      turnNumber: 1,
    };
    // Create 150 events
    const eventHistory = Array.from({ length: 150 }, () => ({ ...fakeEvent }));
    const state = createTestGameState({ world: { eventHistory } });
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'retreat', floorsCleared: 1 }));
    expect(newState.world.eventHistory.length).toBeLessThanOrEqual(100);
  });

  it('does not trim eventHistory when at or below 100', () => {
    const fakeEvent = {
      type: 'PLAYER_MOVED' as const,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      timestamp: Date.now(),
      turnNumber: 1,
    };
    const eventHistory = Array.from({ length: 50 }, () => ({ ...fakeEvent }));
    const state = createTestGameState({ world: { eventHistory } });
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'retreat', floorsCleared: 1 }));
    // Should still have all original events (plus any new ones from consequences)
    expect(newState.world.eventHistory.length).toBeGreaterThanOrEqual(50);
  });
});
