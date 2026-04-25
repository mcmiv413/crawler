import type { WeaponTemplate } from '@dungeon/contracts';

export const venomBlade: WeaponTemplate = {
  itemId: 'venom_blade',
  spriteName: 'dagger',
  name: 'Venom Blade',
  description: 'A wicked blade coated in poison.',
  itemClass: 'weapon',
  rarity: 'uncommon',
  value: 50,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 9, damageType: 'physical', accuracy: 3, speed: 5, slot: 'weapon', weaponRange: 1, weaponType: 'blade', onHitStatus: 'poison', onHitChance: 25 },
};
