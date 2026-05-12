import type { EntityId, Quest } from '@dungeon/contracts';
import { QUEST_TEMPLATES, type QuestTemplate } from '@dungeon/content';

export function selectRandomQuestTemplate(rng: () => number): QuestTemplate {
  const idx = Math.floor(rng() * QUEST_TEMPLATES.length);
  return QUEST_TEMPLATES[Math.min(idx, QUEST_TEMPLATES.length - 1)]!;
}

export function createQuestFromTemplate(
  template: QuestTemplate,
  giverNpcId: EntityId,
  turnNumber: number,
): Quest {
  return {
    id: `quest_${template.id}_${giverNpcId}_${turnNumber}`,
    title: template.title,
    description: template.description,
    objectiveText: template.objectiveText,
    status: 'active',
    objective: template.objective,
    reward: template.reward,
    giverNpcId,
  };
}
