import { animationRefs } from '../../animation-refs/index.js';
import type { AnimatedConsumableDefinition } from '../types.js';

export const bomb: AnimatedConsumableDefinition = {
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
  animation: { id: animationRefs.aoe.bombBlast.id },
};
