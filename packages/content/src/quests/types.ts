export interface QuestTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly targetItemId?: string;
  readonly targetEnemyTemplateId?: string;
  readonly targetFloorDepth?: number;
  readonly rewardGold: number;
}
