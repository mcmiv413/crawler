import type { ConsumableTemplate } from '@dungeon/contracts';

export const antidote: ConsumableTemplate = {
  itemId: 'antidote',
  name: 'Antidote',
  description: 'Cures poison.',
  itemClass: 'consumable',
  rarity: 'common',
  value: 8,
  stackable: true,
  maxStack: 5,
  spriteName: 'dark green potion',
  consumable: { effect: 'cure', magnitude: 0, targetStatus: 'poison' },
};
