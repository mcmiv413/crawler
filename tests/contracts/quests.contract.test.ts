/**
 * Test layer: contract
 * Behavior: Quests covers completeFloorDepthQuests — live template round-trips; completes every live floor-depth quest template when its target depth is reached; l....
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/quests.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { entityId } from '@dungeon/contracts';
import { QUEST_TEMPLATES } from '@dungeon/content';
import { completeFloorDepthQuests, createQuestFromTemplate } from '@dungeon/core';
import { createTestGameState } from '@dungeon/core/testing';

describe('completeFloorDepthQuests — live template round-trips', () => {
  it('completes every live floor-depth quest template when its target depth is reached', () => {
    const depthQuestTemplates = QUEST_TEMPLATES.filter(
      (template) => template.objective.type === 'reach_floor',
    );

    for (const template of depthQuestTemplates) {
      const quest = createQuestFromTemplate(template, entityId('npc_informant'), 10);
      const state = {
        ...createTestGameState({
          player: { gold: 75, floor: template.objective.targetCount || 0 },
        }),
        activeQuests: [quest],
      };

      const result = completeFloorDepthQuests(state, template.objective.targetCount || 0);

      expect(result.state.activeQuests[0]!.status).toBe('ready_to_turn_in');
      expect(result.state.player.gold).toBe(state.player.gold);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        type: 'QUEST_READY',
        questId: quest.id,
      });
    }
  });

  it('leaves floor-depth quests active when a different depth is reached', () => {
    const template = QUEST_TEMPLATES.find(
      (candidate) => candidate.objective.type === 'reach_floor',
    )!;
    const quest = createQuestFromTemplate(template, entityId('npc_informant'), 10);
    const state = {
      ...createTestGameState(),
      activeQuests: [quest],
    };

    const targetDepth = template.objective.targetCount || 0;
    const result = completeFloorDepthQuests(state, targetDepth + 1);

    expect(result.state.activeQuests[0]!.status).toBe('active');
    expect(result.state.player.gold).toBe(state.player.gold);
    expect(result.events).toEqual([]);
  });
});
