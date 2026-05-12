import { MASTERY_THRESHOLDS } from '@dungeon/content';
import type { WeaponMastery } from '@dungeon/contracts';
import type { MasteryTierInfo } from '../game-view.js';

export function calculateMasteryTier(uses: number): number {
  if (uses < MASTERY_THRESHOLDS[1]) return 0;
  if (uses < MASTERY_THRESHOLDS[2]) return 1;
  return 2;
}

function buildMasteryProgressLabel(uses: number, tier: number): string {
  if (tier === 0) return `${uses}/${MASTERY_THRESHOLDS[1]}`;
  if (tier === 1) return `${uses}/${MASTERY_THRESHOLDS[2]}`;
  return `${uses}/${MASTERY_THRESHOLDS[2]}`;
}

export function buildMasteryTierInfo(weaponMastery: WeaponMastery): MasteryTierInfo[] {
  const weaponTypes = ['blade', 'bludgeon', 'axe', 'ranged'] as const;

  return weaponTypes.map(type => {
    const uses = weaponMastery[type];
    const tier = calculateMasteryTier(uses);
    return {
      weaponType: type,
      uses,
      tier,
      listProgressLabel: buildMasteryProgressLabel(uses, tier),
      nextTier: tier >= 2
        ? null
        : {
            tier: tier + 1,
            progress: tier === 0 ? uses : uses - MASTERY_THRESHOLDS[1],
            requiredUses: tier === 0
              ? MASTERY_THRESHOLDS[1]
              : MASTERY_THRESHOLDS[2] - MASTERY_THRESHOLDS[1],
            totalRequiredUses: tier === 0 ? MASTERY_THRESHOLDS[1] : MASTERY_THRESHOLDS[2],
          },
    };
  });
}
