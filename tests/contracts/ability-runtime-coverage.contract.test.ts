import { describe, expect, it } from 'vitest';
import { ALL_ABILITY_DEFINITIONS, LEGACY_CONTENT_ABILITY_HANDLER_IDS } from '@dungeon/core';
import { ABILITY_DEFINITIONS, daggerDisarm, daggerSetTrap } from '@dungeon/content';

const EXPECTED_LEGACY_HANDLER_IDS = [daggerDisarm.id, daggerSetTrap.id] as const;

describe('Ability Runtime Coverage Contract', () => {
  it('keeps the legacy combat-handler allowlist narrow and explicit', () => {
    expect(new Set(LEGACY_CONTENT_ABILITY_HANDLER_IDS)).toEqual(new Set(EXPECTED_LEGACY_HANDLER_IDS));
  });

  it('covers every content-backed ability with a runtime definition or explicit legacy handler', () => {
    const runtimeIds = new Set(ALL_ABILITY_DEFINITIONS.map((definition) => definition.id));
    const legacyIds = new Set(LEGACY_CONTENT_ABILITY_HANDLER_IDS);

    for (const abilityId of ABILITY_DEFINITIONS.keys()) {
      expect(
        runtimeIds.has(abilityId) || legacyIds.has(abilityId),
        `Ability "${abilityId}" is missing a runtime definition and is not explicitly handled in combat.ts`,
      ).toBe(true);
    }
  });

  it('does not keep legacy handler IDs after they gain runtime definitions', () => {
    const runtimeIds = new Set(ALL_ABILITY_DEFINITIONS.map((definition) => definition.id));

    for (const abilityId of LEGACY_CONTENT_ABILITY_HANDLER_IDS) {
      expect(
        ABILITY_DEFINITIONS.has(abilityId),
        `Legacy handler "${abilityId}" must remain a valid content ability ID`,
      ).toBe(true);
      expect(
        runtimeIds.has(abilityId),
        `Legacy handler "${abilityId}" should be removed from combat.ts once a runtime definition exists`,
      ).toBe(false);
    }
  });
});
