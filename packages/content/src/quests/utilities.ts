import type { Quest } from '@dungeon/contracts';
import type { QuestTemplate } from './types.js';
import { QUEST_TEMPLATES } from './index.js';

export function selectRandomQuestTemplate(rng: () => number): QuestTemplate {
  const idx = Math.floor(rng() * QUEST_TEMPLATES.length);
  return QUEST_TEMPLATES[Math.min(idx, QUEST_TEMPLATES.length - 1)]!;
}

export function createQuestFromTemplate(
  template: QuestTemplate,
  giverNpcId: string,
  turnNumber: number,
): Quest {
  return {
    id: `quest_${template.id}_${giverNpcId}_${turnNumber}`,
    title: template.title,
    description: template.description,
    status: 'active',
    targetItemId: template.targetItemId,
    targetEnemyTemplateId: template.targetEnemyTemplateId,
    targetFloorDepth: template.targetFloorDepth,
    giverNpcId,
    rewardGold: template.rewardGold,
  };
}
