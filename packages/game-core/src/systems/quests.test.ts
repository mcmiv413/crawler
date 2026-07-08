/**
 * Test layer: unit
 * Behavior: completeFloorDepthQuests marks active reach-floor quests ready only at the matching depth and leaves other quest states unchanged.
 * Proof: Assertions check ready_to_turn_in versus active status, unchanged player gold, no-op state equality, empty events for non-completions, and QUEST_READY with the matching questId.
 * Validation: pnpm vitest run packages/game-core/src/systems/quests.test.ts
 */
import { describe, it, expect } from 'vitest';
import { completeFloorDepthQuests } from './quests.js';
import { createTestGameState } from '../test-utils.js';
import type { Quest } from '@dungeon/contracts';

// ---------------------------------------------------------------------------
// Local fixture — no @dungeon/content import.
// Live template round-trips live in tests/contracts/quests.contract.test.ts
// ---------------------------------------------------------------------------

/** Minimal reach_floor quest fixture covering the completeFloorDepthQuests logic */
const STUB_REACH_FLOOR_QUEST: Quest = {
  id: 'quest_reach_floor_3_npc_informant_10',
  title: 'Delve Deeper',
  description: 'Reach floor 3 of the dungeon.',
  objectiveText: 'Reach floor 3.',
  status: 'active',
  objective: { type: 'reach_floor', targetCount: 3, progress: 0 },
  reward: { type: 'gold', amount: 80 },
  giverNpcId: 'npc_informant',
};

describe('completeFloorDepthQuests', () => {
  it('marks a reach_floor quest ready when the target depth is reached', () => {
    const state = {
      ...createTestGameState({ player: { gold: 75, floor: 3 } }),
      activeQuests: [STUB_REACH_FLOOR_QUEST],
    };

    const result = completeFloorDepthQuests(state, 3);

    expect(result.state.activeQuests[0]!.status).toBe('ready_to_turn_in');
    expect(result.state.player.gold).toBe(state.player.gold);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'QUEST_READY',
      questId: STUB_REACH_FLOOR_QUEST.id,
    });
  });

  it('leaves a reach_floor quest active when a different depth is reached', () => {
    const state = {
      ...createTestGameState(),
      activeQuests: [STUB_REACH_FLOOR_QUEST],
    };

    const result = completeFloorDepthQuests(state, 4);

    expect(result.state.activeQuests[0]!.status).toBe('active');
    expect(result.state.player.gold).toBe(state.player.gold);
    expect(result.events).toEqual([]);
  });

  it('is a no-op when there are no active quests', () => {
    const state = createTestGameState();

    const result = completeFloorDepthQuests(state, 3);

    expect(result.state).toEqual(state);
    expect(result.events).toEqual([]);
  });

  it('does not complete a quest that is already ready_to_turn_in', () => {
    const alreadyReady: Quest = { ...STUB_REACH_FLOOR_QUEST, status: 'ready_to_turn_in' };
    const state = {
      ...createTestGameState(),
      activeQuests: [alreadyReady],
    };

    const result = completeFloorDepthQuests(state, 3);

    expect(result.state.activeQuests[0]!.status).toBe('ready_to_turn_in');
    expect(result.events).toEqual([]);
  });
});
