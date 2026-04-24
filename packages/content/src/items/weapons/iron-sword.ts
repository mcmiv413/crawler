import type { WeaponTemplate } from '@dungeon/contracts';

export const ironSword: WeaponTemplate = {
  itemId: 'iron_sword',
  spriteName: 'elven short sword',
  name: 'Iron Sword',
  description: 'A reliable blade forged from quality iron.',
  itemClass: 'weapon',
  rarity: 'rare',
  value: 75,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 10, damageType: 'physical', accuracy: 5, speed: 5, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
};
