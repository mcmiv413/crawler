/**
 * Test layer: unit
 * Behavior: World Consequences covers applyRunConsequences; decreases prosperity on death; increases prosperity on retreat.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/world-consequences.test.ts
 */
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

  it('emits TOWN_STATE_CHANGED events for changes', () => {
    const state = createTestGameState();
    const { events } = applyRunConsequences(state, metrics({ causeOfEnd: 'death' }));
    const changes = events.filter(e => e.type === 'TOWN_STATE_CHANGED');
    expect(changes.map(change => change.type)).toContain('TOWN_STATE_CHANGED');
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
      killerName: null,
      killerSpriteName: null,
      floor: 1,
      cause: 'test',
      goldLost: 0,
      overkillDamage: 0,
      timestamp: 1,
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
      killerName: null,
      killerSpriteName: null,
      floor: 1,
      cause: 'test',
      goldLost: 0,
      overkillDamage: 0,
      timestamp: 1,
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

  it('considers current command events when checking chain thresholds', () => {
    const deathEvent = {
      type: 'PLAYER_DIED' as const,
      killerId: null,
      killerName: null,
      killerSpriteName: null,
      floor: 1,
      cause: 'test',
      goldLost: 0,
      overkillDamage: 0,
      timestamp: 1,
      turnNumber: 1,
    };
    const state = createTestGameState({
      world: {
        eventHistory: [deathEvent, { ...deathEvent, timestamp: 2 }],
        town: { prosperity: 50, fear: 30, corruption: 10, rumors: [], lastRunSummary: null },
      },
    });

    const { state: newState } = evaluateEventChains(
      state,
      [...state.world.eventHistory, { ...deathEvent, timestamp: 3 }],
    );

    expect(newState.world.town.fear).toBeGreaterThan(state.world.town.fear);
  });
});

describe('event history capping', () => {
  it('caps eventHistory to 100 entries after applyRunConsequences', () => {
    const fakeEvent = {
      type: 'PLAYER_MOVED' as const,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      timestamp: 1,
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
      timestamp: 1,
      turnNumber: 1,
    };
    const eventHistory = Array.from({ length: 50 }, () => ({ ...fakeEvent }));
    const state = createTestGameState({ world: { eventHistory } });
    const { state: newState } = applyRunConsequences(state, metrics({ causeOfEnd: 'retreat', floorsCleared: 1 }));
    // Should still have all original events (plus any new ones from consequences)
    expect(newState.world.eventHistory.length).toBeGreaterThanOrEqual(50);
  });

  it('does not mutate faction state on non-faction events', () => {
    const baseFactions = createTestGameState().world.factions;
    const state = createTestGameState({
      world: {
        factions: baseFactions.map(f => ({
          ...f,
          power: 0,
          disposition: -5,
        })),
      },
    });

    const beforeFactions = state.world.factions;
    const result = evaluateEventChains(state);
    const afterFactions = result.state.world.factions;

    for (let i = 0; i < beforeFactions.length; i++) {
      expect(afterFactions[i]!.id).toBe(beforeFactions[i]!.id);
      expect(afterFactions[i]!.status).toBe(beforeFactions[i]!.status);
      expect(afterFactions[i]!.power).toBe(beforeFactions[i]!.power);
      expect(afterFactions[i]!.disposition).toBe(beforeFactions[i]!.disposition);
      expect(afterFactions[i]!.leaderSlain).toBe(beforeFactions[i]!.leaderSlain);
    }
  });
});
