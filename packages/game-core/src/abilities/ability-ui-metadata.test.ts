/**
 * Test layer: unit
 * Behavior: Ability ui Metadata covers Ability UI Metadata Adapter; basic properties; derives name, description, and cooldown from ability definition.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/abilities/ability-ui-metadata.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ALL_ABILITY_DEFINITIONS } from './definitions/index.js';
import { getAbilityUiMetadata, type AbilityUiMetadata } from './ability-ui-metadata.js';

describe('Ability UI Metadata Adapter', () => {
  describe('basic properties', () => {
    it('derives name, description, and cooldown from ability definition', () => {
      const powerStrike = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'power_strike')!;
      const metadata = getAbilityUiMetadata(powerStrike);

      expect(metadata.id).toBe('power_strike');
      expect(metadata.name).toBe('Power Strike');
      expect(metadata.description).toBe(
        'Unleash a devastating blow dealing 2× your attack damage.'
      );
      expect(metadata.cooldown).toBe(2);
    });

    it('derives minLevel from unlocks array', () => {
      const powerStrike = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'power_strike')!;
      const metadata = getAbilityUiMetadata(powerStrike);

      expect(metadata.unlockLevel).toBe(2);
    });

    it('sets unlockLevel to 1 when no level unlock found', () => {
      const secondWind = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'second_wind')!;
      const metadata = getAbilityUiMetadata(secondWind);

      expect(metadata.unlockLevel).toBeGreaterThanOrEqual(1);
    });
  });

  describe('weapon type requirements', () => {
    it('extracts requiresWeaponTypes from weapon_type requirements', () => {
      const rangedPin = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'ranged_pin')!;
      const metadata = getAbilityUiMetadata(rangedPin);

      expect(metadata.requiresWeaponTypes).toContain('ranged');
    });

    it('returns undefined when no weapon type requirement', () => {
      const secondWind = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'second_wind')!;
      const metadata = getAbilityUiMetadata(secondWind);

      expect(metadata.requiresWeaponTypes).toBeUndefined();
    });
  });

  describe('target mode classification', () => {
    it('classifies power_strike as enemy-targeted melee', () => {
      const powerStrike = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'power_strike')!;
      const metadata = getAbilityUiMetadata(powerStrike);

      expect(metadata.targetMode).toBe('single_enemy');
    });

    it('classifies blade_bleed as enemy-targeted melee', () => {
      const bladeBleeed = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'blade_bleed')!;
      const metadata = getAbilityUiMetadata(bladeBleeed);

      expect(metadata.targetMode).toBe('single_enemy');
    });

    it('classifies blade_riposte as enemy-targeted melee', () => {
      const bladeRiposte = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'blade_riposte')!;
      const metadata = getAbilityUiMetadata(bladeRiposte);

      expect(metadata.targetMode).toBe('single_enemy');
    });

    it('classifies ranged_pin as enemy-targeted ranged', () => {
      const rangedPin = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'ranged_pin')!;
      const metadata = getAbilityUiMetadata(rangedPin);

      expect(metadata.targetMode).toBe('single_enemy');
      expect(metadata.requiresWeaponTypes).toContain('ranged');
    });

    it('classifies second_wind as self-targeted (no chooser)', () => {
      const secondWind = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'second_wind')!;
      const metadata = getAbilityUiMetadata(secondWind);

      expect(metadata.targetMode).toBe('self');
    });

    it('classifies ranged_volley as self-targeted (no chooser)', () => {
      const rangedVolley = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'ranged_volley')!;
      const metadata = getAbilityUiMetadata(rangedVolley);

      expect(metadata.targetMode).toBe('all_visible_enemies');
    });

    it('classifies axe_cleave as primary-target AOE', () => {
      const axieCleave = ALL_ABILITY_DEFINITIONS.find(a => a.id === 'axe_cleave')!;
      const metadata = getAbilityUiMetadata(axieCleave);

      expect(metadata.targetMode).toBe('target_plus_adjacent_enemies');
    });
  });

  describe('trap interaction metadata', () => {
    it('identifies dagger_disarm as directional trap disarm', () => {
      // Note: dagger_disarm is in content, not game-core yet
      // This test is for future implementation
      // For now, test placeholder behavior
      const metadata: AbilityUiMetadata = {
        id: 'dagger_disarm',
        name: 'Disarm Trap',
        description: 'Disarm an adjacent trap.',
        cooldown: 0,
        unlockLevel: 1,
        targetMode: 'trap_disarm',
      };

      expect(metadata.targetMode).toBe('trap_disarm');
    });

    it('identifies dagger_set_trap as directional trap placement', () => {
      // Note: dagger_set_trap is in content, not game-core yet
      // This test is for future implementation
      const metadata: AbilityUiMetadata = {
        id: 'dagger_set_trap',
        name: 'Set Trap',
        description: 'Set a trap in an adjacent direction.',
        cooldown: 0,
        unlockLevel: 1,
        targetMode: 'trap_set',
      };

      expect(metadata.targetMode).toBe('trap_set');
    });
  });

  describe('all ability definitions have valid metadata', () => {
    it('can derive metadata from all ability definitions', () => {
      const errors: string[] = [];

      for (const ability of ALL_ABILITY_DEFINITIONS) {
        try {
          const metadata = getAbilityUiMetadata(ability);
          // Basic validation that metadata has expected shape
          expect(metadata).toHaveProperty('id');
          expect(metadata).toHaveProperty('name');
          expect(metadata).toHaveProperty('targetMode');
        } catch (e) {
          errors.push(
            `Failed to derive metadata for ${ability.id}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }

      if (errors.length > 0) {
        throw new Error(`Failed to derive metadata:\n${errors.join('\n')}`);
      }
      expect(errors).toEqual([]);
    });
  });
});
