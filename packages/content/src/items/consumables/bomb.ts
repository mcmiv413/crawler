import type { ConsumableTemplate } from '@dungeon/contracts';

export const bomb: ConsumableTemplate = {
  itemId: 'bomb',
  name: 'Bomb',
  description: 'Deals 25 fire damage to an adjacent enemy.',
  itemClass: 'consumable',
  rarity: 'uncommon',
  value: 15,
  stackable: true,
  maxStack: 3,
  spriteName: 'fire bomb',
  consumable: { effect: 'damage', magnitude: 25 },
};
