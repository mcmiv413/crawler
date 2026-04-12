import type { WeaponType } from '@dungeon/contracts';
import type { AbilityDefinition } from './types.js';

/**
 * Derive mastery ability map from ability definitions.
 * Maps weapon type + mastery index → ability ID.
 */
export function deriveMasteryAbilities(
  definitions: readonly AbilityDefinition[],
): Record<WeaponType, Record<1 | 2, string>> {
  const map: Record<WeaponType, Record<1 | 2, string>> = {
    blade: { 1: '', 2: '' },
    bludgeon: { 1: '', 2: '' },
    axe: { 1: '', 2: '' },
    ranged: { 1: '', 2: '' },
  };

  for (const def of definitions) {
    for (const unlock of def.unlocks) {
      if (unlock.kind === 'mastery') {
        map[unlock.weaponType][unlock.masteryIndex] = def.id;
      }
    }
  }

  return map;
}
