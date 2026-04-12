import type { Quest } from '@dungeon/contracts';

/**
 * Quest templates that informant NPCs can offer.
 * Each template provides a base quest that can be customized per NPC/context.
 *
 * Quest selection uses a random pool to ensure non-deterministic quest variety.
 */

export interface QuestTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly targetItemId?: string;
  readonly targetEnemyTemplateId?: string;
  readonly targetFloorDepth?: number;
  readonly rewardGold: number;
}

export const QUEST_TEMPLATES: readonly QuestTemplate[] = [
  {
    id: 'retrieve_rare_weapon',
    title: 'Retrieve the Lost Artifact',
    description: 'An ancient artifact was lost deep in the dungeon. Retrieve any rare weapon and bring it back.',
    targetItemId: 'frost_axe',
    rewardGold: 75,
  },
  {
    id: 'hunt_dangerous_enemy',
    title: 'Eliminate the Shadowborn',
    description: 'A dangerous creature has been terrorizing our people. Defeat it and return with proof of your victory.',
    targetEnemyTemplateId: 'shadow_lurker',
    rewardGold: 100,
  },
  {
    id: 'find_enchanted_armor',
    title: 'Seek the Warden\'s Cloak',
    description: 'Legend speaks of enchanted armor hidden in the deepest chambers. Find it and bring it back.',
    targetItemId: 'leather_armor',
    rewardGold: 85,
  },
  {
    id: 'gather_rare_materials',
    title: 'Collect Luminous Crystals',
    description: 'We need rare materials to craft new defenses. Retrieve luminous crystals from the depths.',
    targetItemId: 'mana_crystal',
    rewardGold: 60,
  },
  {
    id: 'rescue_expedition',
    title: 'Find the Lost Expedition',
    description: 'A research expedition disappeared months ago. Find any survivors or recover their research notes.',
    targetFloorDepth: 7,
    rewardGold: 120,
  },
];

/**
 * Select a random quest template from the pool.
 * Returns a fresh template each time to allow non-deterministic quest generation.
 */
export function selectRandomQuestTemplate(rng: () => number): QuestTemplate {
  const index = Math.floor(rng() * QUEST_TEMPLATES.length);
  return QUEST_TEMPLATES[index]!;
}

/**
 * Create a quest from a template, customized for a specific NPC and context.
 */
export function createQuestFromTemplate(
  template: QuestTemplate,
  npcId: string,
  turnNumber: number,
): Quest {
  return {
    id: `quest_${npcId}_${template.id}_${turnNumber}`,
    title: template.title,
    description: template.description,
    status: 'active',
    targetItemId: template.targetItemId,
    targetEnemyTemplateId: template.targetEnemyTemplateId,
    targetFloorDepth: template.targetFloorDepth,
    giverNpcId: npcId,
    rewardGold: template.rewardGold,
  };
}
