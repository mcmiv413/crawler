import type { WeaponTemplate } from '@dungeon/contracts';

export const ironMace: WeaponTemplate = {
  itemId: 'iron_mace',
  spriteName: 'mace',
  name: 'Iron Mace',
  description: 'A heavy mace that hits hard but slow.',
  itemClass: 'weapon',
  rarity: 'common',
  value: 20,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 7, damageType: 'physical', accuracy: -2, speed: -4, slot: 'weapon', weaponRange: 1, weaponType: 'bludgeon' },
};
