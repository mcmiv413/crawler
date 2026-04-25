import type { WeaponTemplate } from '@dungeon/contracts';

export const handAxe: WeaponTemplate = {
  itemId: 'hand_axe',
  spriteName: 'axe',
  name: 'Hand Axe',
  description: 'A light axe balanced for throwing or swinging.',
  itemClass: 'weapon',
  rarity: 'common',
  value: 16,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 8, damageType: 'physical', accuracy: 0, speed: -2, slot: 'weapon', weaponRange: 1, weaponType: 'axe' },
};
