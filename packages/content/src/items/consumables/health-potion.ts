import type { ConsumableTemplate } from '@dungeon/contracts';

export const healthPotion: ConsumableTemplate = {
  itemId: 'health_potion',
  name: 'Health Potion',
  description: 'Restores 30 health.',
  itemClass: 'consumable',
  rarity: 'common',
  value: 10,
  stackable: true,
  maxStack: 5,
  spriteName: 'purple red potion',
  consumable: { effect: 'heal', magnitude: 30 },
};
