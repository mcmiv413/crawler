import type { NpcDialogueContext, RumorContext, RunSummaryContext, NemesisNameContext, NemesisLootContext } from './ai-service.js';

export function buildNpcDialoguePrompt(context: NpcDialogueContext): string {
  const { npc, townState, playerName, playerLevel } = context;

  return `You are ${npc.name}, a ${npc.role} in a small town near a dangerous dungeon. You are speaking to ${playerName}, a level ${playerLevel} adventurer.

Your disposition toward the adventurer is ${npc.disposition > 0 ? 'friendly' : npc.disposition < 0 ? 'hostile' : 'neutral'} (${npc.disposition}/100).

Town state: prosperity ${townState.prosperity}/100, fear ${townState.fear}/100, corruption ${townState.corruption}/100.

Respond in character with 1-2 sentences. Be brief and atmospheric. Do not use modern language.`;
}

export function buildRumorPrompt(context: RumorContext): string {
  const { townState, deepestFloor, totalRuns } = context;

  return `Generate a short dungeon rumor (1-2 sentences) for a fantasy roguelike game.

Context: The town has prosperity ${townState.prosperity}/100, fear ${townState.fear}/100. Adventurers have reached floor ${deepestFloor} across ${totalRuns} expeditions.

The rumor should hint at dangers, treasures, or secrets in the dungeon. Be atmospheric and vague. Do not use modern language.`;
}

export function buildRunSummaryPrompt(context: RunSummaryContext): string {
  const { runMetrics, playerName, floor } = context;

  return `Summarize this dungeon run in 2-3 sentences for a fantasy roguelike game.

${playerName} ${runMetrics.causeOfEnd === 'death' ? 'fell' : 'retreated'} on floor ${floor}.
Stats: ${runMetrics.enemiesKilled} enemies slain, ${runMetrics.damageDealt} damage dealt, ${runMetrics.damageTaken} damage taken, ${runMetrics.turnsElapsed} turns elapsed, ${runMetrics.itemsUsed} items used, ${runMetrics.goldEarned} gold earned.

Write a brief narrative recap. Be dramatic but concise. Do not use modern language.`;
}

export function buildNemesisNamePrompt(context: NemesisNameContext): string {
  const { enemyTemplateName, tier, floor, biome } = context;

  return `Generate a menacing name and epithet for a nemesis enemy in a dungeon crawler.

The enemy is a tier ${tier} ${enemyTemplateName} that rose to power on floor ${floor} of a ${biome} dungeon.

Respond with ONLY a JSON object in this exact format, nothing else:
{"name": "Vorreth", "title": "the Unbroken"}

The name should be a single menacing proper noun (1-2 words). The title should be a dark epithet starting with 'the' or a short phrase.`;
}

export function buildNemesisLootPrompt(context: NemesisLootContext): string {
  const { nemesisName, nemesisTitle, tier, floor, traits, weaponType, rank } = context;

  const weaponContext = weaponType !== null ? `It was slain using a ${weaponType}. The trophy should reflect this weapon's essence.` : 'Create a generic legendary artifact.';
  const rankContext = rank === 3 ? 'This is a rank 3 (maximum) nemesis - make the loot truly legendary.' : rank === 2 ? 'This is a rank 2 nemesis - make the loot impressive.' : 'This is a rank 1 nemesis - make the loot notable.';

  return `Generate a unique, lore-driven treasure item dropped by a defeated nemesis.

Nemesis: ${nemesisName} ${nemesisTitle} (Tier ${tier}, Rank ${rank}, Floor ${floor})
Traits: ${traits.join(', ') || 'none'}

${weaponContext}
${rankContext}

Respond with ONLY a JSON object in this exact format, nothing else:
{"name": "Frostbane, Sorrow of the North", "description": "A sword of ice and ancient sorrow, forged by ${nemesisName} in the depths. Its blade never warms."}

The name should be evocative and tied to the nemesis. The description (1-2 sentences) should be lore-rich and atmospheric.`;
}
