import { GameEngine } from '@dungeon/core';
import type {
  AiService,
  NpcDialogueContext,
  RumorContext,
  RunSummaryContext,
} from '@dungeon/core/ai/ai-service.js';
import { createTestGameState, createTestGameStateInCombat, createWaitCommand } from '@dungeon/core/testing';
import { entityId } from '@dungeon/contracts';
import type {
  DomainEvent,
  IGameRepository,
} from '@dungeon/contracts';
import { INITIAL_FACTIONS } from '@dungeon/content';
import { processGameCommand } from './process-command.js';
import {
  buildDeterministicRunSummary,
  buildDeterministicTownRumors,
} from './town-text.js';

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

describe('processGameCommand', () => {
  it('uses deterministic run-end town text without calling AI summary or rumor generation', async () => {
    const initialState = createTestGameState({
      player: {
        name: 'Avery',
        floor: 4,
      },
    });
    const finalState = {
      ...initialState,
      version: initialState.version + 1,
      lastRetreatFloor: 4,
      lastRunMetrics: {
        damageDealt: 120,
        damageTaken: 40,
        turnsElapsed: 18,
        enemiesKilled: 5,
        itemsUsed: 1,
        goldEarned: 21,
        floorsCleared: 3,
        causeOfEnd: 'retreat' as const,
        consecutiveMisses: 0,
      },
      world: {
        ...initialState.world,
        totalRuns: 4,
        deepestFloor: 4,
        factions: INITIAL_FACTIONS.map((faction) => {
          if (faction.id === 'goblin_warband') {
            return {
              ...faction,
              power: 82,
              status: 'led' as const,
              activeLeaderId: entityId('goblin_warlord'),
              leader: {
                id: entityId('goblin_warlord'),
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
    };
    const events: readonly DomainEvent[] = [];
    const engine = {
      submitCommand: vi.fn(() => ({
        state: finalState,
        events,
        runEnded: true,
      })),
    } as unknown as GameEngine;
    const ai = createAiStub();
    const repo = createRepoStub();
    const log = { warn: vi.fn() };

    await processGameCommand({
      ai,
      command: { type: 'WAIT' },
      engine,
      gameId: initialState.gameId,
      log,
      repo,
      state: initialState,
    });

    const persistedState = vi.mocked(repo.commitTick).mock.calls[0]![2];
    expect(persistedState.world.town.lastRunSummary).toBe(
      buildDeterministicRunSummary(finalState, finalState.lastRunMetrics, events),
    );
    expect(persistedState.world.town.rumors).toEqual(buildDeterministicTownRumors(finalState));
    expect(ai.generateRunSummary).not.toHaveBeenCalled();
    expect(ai.generateRumor).not.toHaveBeenCalled();
  });

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
