import { RING_SCHOOL_BY_ID } from './index.js';
import { RING_SPELL_BY_ID } from '../ring-spells/index.js';
import type { RingSchool, RingSchoolDefinition } from './types.js';
import type { RingSpellDefinition } from '../ring-spells/types.js';

export const RING_SCHOOLS: readonly RingSchoolDefinition[] = [...RING_SCHOOL_BY_ID.values()];

export function getSchoolSpells(school: RingSchool): readonly RingSpellDefinition[] {
  return [...RING_SPELL_BY_ID.values()].filter(s => s.schools.includes(school));
}

export function getSchoolForRing(ringId: string): RingSchool | undefined {
  return RING_SCHOOLS.find(s => s.ringId === ringId)?.id;
}

export function getStudySpell(spellId: string): RingSpellDefinition | undefined {
  return RING_SPELL_BY_ID.get(spellId);
}
