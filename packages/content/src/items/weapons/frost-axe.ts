import type { WeaponTemplate } from '@dungeon/contracts';

export const frostAxe: WeaponTemplate = {
  itemId: 'frost_axe',
  spriteName: 'battle axe',
  name: 'Frost Axe',
  description: 'An axe wreathed in cold.',
  itemClass: 'weapon',
  rarity: 'rare',
  value: 80,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 10, damageType: 'frost', accuracy: 0, speed: 0, slot: 'weapon', weaponRange: 1, weaponType: 'axe', onHitStatus: 'slow', onHitChance: 30 },
};
