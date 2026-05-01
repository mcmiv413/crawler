import type { AiService, NpcDialogueContext, RumorContext, RunSummaryContext } from '@dungeon/core/ai/ai-service';
import { NPC_GREETINGS, FALLBACK_RUMORS, FACTION_RUMORS } from '@dungeon/content';

export class FallbackAiService implements AiService {
  async generateDialogue(context: NpcDialogueContext): Promise<string> {
    const greetings = NPC_GREETINGS[context.npc.role] ?? NPC_GREETINGS['elder']!;
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }

  async generateRumor(context: RumorContext): Promise<string> {
    // Build pool: blend faction rumors based on world state
    let pool = [...FALLBACK_RUMORS];

    // Add faction-specific rumors from context if any strong factions provided
    for (const [factionId, factionPool] of Object.entries(FACTION_RUMORS)) {
      // Use total runs as a proxy for faction knowledge (simplified heuristic)
      if (context.totalRuns > 0 && Math.random() < 0.4) {
        pool = [...pool, ...factionPool];
      }
      void factionId;
    }

    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  async generateRunSummary(context: RunSummaryContext): Promise<string> {
    const { runMetrics, playerName, floor } = context;
    if (runMetrics.causeOfEnd === 'death') {
      return `${playerName} fell on floor ${floor} after slaying ${runMetrics.enemiesKilled} enemies. The dungeon claims another soul.`;
    }
    return `${playerName} retreated from floor ${floor} having slain ${runMetrics.enemiesKilled} enemies and earned ${runMetrics.goldEarned} gold.`;
  }
}
