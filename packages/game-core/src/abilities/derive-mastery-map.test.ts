/**
 * Test layer: unit
 * Behavior: Derive Mastery map covers deriveMasteryAbilities; derives mastery ability map from definitions; all mastery-unlocked abilities are in the map.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/abilities/derive-mastery-map.test.ts
 */
import { describe, it, expect } from 'vitest';
import { deriveMasteryAbilities } from './derive-mastery-map.js';
import { ALL_ABILITY_DEFINITIONS } from './definitions/index.js';
import { WEAPON_TYPES } from '@dungeon/contracts';

describe('deriveMasteryAbilities', () => {
  it('derives mastery ability map from definitions', () => {
    const masteryMap = deriveMasteryAbilities(ALL_ABILITY_DEFINITIONS);

    // Verify map structure (each weapon type has a map)
    for (const weaponType of WEAPON_TYPES) {
      expect(masteryMap[weaponType], `${weaponType} missing from map`).toBeDefined();
    }

    // Should have at least some entries across all weapon types
    let totalEntries = 0;
    for (const weaponType of WEAPON_TYPES) {
      totalEntries += Object.keys(masteryMap[weaponType]).length;
    }
    expect(totalEntries).toBeGreaterThan(0);
  });

  it('all mastery-unlocked abilities are in the map', () => {
    const masteryMap = deriveMasteryAbilities(ALL_ABILITY_DEFINITIONS);

    // Collect all ability IDs from masteryMap
    const mapIds = new Set<string>();
    for (const weaponType of WEAPON_TYPES) {
      for (const abilityId of Object.values(masteryMap[weaponType])) {
        mapIds.add(abilityId);
      }
    }

    // Find all mastery-unlocked abilities in definitions
    const masteryUnlockedIds = new Set<string>();
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const unlock of ability.unlocks) {
        if (unlock.kind === 'mastery') {
          masteryUnlockedIds.add(ability.id);
        }
      }
    }

    // Verify all mastery-unlocked abilities are in the map
    for (const id of masteryUnlockedIds) {
      expect(mapIds.has(id), `${id} is mastery-unlocked but not in map`).toBe(true);
    }
  });

  it('all mapped abilities exist in definitions', () => {
    const masteryMap = deriveMasteryAbilities(ALL_ABILITY_DEFINITIONS);
    const abilityIds = new Set(ALL_ABILITY_DEFINITIONS.map(a => a.id));

    for (const weaponType of WEAPON_TYPES) {
      for (const abilityId of Object.values(masteryMap[weaponType])) {
        if (abilityId) {
          expect(abilityIds.has(abilityId), `${abilityId} in map but not in definitions`).toBe(true);
        }
      }
    }
  });
});
