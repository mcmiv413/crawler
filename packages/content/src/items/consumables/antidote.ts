import { animationRefs } from '../../animation-refs/index.js';
import type { AnimatedConsumableDefinition } from '../types.js';

export const antidote: AnimatedConsumableDefinition = {
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
  animation: { id: animationRefs.self.cureSparkle.id },
};
