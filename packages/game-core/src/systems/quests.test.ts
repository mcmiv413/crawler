import { createQuestFromTemplate, QUEST_TEMPLATES } from '@dungeon/content';
import { completeFloorDepthQuests } from './quests.js';
import { createTestGameState } from '../test-utils.js';

describe('completeFloorDepthQuests', () => {
  it('completes every live floor-depth quest template when its target depth is reached', () => {
    const depthQuestTemplates = QUEST_TEMPLATES.filter(
      (template) => template.objective.type === 'reach_floor',
    );

    for (const template of depthQuestTemplates) {
      const quest = createQuestFromTemplate(template, 'npc_informant', 10);
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
    const quest = createQuestFromTemplate(template, 'npc_informant', 10);
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
