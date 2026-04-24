import type { WeaponTemplate } from '@dungeon/contracts';

export const flameDagger: WeaponTemplate = {
  itemId: 'flame_dagger',
  spriteName: 'elven dagger',
  name: 'Flame Dagger',
  description: 'A dagger that burns on contact.',
  itemClass: 'weapon',
  rarity: 'uncommon',
  value: 45,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 5, damageType: 'fire', accuracy: 10, speed: 10, slot: 'weapon', weaponRange: 1, weaponType: 'blade', onHitStatus: 'burn', onHitChance: 20 },
};
