import type { WeaponTemplate } from '@dungeon/contracts';

export const commonDagger: WeaponTemplate = {
  itemId: 'common_dagger',
  name: 'Common Dagger',
  description: 'A simple dagger. Perfect for learning basic combat.',
  itemClass: 'weapon',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  spriteName: 'elven dagger',
  weapon: { damage: 5, damageType: 'physical', accuracy: 4, speed: 10, slot: 'weapon', weaponRange: 1, weaponType: 'dagger' },
};
