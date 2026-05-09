import { animationRefs } from '../../animation-refs/index.js';
import type { AnimatedConsumableDefinition } from '../types.js';

export const healthPotion: AnimatedConsumableDefinition = {
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
  animation: { id: animationRefs.self.healingPulse.id },
};
