/**
 * Test layer: integration
 * Behavior: Command Processing covers command-processing integration; persists current command events into event history before returning the run-end state.
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run tests/integration/command-processing.integration.test.ts
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '@dungeon/core';
import type {
  AiService,
  NpcDialogueContext,
  RumorContext,
  RunSummaryContext,
} from '@dungeon/core/ai/ai-service.js';
import { createTestGameStateInCombat, createWaitCommand } from '@dungeon/core/testing';
import type { IGameRepository } from '@dungeon/contracts';
import { processGameCommand } from '../../apps/server/src/game-command/process-command.js';

function createAiStub(): AiService {
  return {
    generateDialogue: vi.fn((_context: NpcDialogueContext) => Promise.resolve('unused')),
    generateRumor: vi.fn((_context: RumorContext) => Promise.resolve('unused')),
    generateRunSummary: vi.fn((_context: RunSummaryContext) => Promise.resolve('unused')),
  };
}

function createRepoStub(): IGameRepository {
  return {
    createGame: vi.fn(() => Promise.resolve()),
    loadGame: vi.fn(() => Promise.resolve(null)),
    saveGame: vi.fn(() => Promise.resolve()),
    appendEvents: vi.fn(() => Promise.resolve()),
    getRecentEvents: vi.fn(() => Promise.resolve([])),
    recordRunMetrics: vi.fn(),
    getRunMetricsLog: vi.fn(() => []),
    commitTick: vi.fn(() => Promise.resolve()),
  };
}

describe('command-processing integration', () => {
  it('persists current command events into event history before returning the run-end state', async () => {
    const baseState = createTestGameStateInCombat();
    const [enemy] = baseState.run?.enemies.values() ?? [];
    expect(enemy).toBeDefined();

    const priorDeathEvent = {
      type: 'PLAYER_DIED' as const,
      killerId: null,
      killerName: null,
      killerSpriteName: null,
      floor: 1,
      cause: 'prior death',
      goldLost: 0,
      overkillDamage: 0,
      timestamp: 1,
      turnNumber: 1,
    };

    const state = {
      ...baseState,
      player: {
        ...baseState.player,
        baseStats: {
          ...baseState.player.baseStats,
          maxHealth: 200,
        },
        stats: {
          ...baseState.player.stats,
          health: 10,
          maxHealth: 200,
          defense: 0,
          evasion: 0,
        },
      },
      world: {
        ...baseState.world,
        eventHistory: [priorDeathEvent, { ...priorDeathEvent, timestamp: 2, turnNumber: 2 }],
        town: {
          ...baseState.world.town,
          fear: 30,
        },
      },
      run: {
        ...baseState.run!,
        enemies: new Map([
          ['1,0', {
            ...enemy!,
            stats: {
              ...enemy!.stats,
              attack: 100,
              accuracy: 100,
            },
          }],
        ]),
      },
    };
    const ai = createAiStub();
    const repo = createRepoStub();
    const log = { warn: vi.fn() };

    const result = await processGameCommand({
      ai,
      command: createWaitCommand(),
      engine: new GameEngine(),
      gameId: state.gameId,
      log,
      repo,
      state,
    });

    const persistedState = vi.mocked(repo.commitTick).mock.calls[0]![2];
    const committedEvents = vi.mocked(repo.commitTick).mock.calls[0]![3];

    expect(result.runEnded).toBe(true);
    expect(committedEvents).toEqual(result.events);
    expect(committedEvents).toContainEqual(
      expect.objectContaining({ type: 'PLAYER_DIED' }),
    );
    expect(committedEvents).toContainEqual(
      expect.objectContaining({
        type: 'TOWN_STATE_CHANGED',
        field: 'fear',
      }),
    );
    expect(persistedState.world.eventHistory.length).toBe(state.world.eventHistory.length + result.events.length);
    expect(persistedState.world.eventHistory.slice(-result.events.length)).toEqual(result.events);
  });
});
