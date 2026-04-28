import { describe, it, expect } from 'vitest';
import type { GameState, Quest } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { ITEM_BY_ID } from '@dungeon/content';
import { evaluateQuestProgress, redeemQuest, getObjectiveText } from './quest-progress.js';
import { createTestGameState } from '../test-utils.js';

function createQuestState(options?: {
  inventory?: readonly string[];
  gold?: number;
  floor?: number;
}): GameState {
  return {
    ...createTestGameState({
      player: {
        inventory: (options?.inventory ?? []).map(itemId => entityId(itemId)),
        gold: options?.gold ?? 50,
        floor: options?.floor ?? 0,
      },
    }),
    itemRegistry: {
      items: new Map([...ITEM_BY_ID].map(([itemId, item]) => [entityId(itemId), item] as const)),
    },
  };
}

describe('Quest Progress System', () => {
  describe('evaluateQuestProgress', () => {
    it('marks a collect_item quest ready when player acquires item', () => {
      // Create quest for collecting "iron_sword"
      const quest: Quest = {
        id: 'quest_1',
        title: 'Retrieve the Iron Sword',
        description: 'Find and bring back the iron sword',
        status: 'active',
        objective: {
          type: 'collect_item',
          targetId: 'iron_sword',
          progress: 0,
        },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_informant_1',
      };

      // Build state where player has the item
      const state = createQuestState({ inventory: ['iron_sword'] });

      const result = evaluateQuestProgress(quest, state);

      expect(result.quest.status).toBe('ready_to_turn_in');
      expect(result.quest.objective.progress).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe('QUEST_READY');
    });

    it('keeps quest active if player does not have item', () => {
      const quest: Quest = {
        id: 'quest_1',
        title: 'Retrieve the Iron Sword',
        description: 'Find and bring back the iron sword',
        status: 'active',
        objective: {
          type: 'collect_item',
          targetId: 'iron_sword',
          progress: 0,
        },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_informant_1',
      };

      const state = createQuestState();

      const result = evaluateQuestProgress(quest, state);

      expect(result.quest.status).toBe('active');
      expect(result.quest.objective.progress).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('marks reach_floor quest ready when player reaches target depth', () => {
      const quest: Quest = {
        id: 'quest_2',
        title: 'Reach Floor 5',
        description: 'Descend to floor 5 of the dungeon',
        status: 'active',
        objective: {
          type: 'reach_floor',
          targetCount: 5,
          progress: 0,
        },
        reward: { type: 'gold', amount: 150 },
        giverNpcId: 'npc_informant_1',
      };

      const state = createQuestState({ floor: 5 });

      const result = evaluateQuestProgress(quest, state);

      expect(result.quest.status).toBe('ready_to_turn_in');
      expect(result.quest.objective.progress).toBe(5);
      expect(result.events[0]?.type).toBe('QUEST_READY');
    });

    it('does not mark ready if on intermediate floor', () => {
      const quest: Quest = {
        id: 'quest_2',
        title: 'Reach Floor 5',
        description: 'Descend to floor 5 of the dungeon',
        status: 'active',
        objective: {
          type: 'reach_floor',
          targetCount: 5,
          progress: 0,
        },
        reward: { type: 'gold', amount: 150 },
        giverNpcId: 'npc_informant_1',
      };

      const state = createQuestState({ floor: 3 });

      const result = evaluateQuestProgress(quest, state);

      expect(result.quest.status).toBe('active');
      expect(result.quest.objective.progress).toBe(3);
    });

    it('does not re-evaluate non-active quests', () => {
      const quest: Quest = {
        id: 'quest_1',
        title: 'Test Quest',
        description: 'Test',
        status: 'ready_to_turn_in',
        objective: { type: 'collect_item', targetId: 'item', progress: 0 },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_1',
      };

      const state = createQuestState();

      const result = evaluateQuestProgress(quest, state);

      expect(result.quest.status).toBe('ready_to_turn_in');
      expect(result.events).toHaveLength(0);
    });
  });

  describe('redeemQuest', () => {
    it('marks quest as rewarded and adds gold to player', () => {
      const state = createQuestState({ gold: 100 });

      const quest: Quest = {
        id: 'quest_1',
        title: 'Test Quest',
        description: 'Test',
        status: 'ready_to_turn_in',
        objective: { type: 'collect_item', targetId: 'item', progress: 1 },
        reward: { type: 'gold', amount: 250 },
        giverNpcId: 'npc_1',
      };

      const stateWithQuest: GameState = {
        ...state,
        activeQuests: [quest],
      };

      const result = redeemQuest(stateWithQuest, quest);

      expect(result.state.player.gold).toBe(350);
      expect(result.state.activeQuests[0]?.status).toBe('rewarded');
      expect(result.event.type).toBe('QUEST_TURNED_IN');
      if (result.event.type !== 'QUEST_TURNED_IN') {
        throw new Error(`Expected QUEST_TURNED_IN, got ${result.event.type}`);
      }
      expect(result.event.questId).toBe('quest_1');
      expect(result.event.rewardGold).toBe(250);
    });

    it('throws error if quest is not ready to turn in', () => {
      const state = createQuestState();
      const quest: Quest = {
        id: 'quest_1',
        title: 'Test Quest',
        description: 'Test',
        status: 'active',
        objective: { type: 'collect_item', targetId: 'item', progress: 0 },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_1',
      };

      const stateWithQuest: GameState = {
        ...state,
        activeQuests: [quest],
      };

      expect(() => redeemQuest(stateWithQuest, quest)).toThrow();
    });
  });

  describe('getObjectiveText', () => {
    it('returns quest-specific objectiveText when present', () => {
      const quest: Quest = {
        id: 'quest_1',
        title: 'Find the Sword',
        description: 'Find the legendary sword in the deep dungeon',
        objectiveText: 'Recover the legendary sword and return it.',
        status: 'active',
        objective: {
          type: 'collect_item',
          targetId: 'legendary_sword',
          progress: 0,
        },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_1',
      };

      const text = getObjectiveText(quest);
      expect(text).toBe(quest.objectiveText);
    });

    it('generates collect_item text from the target item id when objectiveText is absent', () => {
      const quest: Quest = {
        id: 'quest_collect_fallback',
        title: 'Find the Sword',
        description: 'Find the legendary sword in the deep dungeon',
        status: 'active',
        objective: {
          type: 'collect_item',
          targetId: 'legendary_sword',
          progress: 0,
        },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_1',
      };

      const text = getObjectiveText(quest);
      expect(text).toBe('Collect Legendary Sword');
    });

    it('generates defeat_enemy text from the target enemy id when objectiveText is absent', () => {
      const quest: Quest = {
        id: 'quest_defeat_fallback',
        title: 'Hunt the Shadow Lurker',
        description: 'Track down the shadow creature',
        status: 'active',
        objective: {
          type: 'defeat_enemy',
          targetId: 'shadow_lurker',
          progress: 0,
        },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_1',
      };

      const text = getObjectiveText(quest);
      expect(text).toBe('Defeat Shadow Lurker');
    });

    it('returns "Reach floor X" for reach_floor objectives', () => {
      const quest: Quest = {
        id: 'quest_2',
        title: 'Reach Floor 10',
        description: 'Go deep',
        status: 'active',
        objective: {
          type: 'reach_floor',
          targetCount: 10,
          progress: 0,
        },
        reward: { type: 'gold', amount: 100 },
        giverNpcId: 'npc_1',
      };

      const text = getObjectiveText(quest);
      expect(text).toContain('10');
      expect(text.toLowerCase()).toContain('floor');
    });
  });

  describe('Full quest lifecycle', () => {
    it('completes full chain: assign -> progress -> ready -> turn in -> rewarded', () => {
      // Start with active quest
      const initialQuest: Quest = {
        id: 'quest_lifecycle',
        title: 'Defeat 5 Goblins',
        description: 'Hunt down and defeat 5 goblins',
        status: 'active',
        objective: {
          type: 'defeat_enemy',
          targetId: 'goblin',
          targetCount: 5,
          progress: 0,
        },
        reward: { type: 'gold', amount: 500 },
        giverNpcId: 'informant_1',
      };

      let state = createQuestState({ gold: 100 });
      state = { ...state, activeQuests: [initialQuest] };

      // Simulate defeating enemies by manually updating progress
      let quest = initialQuest;

      // Simulate quest completion (would normally come from combat system)
      quest = {
        ...quest,
        objective: { ...quest.objective, progress: 5 },
      };

      // Evaluate progress
      const progressResult = evaluateQuestProgress(quest, state);
      expect(progressResult.quest.status).toBe('ready_to_turn_in');

      // Update state with ready quest
      const stateWithReadyQuest: GameState = {
        ...state,
        activeQuests: [progressResult.quest],
      };

      // Redeem quest
      const redeemResult = redeemQuest(stateWithReadyQuest, progressResult.quest);
      expect(redeemResult.state.player.gold).toBe(600);
      expect(redeemResult.state.activeQuests[0]?.status).toBe('rewarded');
    });
  });
});
