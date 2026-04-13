import { MASTERY_THRESHOLDS } from '@dungeon/content';
import type { WeaponMastery } from '@dungeon/contracts';
import type { MasteryTierInfo } from '../game-view.js';

export function calculateMasteryTier(uses: number): number {
  if (uses < MASTERY_THRESHOLDS[1]) return 0;
  if (uses < MASTERY_THRESHOLDS[2]) return 1;
  return 2;
}

export function buildMasteryTierInfo(weaponMastery: WeaponMastery): MasteryTierInfo[] {
  const weaponTypes = ['blade', 'bludgeon', 'axe', 'ranged'] as const;

  return weaponTypes.map(type => ({
    weaponType: type,
    uses: weaponMastery[type],
    tier: calculateMasteryTier(weaponMastery[type]),
  }));
}
