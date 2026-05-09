import type { StatusId } from '@dungeon/contracts';

export interface StatusDefinition {
  readonly id: StatusId;
  readonly name: string;
  readonly description: string;
  readonly stackable: boolean;
  readonly beneficial: boolean;
  readonly tickEffect: 'damage' | 'heal' | 'none';
  readonly tickMagnitudeKey: string;
  readonly modifiesStat: string | null;
  readonly statMultiplierKey: string | null;
  readonly overlay?: { readonly id: string };
}
