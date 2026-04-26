import type { WeaponTemplate } from '@dungeon/contracts';

export const shortBow: WeaponTemplate = {
  itemId: 'short_bow',
  spriteName: 'composite bow',
  name: 'Short Bow',
  description: 'A simple ranged weapon. Can attack from up to 5 tiles away.',
  itemClass: 'weapon',
  rarity: 'common',
  value: 18,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 6, damageType: 'physical', accuracy: 14, speed: 5, slot: 'weapon', weaponRange: 5, minRange: 2, weaponType: 'ranged' },
};
