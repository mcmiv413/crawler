/**
 * Test layer: contract
 * Behavior: Every content ability is backed by a runtime definition unless it is one of the explicitly allowed legacy combat handlers.
 * Proof: Expectations require an empty legacy allowlist, require each ABILITY_DEFINITIONS id to appear in runtime ids or the legacy set, require legacy ids to remain valid content ids without runtime definitions, and assert dagger trap utilities have custom runtime definitions.
 * Validation: pnpm vitest run tests/contracts/ability-runtime-coverage.contract.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ALL_ABILITY_DEFINITIONS, LEGACY_CONTENT_ABILITY_HANDLER_IDS } from '@dungeon/core';
import { ABILITY_DEFINITIONS, daggerDisarm, daggerSetTrap } from '@dungeon/content';

const EXPECTED_DAGGER_TRAP_IDS = [daggerDisarm.id, daggerSetTrap.id] as const;

describe('Ability Runtime Coverage Contract', () => {
  it('keeps the legacy combat-handler allowlist narrow and explicit', () => {
    expect(new Set(LEGACY_CONTENT_ABILITY_HANDLER_IDS)).toEqual(new Set<string>());
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

  it('defines dagger trap utilities as custom runtime abilities', () => {
    const runtimeDefinitions = new Map(ALL_ABILITY_DEFINITIONS.map((definition) => [definition.id, definition]));

    for (const abilityId of EXPECTED_DAGGER_TRAP_IDS) {
      const definition = runtimeDefinitions.get(abilityId);
      expect(definition, `${abilityId} must have a game-core runtime definition`).toBeDefined();
      expect(definition?.targeting.selector.kind).toBe('custom');
      expect(definition?.requirements).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'weapon_type', weaponType: 'dagger' }),
        expect.objectContaining({ kind: 'has_direction' }),
      ]));
      expect(definition?.effects).toEqual([]);
    }
  });
});
