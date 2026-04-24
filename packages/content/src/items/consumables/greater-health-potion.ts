import type { ConsumableTemplate } from '@dungeon/contracts';

export const greaterHealthPotion: ConsumableTemplate = {
  itemId: 'greater_health_potion',
  name: 'Greater Health Potion',
  description: 'Restores 60 health.',
  itemClass: 'consumable',
  rarity: 'uncommon',
  value: 25,
  stackable: true,
  maxStack: 3,
  spriteName: 'ruby potion',
  consumable: { effect: 'heal', magnitude: 60 },
};
