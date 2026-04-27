import type { ConsumableTemplate } from '@dungeon/contracts';

export const strengthElixir: ConsumableTemplate = {
  itemId: 'strength_elixir',
  name: 'Strength Elixir',
  description: 'Grants +5 attack for approximately 10 turns.',
  itemClass: 'consumable',
  rarity: 'uncommon',
  value: 20,
  stackable: true,
  maxStack: 3,
  spriteName: 'golden potion',
  consumable: { effect: 'buff', magnitude: 5, duration: 10 },
};
