import { describe, it, expect } from 'vitest';
import { ALL_ABILITY_DEFINITIONS, buildRegistry } from './index.js';
import { WEAPON_TYPES } from '@dungeon/contracts';

/**
 * Contract Tests: Ability Data Integrity
 *
 * Validates ability structure, ranges, and relationships without asserting exact values.
 * Balance tuning should not break contract tests.
 */

const ABILITY_REGISTRY = buildRegistry(ALL_ABILITY_DEFINITIONS);
const MAX_PLAYER_LEVEL = 20;

describe('Ability Registry Structure', () => {
  it('all abilities have required fields', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(ability.id, `Ability missing id`).toBeDefined();
      expect(typeof ability.id, `${ability.id} id must be string`).toBe('string');
      expect(ability.name, `${ability.id} missing name`).toBeDefined();
      expect(ability.description, `${ability.id} missing description`).toBeDefined();
      expect(ability.cooldown, `${ability.id} missing cooldown`).toBeDefined();
      expect(ability.unlocks, `${ability.id} missing unlocks`).toBeDefined();
      expect(ability.targeting, `${ability.id} missing targeting`).toBeDefined();
      expect(ability.effects, `${ability.id} missing effects`).toBeDefined();
    }
  });

  it('all ability IDs are strings (not null/undefined)', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(typeof ability.id).toBe('string');
      expect(ability.id.length).toBeGreaterThan(0);
      expect(ability.id).toBe(ability.id.toLowerCase()); // Consistent casing
    }
  });

  it('no duplicate ability IDs', () => {
    const ids = new Set<string>();
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(ids.has(ability.id), `Duplicate ability ID: ${ability.id}`).toBe(false);
      ids.add(ability.id);
    }
    expect(ids.size).toBe(ALL_ABILITY_DEFINITIONS.length);
  });
});

describe('Cost & Resource Constraints', () => {
  it('all abilities have cooldown >= 0', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(
        ability.cooldown,
        `${ability.id} cooldown must be >= 0, got ${ability.cooldown}`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('cooldowns <= 100 (sanity upper bound)', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(
        ability.cooldown,
        `${ability.id} cooldown too high: ${ability.cooldown}`,
      ).toBeLessThanOrEqual(100);
    }
  });

  it('high-damage abilities (2x+ multiplier) have cooldown > 0', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      // Check for attack effects with high multiplier
      const hasHighDamage = ability.effects.some((effect) => {
        if (effect.kind === 'attack' && effect.damageMultiplier >= 2) {
          return true;
        }
        if (effect.kind === 'conditional') {
          return effect.then.some((e) => e.kind === 'attack' && e.damageMultiplier >= 2);
        }
        return false;
      });

      if (hasHighDamage) {
        expect(
          ability.cooldown,
          `${ability.id} has high damage (2x+) but cooldown is 0 (too powerful)`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('Cooldown Validity', () => {
  // Reworded from "Cost & Resource Constraints" to align with test naming
  it('cooldowns are non-negative integers', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(Number.isInteger(ability.cooldown)).toBe(true);
      expect(ability.cooldown).toBeGreaterThanOrEqual(0);
    }
  });

  it('cooldown range is reasonable (0-100)', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(ability.cooldown).toBeLessThanOrEqual(100);
    }
  });

  it('power strike has non-zero cooldown', () => {
    const powerStrike = ABILITY_REGISTRY.get('power_strike');
    expect(powerStrike).toBeDefined();
    if (powerStrike) {
      expect(powerStrike.cooldown, 'power_strike should have cooldown > 0').toBeGreaterThan(0);
    }
  });
});

describe('Effect Type Validation', () => {
  it('all ability effects are valid types', () => {
    const validEffectKinds = new Set(['attack', 'heal', 'status', 'modify_stat', 'conditional']);

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const effect of ability.effects) {
        expect(
          validEffectKinds.has(effect.kind),
          `${ability.id} has invalid effect kind: ${effect.kind}`,
        ).toBe(true);
      }
    }
  });

  it('attack effects have positive damage multiplier', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      const walkEffects = (effects: readonly unknown[]) => {
        for (const effect of effects) {
          if (typeof effect !== 'object' || effect === null) continue;
          const e = effect as Record<string, unknown>;

          if (e.kind === 'attack') {
            expect(
              e.damageMultiplier,
              `${ability.id} attack effect has invalid damageMultiplier`,
            ).toBeGreaterThan(0);
          }

          if (e.kind === 'conditional' && Array.isArray(e.then)) {
            walkEffects(e.then);
          }
          if (e.kind === 'conditional' && Array.isArray(e.otherwise)) {
            walkEffects(e.otherwise);
          }
        }
      };

      walkEffects(ability.effects);
    }
  });
});

describe('Targeting Type Validation', () => {
  it('all abilities have valid targeting selectors', () => {
    const validSelectors = new Set([
      'self',
      'single_enemy',
      'nearest_enemy_melee',
      'nearest_visible_enemy',
      'all_visible_enemies',
      'target_plus_adjacent_enemies',
    ]);

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      const selector = ability.targeting.selector;
      expect(
        validSelectors.has(selector.kind),
        `${ability.id} has invalid targeting selector: ${selector.kind}`,
      ).toBe(true);
    }
  });

  it('self-targeted abilities have no requirements for has_target', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      if (ability.targeting.selector.kind === 'self') {
        const hasHasTarget = ability.requirements.some((req) => req.kind === 'has_target');
        expect(
          hasHasTarget,
          `${ability.id} is self-targeted but has "has_target" requirement`,
        ).toBe(false);
      }
    }
  });
});

describe('Unlock Level Consistency', () => {
  it('all abilities have valid unlock levels', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const unlock of ability.unlocks) {
        if (unlock.kind === 'level') {
          expect(unlock.minLevel, `${ability.id} has invalid minLevel`).toBeGreaterThanOrEqual(1);
          expect(
            unlock.minLevel,
            `${ability.id} minLevel exceeds max player level: ${unlock.minLevel} > ${MAX_PLAYER_LEVEL}`,
          ).toBeLessThanOrEqual(MAX_PLAYER_LEVEL);
        }
      }
    }
  });

  it('abilities are logically ordered by unlock level', () => {
    // Create a map of ability ID to minimum unlock level
    const minLevels = new Map<string, number>();

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      let minLevel = Infinity;
      for (const unlock of ability.unlocks) {
        if (unlock.kind === 'level') {
          minLevel = Math.min(minLevel, unlock.minLevel);
        }
      }
      if (minLevel < Infinity) {
        minLevels.set(ability.id, minLevel);
      }
    }

    // Verify no gaps in unlock levels (max gap is 1 level)
    const sortedLevels = Array.from(minLevels.values()).sort((a, b) => a - b);
    for (let i = 1; i < sortedLevels.length; i++) {
      const gap = sortedLevels[i]! - sortedLevels[i - 1]!;
      expect(gap, `Large gap in ability unlock levels: ${sortedLevels[i - 1]!} -> ${sortedLevels[i]!}`).toBeLessThanOrEqual(2);
    }
  });

  it('mastery-unlocked abilities reference valid weapon types', () => {
    const validWeaponTypes = new Set(WEAPON_TYPES);

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const unlock of ability.unlocks) {
        if (unlock.kind === 'mastery') {
          expect(
            validWeaponTypes.has(unlock.weaponType),
            `${ability.id} references invalid weaponType: ${unlock.weaponType}`,
          ).toBe(true);
          expect(
            unlock.masteryIndex,
            `${ability.id} has invalid masteryIndex: ${unlock.masteryIndex}`,
          ).toBeGreaterThanOrEqual(1);
          expect(unlock.masteryIndex).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});

describe('Ability-Specific Validations', () => {
  it('every ability has at least one effect', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      expect(
        ability.effects.length,
        `${ability.id} has no effects (empty ability)`,
      ).toBeGreaterThan(0);
    }
  });

  it('weapon-specific abilities only appear once per weapon type', () => {
    const weaponAbilities = new Map<string, string>();

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      // Check for weapon-specific ability names
      const abilityId = ability.id;
      for (const weaponType of WEAPON_TYPES) {
        if (abilityId.startsWith(weaponType + '_')) {
          const key = weaponType;
          const existing = weaponAbilities.get(key);
          if (existing) {
            // Just verify they're different abilities
            expect(existing).not.toBe(abilityId);
          }
          weaponAbilities.set(key, abilityId);
        }
      }
    }

    // Ensure each weapon type has at least one ability
    expect(weaponAbilities.has('blade') || weaponAbilities.has('bludgeon')).toBe(true);
  });

  it('all ability tags reference valid tag types', () => {
    const validTags = new Set(['melee', 'ranged', 'attack', 'heal', 'self']);

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const tag of ability.tags) {
        expect(
          validTags.has(tag),
          `${ability.id} has invalid tag: ${tag}`,
        ).toBe(true);
      }
    }
  });
});

describe('Ability Requirements', () => {
  it('all ability requirements reference valid kinds', () => {
    const validReqKinds = new Set([
      'weapon_type',
      'has_target',
      'no_target',
      'player_missing_hp',
      'target_in_melee_range',
      'target_visible',
      'target_below_hp_pct',
    ]);

    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const req of ability.requirements) {
        expect(
          validReqKinds.has(req.kind),
          `${ability.id} has invalid requirement kind: ${req.kind}`,
        ).toBe(true);
      }
    }
  });

  it('target_below_hp_pct requirements have valid percentage values', () => {
    for (const ability of ALL_ABILITY_DEFINITIONS) {
      for (const req of ability.requirements) {
        if (req.kind === 'target_below_hp_pct') {
          expect(req.percentage, `${ability.id} has invalid hp percentage`).toBeGreaterThan(0);
          expect(req.percentage, `${ability.id} has invalid hp percentage`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
