import type { NpcDialogueContext, RumorContext, RunSummaryContext } from './ai-service.js';

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




