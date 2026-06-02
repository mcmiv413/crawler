import type { DamageType } from '@dungeon/contracts';
import {
  STATUS_DEFINITIONS,
  type RingSpellDefinition,
  type StatusEffect as RingSpellStatusEffect,
} from '@dungeon/content';
import type {
  AbilityRequirement,
  AttackEffect,
  StatusEffect as RuntimeStatusEffect,
} from '../types.js';

export function buildRingSpellManaRequirements(
  spell: RingSpellDefinition,
): AbilityRequirement[] {
  if (spell.manaCost === undefined) {
    return [];
  }

  return [{ kind: 'has_mana', amount: spell.manaCost }];
}

export function buildRingSpellAttackEffect(
  spell: RingSpellDefinition,
): AttackEffect {
  return {
    kind: 'attack',
    damageMultiplier: 0,
    flatBonus: spell.baseDamage ?? 0,
    damageType: getRingSpellDamageType(spell),
    spell: true,
    forceHit: true,
    trackMastery: false,
  };
}

export function buildRingSpellStatusEffect(
  effect: RingSpellStatusEffect,
  options: {
    readonly target?: 'enemy' | 'player';
    readonly trigger: 'always' | 'on_hit';
  },
): RuntimeStatusEffect {
  return {
    kind: 'status',
    target: options.target,
    statusId: effect.statusId,
    statusName: STATUS_DEFINITIONS.get(effect.statusId)?.name ?? effect.statusId,
    trigger: options.trigger,
    duration: effect.duration,
    magnitude: effect.magnitude,
  };
}

function getRingSpellDamageType(spell: RingSpellDefinition): DamageType {
  if (spell.schools.includes('fire') && !spell.schools.includes('lightning')) {
    return 'fire';
  }
  if (spell.schools.includes('lightning')) {
    return 'shock';
  }
  return 'arcane';
}
