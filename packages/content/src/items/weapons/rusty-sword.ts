import type { WeaponTemplate } from '@dungeon/contracts';

export const rustySword: WeaponTemplate = {
  itemId: 'rusty_sword',
  name: 'Rusty Sword',
  description: 'A worn but functional blade.',
  itemClass: 'weapon',
  rarity: 'common',
  value: 15,
  stackable: false,
  maxStack: 1,
  spriteName: 'dwarvish short sword',
  weapon: { damage: 7, damageType: 'physical', accuracy: 2, speed: 0, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
};
