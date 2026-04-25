import { createQuestFromTemplate, QUEST_TEMPLATES } from '@dungeon/content';
import { completeFloorDepthQuests } from './quests.js';
import { createTestGameState } from '../test-utils.js';

describe('completeFloorDepthQuests', () => {
  it('completes every live floor-depth quest template when its target depth is reached', () => {
    const depthQuestTemplates = QUEST_TEMPLATES.filter(
      (template): template is (typeof QUEST_TEMPLATES)[number] & { targetFloorDepth: number } =>
        template.targetFloorDepth !== undefined,
    );

    for (const template of depthQuestTemplates) {
      const quest = createQuestFromTemplate(template, 'npc_informant', 10);
      const state = {
        ...createTestGameState({
          player: { gold: 75 },
        }),
        activeQuests: [quest],
      };

      const result = completeFloorDepthQuests(state, template.targetFloorDepth);

      expect(result.state.activeQuests[0]!.status).toBe('complete');
      expect(result.state.player.gold).toBe(state.player.gold + template.rewardGold);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        type: 'QUEST_COMPLETED',
        questId: quest.id,
        rewardGold: template.rewardGold,
      });
    }
  });

  it('leaves floor-depth quests active when a different depth is reached', () => {
    const template = QUEST_TEMPLATES.find(
      (candidate): candidate is (typeof QUEST_TEMPLATES)[number] & { targetFloorDepth: number } =>
        candidate.targetFloorDepth !== undefined,
    )!;
    const quest = createQuestFromTemplate(template, 'npc_informant', 10);
    const state = {
      ...createTestGameState(),
      activeQuests: [quest],
    };

    const result = completeFloorDepthQuests(state, template.targetFloorDepth + 1);

    expect(result.state.activeQuests[0]!.status).toBe('active');
    expect(result.state.player.gold).toBe(state.player.gold);
    expect(result.events).toEqual([]);
  });
});
