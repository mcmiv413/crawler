import type { GameEngine } from '@dungeon/core';
import type {
  AiService,
  NpcDialogueContext,
  RumorContext,
  RunSummaryContext,
} from '@dungeon/core/ai/ai-service.js';
import { createTestGameState } from '@dungeon/core/testing';
import { entityId } from '@dungeon/contracts';
import type {
  DomainEvent,
  FactionState,
  IGameRepository,
} from '@dungeon/contracts';
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

/** Minimal factions for unit-level testing — no @dungeon/content import needed. */
const STUB_FACTIONS: readonly FactionState[] = [
  {
    id: 'goblin_warband',
    name: 'Goblin Warband',
    power: 82,
    disposition: 0,
    status: 'led',
    activeLeaderId: entityId('goblin_warlord'),
    leader: {
      id: entityId('goblin_warlord'),
      factionId: 'goblin_warband',
      name: 'Brakka',
      title: 'Knife-King',
      templateId: 'goblin_warlord',
      isActive: true,
      isSlain: false,
      emergedOnRun: 3,
      emergedOnDepth: 3,
    },
    leaderSlain: false,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
  {
    id: 'undead_legion',
    name: 'Undead Legion',
    power: 12,
    disposition: 0,
    status: 'broken',
    leader: null,
    leaderSlain: true,
    membersKilledByPlayer: 0,
    leadersKilledByPlayer: 0,
    playerDeathsCaused: 0,
  },
];

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
        factions: STUB_FACTIONS,
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
});
