export interface FactionLeaderDefinition {
  readonly templateId: string;
  readonly names: readonly string[];
  readonly titles: readonly string[];
}

export interface FactionDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly lore: string;
  readonly initialPower: number;
  readonly initialDisposition: number;
  readonly leader: FactionLeaderDefinition;
}
