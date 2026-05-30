import { RING_SCHOOL_BY_ID } from './index.js';
import { RING_SPELL_BY_ID } from '../ring-spells/index.js';
import type { RingItemId, RingSchool, RingSchoolDefinition } from './types.js';
import type { RingSpellDefinition } from '../ring-spells/types.js';

export function getRingSchools(): readonly RingSchoolDefinition[] {
  return [...RING_SCHOOL_BY_ID.values()];
}

export function getSchoolSpells(school: RingSchool): readonly RingSpellDefinition[] {
  return [...RING_SPELL_BY_ID.values()].filter(s => s.schools.includes(school));
}

export function getSchoolForRing(ringId: RingItemId): RingSchool | undefined {
  return getRingSchools().find(s => s.ringId === ringId)?.id;
}

export function getStudySpell(spellId: string): RingSpellDefinition | undefined {
  return RING_SPELL_BY_ID.get(spellId);
}
