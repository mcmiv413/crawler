/**
 * Test layer: unit
 * Behavior: The command result commit coordinator stages command views, commits only the latest queued drain result, preserves settled flags, and registers move animations before commit.
 * Proof: Assertions check immediate commit payloads, second drain callback and last commit payload after queue drain, first drain callback not called, deathTransitioning/loading false on drain, registerMoveAnimation called with the move event, and register-before-commit order.
 * Validation: pnpm vitest run apps/web/src/store/command-result-commit-coordinator.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';
import * as presenter from '@dungeon/presenter';
import { scheduleCommandResultCommit, clearPendingAnimationCommits } from './command-result-commit-coordinator.js';
import * as animationQueueBus from '../animation-runtime/animation-queue-bus.js';
import * as featureFlags from '../config/feature-flags.js';
import { registerMoveAnimation } from '../hooks/useMoveAnimationState.js';

vi.mock('@dungeon/presenter');
vi.mock('../animation-runtime/animation-queue-bus.js');
vi.mock('../config/feature-flags.js');
vi.mock('../hooks/useMoveAnimationState.js', () => ({
  registerMoveAnimation: vi.fn(),
}));

function createMockGameView(overrides?: Partial<GameView>): GameView {
  return {
    gameId: 'test-1',
    phase: 'dungeon',
    player: {
      name: 'TestHero',
      level: 1,
      health: 50,
      maxHealth: 100,
      attack: 10,
      defense: 5,
      accuracy: 80,
      evasion: 20,
      speed: 1,
      totalDamageMin: 5,
      totalDamageMax: 15,
      resistances: {},
      gold: 100,
      floor: 1,
      experience: 0,
      statuses: [],
      abilities: [],
      weaponMastery: null,
      experienceForNextLevel: 100,
      biomeId: null,
      biomeColor: '#888888',
      equippedItems: [],
      statBreakdowns: {},
      activeQuests: [],
      factionProgress: [],
      ogreProgress: {
        status: 'sealed',
        selectedSpawnDepth: null,
        eligibleSpawnDepths: [],
        brokenFactions: 0,
        totalFactions: 4,
        summaryText: '0/4 factions broken.',
      },
      ringSchoolMasteries: [],
      learnedSpells: [],
      studyableSpells: [],
    },
    map: {
      width: 20,
      height: 10,
      dangerLevel: 'moderate' as const,
      playerPosition: { x: 5, y: 5 },
      cells: [],
      entities: [],
      biomeId: 'dungeon',
    },
    combatLog: [],
    availableActions: [],
    town: null,
    inventory: {
      items: [],
      equipped: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      },
    },
    activeQuests: [],
    runResult: null,
    deathStashFloor: null,
    deathSummary: null,
    deathContext: null,
    inspectableEntities: [],
    debugMode: false,
    animatedEvents: [],
    ...overrides,
  };
}

describe('CommandResultCommitCoordinator', () => {
  let unsubscribeCallback: (() => void) | null = null;

  beforeEach(() => {
    clearPendingAnimationCommits();
    unsubscribeCallback = null;
    vi.clearAllMocks();

    const onQueueDrainedMock = vi.fn((cb) => {
      unsubscribeCallback = cb;
      return () => {
        unsubscribeCallback = null;
      };
    });

    vi.mocked(presenter.getAnimatedEventBatchSettleMs).mockReturnValue(500);
    vi.mocked(animationQueueBus.onQueueDrained).mockImplementation(onQueueDrainedMock);
    vi.mocked(featureFlags.isBeatSchedulerEnabledFlag).mockReturnValue(true);
  });

  it('should commit the latest pendingQueueDrainCommit when queue drains after two staged commands', () => {
    const firstView = createMockGameView({ gameId: 'first-view' });
    const firstLog: CombatLogEntry[] = [{ text: 'first attacked', type: 'attack', timestamp: Date.now() }];
    const firstDrainCb = vi.fn();
    const firstCommitCb = vi.fn();

    const secondView = createMockGameView({ gameId: 'second-view' });
    const secondLog: CombatLogEntry[] = [{ text: 'second dealt damage', type: 'damage', timestamp: Date.now() }];
    const secondDrainCb = vi.fn();
    const secondCommitCb = vi.fn();

    const currentView = createMockGameView({ phase: 'dungeon' });

    // Schedule first command with staged animation
    scheduleCommandResultCommit({
      view: firstView,
      combatLog: firstLog,
      isDeath: false,
      currentView,
      onCommit: firstCommitCb,
      onDrain: firstDrainCb,
    });

    // Immediate commit should have first data
    expect(firstCommitCb).toHaveBeenCalledWith({
      view: firstView,
      combatLog: firstLog,
      deathTransitioning: false,
      loading: false,
    });
    expect(secondCommitCb).not.toHaveBeenCalled();

    // Schedule second command before queue drains
    scheduleCommandResultCommit({
      view: secondView,
      combatLog: secondLog,
      isDeath: false,
      currentView,
      onCommit: secondCommitCb,
      onDrain: secondDrainCb,
    });

    // Immediate commit should have second data (replaces pending)
    expect(secondCommitCb).toHaveBeenCalledWith({
      view: secondView,
      combatLog: secondLog,
      deathTransitioning: false,
      loading: false,
    });

    // Now emit queue drained
    expect(unsubscribeCallback).not.toBeNull();
    unsubscribeCallback!();

    // Queue drain callback should commit the SECOND command (not first)
    expect(secondDrainCb).toHaveBeenCalled();
    expect(secondCommitCb).toHaveBeenLastCalledWith({
      view: secondView,
      combatLog: secondLog,
      deathTransitioning: false,
      loading: false,
    });

    // First drain should NOT be called
    expect(firstDrainCb).not.toHaveBeenCalled();
  });

  it('should preserve deathTransitioning false and loading false on queue drain', () => {
    const view = createMockGameView();
    const log: CombatLogEntry[] = [];
    const drainCb = vi.fn();
    const commitCb = vi.fn();
    const currentView = createMockGameView({ phase: 'dungeon' });

    scheduleCommandResultCommit({
      view,
      combatLog: log,
      isDeath: false,
      currentView,
      onCommit: commitCb,
      onDrain: drainCb,
    });

    expect(unsubscribeCallback).not.toBeNull();
    unsubscribeCallback!();

    expect(commitCb.mock.calls.length).toBeGreaterThan(0);
    const lastCall = commitCb.mock.calls[commitCb.mock.calls.length - 1]!;
    expect(lastCall[0]).toEqual({
      view,
      combatLog: log,
      deathTransitioning: false,
      loading: false,
    });
  });

  it('registers immediate move animations before committing the staged view', () => {
    const moveAnimation = {
      entityId: 'player-1',
      fromPos: { x: 4, y: 5 },
      toPos: { x: 5, y: 5 },
      style: 'step',
      durationMs: 140,
    };
    const view = createMockGameView({
      animatedEvents: [{
        type: 'move',
        sequenceIndex: 0,
        delayMs: 0,
        beatId: 'beat-1',
        beatIndex: 0,
        beatRelativeDelayMs: 0,
        batchId: 'batch-1',
        data: moveAnimation,
      }],
    });
    const callOrder: string[] = [];
    vi.mocked(registerMoveAnimation).mockImplementation(() => {
      callOrder.push('register');
    });
    const commitCb = vi.fn(() => {
      callOrder.push('commit');
    });

    scheduleCommandResultCommit({
      view,
      combatLog: [],
      isDeath: false,
      currentView: createMockGameView({ phase: 'dungeon' }),
      onCommit: commitCb,
    });

    expect(registerMoveAnimation).toHaveBeenCalledWith(moveAnimation);
    expect(callOrder).toEqual(['register', 'commit']);
  });
});
