import type { TownState, NpcState, RunMetrics } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';

export interface NpcDialogueContext {
  readonly npc: NpcState;
  readonly townState: TownState;
  readonly recentEvents: readonly DomainEvent[];
  readonly playerName: string;
  readonly playerLevel: number;
}

export interface RumorContext {
  readonly townState: TownState;
  readonly deepestFloor: number;
  readonly totalRuns: number;
  readonly recentEvents: readonly DomainEvent[];
}

export interface RunSummaryContext {
  readonly runMetrics: RunMetrics;
  readonly recentEvents: readonly DomainEvent[];
  readonly playerName: string;
  readonly floor: number;
}

export interface AiService {
  generateDialogue(context: NpcDialogueContext): Promise<string>;
  generateRumor(context: RumorContext): Promise<string>;
  generateRunSummary(context: RunSummaryContext): Promise<string>;
}
