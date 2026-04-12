import type { AbilityDefinition } from '../types.js';

export const BLADE_RIPOSTE_DEFINITION: AbilityDefinition = {
  id: 'blade_riposte',
  name: 'Blade Riposte',
  description: 'A guaranteed critical strike with 1.5× damage and +50 accuracy bonus.',
  tags: ['melee', 'attack'],
  cooldown: 3,
  unlocks: [],
  requirements: [
    { kind: 'weapon_type', weaponType: 'blade' },
    { kind: 'has_target' },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 1.5,
      accuracyBonus: 50,
      forceHit: true,
      trackMastery: true,
    },
  ],
};
