import { bladeRiposte } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const BLADE_RIPOSTE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(bladeRiposte, {
  tags: ['melee', 'attack'],
  unlocks: [],
  requirements: [
    { kind: 'weapon_type', weaponType: 'blade' },
    { kind: 'has_target' },
    { kind: 'target_in_melee_range' },
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
});
