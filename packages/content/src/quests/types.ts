export interface QuestTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly objective: {
    readonly type: 'collect_item' | 'defeat_enemy' | 'reach_floor';
    readonly targetId?: string;
    readonly targetCount?: number;
    readonly progress: number;
  };
  readonly reward: {
    readonly type: 'gold';
    readonly amount: number;
  };
}
