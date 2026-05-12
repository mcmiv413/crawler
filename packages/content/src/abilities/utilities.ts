import { RING_SPELL_BY_ID } from '../ring-spells/index.js';
import { RING_SCHOOLS, getSchoolForRing, getStudySpell } from '../ring-schools/utilities.js';

// Legacy constants — maintained for backward compatibility
export const FIRE_RING_EMBER_ID = 'ember';
export const FIRE_RING_HEAT_SURGE_ID = 'heat_surge';
export const FIRE_RING_CINDER_WAKE_ID = 'cinder_wake';
export const FIRE_RING_ID = 'fire_ring';

// New: All ring spell ability IDs available in the system
export const RING_SPELL_ABILITY_IDS: readonly string[] = [...RING_SPELL_BY_ID.keys()];

// Legacy: Map of ring ID to spell IDs (now derived from indexes)
export const RING_SPELLS_CONFIG: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  RING_SCHOOLS.map(s => [s.ringId, [...RING_SPELL_BY_ID.values()]
    .filter(sp => sp.schools.includes(s.id))
    .map(sp => sp.id)])
);

// Legacy: Renamed from RING_GRANTED_ABILITY_IDS
export const RING_GRANTED_ABILITY_IDS = RING_SPELL_ABILITY_IDS;

// Helper functions
export function getSpellsForRing(ringId: string): readonly string[] {
  return RING_SPELLS_CONFIG[ringId] ?? [];
}



// New helpers from ring-schools utilities
export { getStudySpell, getSchoolForRing };
