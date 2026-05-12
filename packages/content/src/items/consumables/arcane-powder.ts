import { animationRefs } from '../../animation-refs/index.js';
import type { AnimatedConsumableDefinition } from '../types.js';

export const arcanePowder: AnimatedConsumableDefinition = {
  itemId: 'arcane_powder',
  spriteName: 'potion 2',
  name: 'Arcane Powder',
  description: 'Grants Arcane Charge stack on use.',
  itemClass: 'consumable',
  rarity: 'uncommon',
  value: 75,
  stackable: true,
  maxStack: 99,
  consumable: {
    effect: 'buff',
    magnitude: 1,
    targetStatus: 'arcane_charge',
    duration: 5,
  },
  animation: { id: animationRefs.self.heatSurgeAura.id },
};
