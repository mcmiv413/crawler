import type { WeaponTemplate } from '@dungeon/contracts';

export const warBow: WeaponTemplate = {
  itemId: 'war_bow',
  spriteName: 'crossbow',
  name: 'War Bow',
  description: 'A powerful longbow with exceptional range.',
  itemClass: 'weapon',
  rarity: 'uncommon',
  value: 55,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 9, damageType: 'physical', accuracy: 2, speed: 0, slot: 'weapon', weaponRange: 6, minRange: 2, weaponType: 'ranged' },
};
