import { animationRefs } from '../../animation-refs/index.js';
import type { AnimatedConsumableDefinition } from '../types.js';

export const greaterHealthPotion: AnimatedConsumableDefinition = {
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
  animation: { id: animationRefs.self.healingPulse.id },
};
