import { animationRefs } from '../../animation-refs/index.js';
import type { AnimatedConsumableDefinition } from '../types.js';

export const manaPotion: AnimatedConsumableDefinition = {
  itemId: 'mana_potion',
  spriteName: 'potion 1',
  name: 'Mana Potion',
  description: 'Restores 15 mana when consumed.',
  itemClass: 'consumable',
  rarity: 'common',
  value: 50,
  stackable: true,
  maxStack: 99,
  consumable: {
    effect: 'mana',
    magnitude: 15,
  },
  animation: { id: animationRefs.self.staminaSurge.id },
};
