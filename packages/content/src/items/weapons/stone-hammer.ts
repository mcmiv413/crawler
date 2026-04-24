import type { WeaponTemplate } from '@dungeon/contracts';

export const stoneHammer: WeaponTemplate = {
  itemId: 'stone_hammer',
  spriteName: 'war hammer',
  name: 'Stone Hammer',
  description: 'A brutal hammer that weakens foes on impact.',
  itemClass: 'weapon',
  rarity: 'uncommon',
  value: 40,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 7, damageType: 'physical', accuracy: -5, speed: -5, slot: 'weapon', weaponRange: 1, weaponType: 'bludgeon', onHitStatus: 'weaken', onHitChance: 20 },
};
