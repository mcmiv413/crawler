export interface FactionDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly lore: string;
  readonly initialPower: number;
  readonly initialDisposition: number;
}
