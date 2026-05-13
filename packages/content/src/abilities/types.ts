import type { WeaponType } from '@dungeon/contracts';

export interface AbilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cooldown: number;
  readonly requiresTarget: boolean;
  readonly requiresDirection?: boolean;
  readonly unlockLevel: number;
  readonly manaCost?: number;
  readonly requiresWeaponTypes?: readonly WeaponType[];
  readonly range?: number;
  readonly minRange?: number;
  readonly animation: { readonly id: string };
}
