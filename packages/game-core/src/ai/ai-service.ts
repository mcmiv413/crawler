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

export interface NemesisNameContext {
  readonly enemyTemplateName: string;
  readonly tier: number;
  readonly floor: number;
  readonly biome: string;
}

export interface NemesisLootContext {
  readonly nemesisName: string;
  readonly nemesisTitle: string;
  readonly tier: number;
  readonly floor: number;
  readonly traits: readonly string[];
  readonly weaponType: string | null;
  readonly rank: number;
}

export interface AiService {
  generateDialogue(context: NpcDialogueContext): Promise<string>;
  generateRumor(context: RumorContext): Promise<string>;
  generateRunSummary(context: RunSummaryContext): Promise<string>;
  generateNemesisName(context: NemesisNameContext): Promise<{ name: string; title: string }>;
  generateNemesisLoot(context: NemesisLootContext): Promise<{ name: string; description: string }>;
}
