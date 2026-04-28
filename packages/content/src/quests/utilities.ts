import type { Quest, QuestObjective, QuestReward } from '@dungeon/contracts';
import type { QuestTemplate } from './types.js';
import { QUEST_TEMPLATES } from './index.js';

export function selectRandomQuestTemplate(rng: () => number): QuestTemplate {
  const idx = Math.floor(rng() * QUEST_TEMPLATES.length);
  return QUEST_TEMPLATES[Math.min(idx, QUEST_TEMPLATES.length - 1)]!;
}

function createObjectiveFromTemplate(template: QuestTemplate): QuestObjective {
  if (template.targetItemId) {
    return { type: 'collect_item', targetId: template.targetItemId, progress: 0 };
  }
  if (template.targetEnemyTemplateId) {
    return { type: 'defeat_enemy', targetId: template.targetEnemyTemplateId, targetCount: 1, progress: 0 };
  }
  if (template.targetFloorDepth !== undefined) {
    return { type: 'reach_floor', targetCount: template.targetFloorDepth, progress: 0 };
  }
  // Fallback objective
  return { type: 'collect_item', progress: 0 };
}

function createRewardFromTemplate(template: QuestTemplate): QuestReward {
  return { type: 'gold', amount: template.rewardGold };
}

export function createQuestFromTemplate(
  template: QuestTemplate,
  giverNpcId: string,
  turnNumber: number,
): Quest {
  const objective = createObjectiveFromTemplate(template);
  const reward = createRewardFromTemplate(template);

  return {
    id: `quest_${template.id}_${giverNpcId}_${turnNumber}`,
    title: template.title,
    description: template.description,
    status: 'active',
    objective,
    reward,
    giverNpcId,
    // Legacy fields for backward compatibility
    targetItemId: template.targetItemId,
    targetEnemyTemplateId: template.targetEnemyTemplateId,
    targetFloorDepth: template.targetFloorDepth,
    rewardGold: template.rewardGold,
  };
}
