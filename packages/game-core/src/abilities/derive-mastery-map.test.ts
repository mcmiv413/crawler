import { describe, it, expect } from 'vitest';
import { deriveMasteryAbilities } from './derive-mastery-map.js';
import { ALL_ABILITY_DEFINITIONS } from './definitions/index.js';

describe('deriveMasteryAbilities', () => {
  it('derives correct mastery ability map from definitions', () => {
    const masteryMap = deriveMasteryAbilities(ALL_ABILITY_DEFINITIONS);

    // Check weapon types with mastery unlocks
    // Note: blade tier 2 (blade_riposte) is still using legacy handler
    expect(masteryMap.blade[1]).toBe('blade_bleed');

    expect(masteryMap.bludgeon[1]).toBe('bludgeon_stagger');
    expect(masteryMap.bludgeon[2]).toBe('bludgeon_shatter');

    expect(masteryMap.axe[1]).toBe('axe_cleave');
    expect(masteryMap.axe[2]).toBe('axe_execute');

    expect(masteryMap.ranged[1]).toBe('ranged_pin');
    expect(masteryMap.ranged[2]).toBe('ranged_volley');
  });
});
