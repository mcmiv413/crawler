import { describe, expect, it } from 'vitest';
import { ALL_ABILITY_DEFINITIONS } from '@dungeon/core';
import { ABILITY_DEFINITIONS } from '@dungeon/content';
import {
  collectAbilityContractFailures,
  createLiveAbilityContractSnapshot,
} from '../../scripts/check-ability-contracts.js';

describe('Ability Contracts', () => {
  it('keeps live ability metadata aligned with animation refs and public command payloads', () => {
    expect(collectAbilityContractFailures(createLiveAbilityContractSnapshot())).toEqual([]);
  });

  it('keeps game-core ability cooldowns aligned with content ability definitions', () => {
    for (const definition of ALL_ABILITY_DEFINITIONS) {
      expect(
        ABILITY_DEFINITIONS.get(definition.id)?.cooldown,
        `Content ability "${definition.id}" must match the game-core runtime cooldown`,
      ).toBe(definition.cooldown);
    }
  });
});
