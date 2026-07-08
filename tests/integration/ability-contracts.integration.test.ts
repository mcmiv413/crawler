/**
 * Test layer: integration
 * Behavior: Ability Contracts covers check-ability-contracts helper; accepts valid ability contracts; fails when an ability points at a missing animation ref.
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run tests/integration/ability-contracts.integration.test.ts
 */
import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '@dungeon/content';
import { collectAbilityContractFailures } from '../../scripts/check-ability-contracts.js';

function createAbility(overrides?: Partial<AbilityDefinition>): AbilityDefinition {
  return {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Recover composure and health.',
    cooldown: 2,
    requiresTarget: false,
    unlockLevel: 1,
    animation: { id: 'fx.self.second_wind' },
    ...overrides,
  };
}

describe('check-ability-contracts helper', () => {
  const baseSnapshot = {
    animationIds: new Set(['fx.self.second_wind', 'fx.utility.trap_placement']),
    useAbilityFields: new Set(['type', 'abilityId', 'targetId', 'direction']),
    setTrapFields: new Set(['type', 'direction', 'itemEntityId']),
    validWeaponTypes: new Set(['blade', 'bludgeon', 'axe', 'ranged', 'dagger']),
  } as const;

  it('accepts valid ability contracts', () => {
    const failures = collectAbilityContractFailures({
      ...baseSnapshot,
      abilities: [createAbility()],
    });

    expect(failures).toEqual([]);
  });

  it('fails when an ability points at a missing animation ref', () => {
    const failures = collectAbilityContractFailures({
      ...baseSnapshot,
      abilities: [createAbility({ animation: { id: 'fx.missing.animation' } })],
    });

    expect(failures).toContain(
      'second_wind: animation "fx.missing.animation" is not declared in animationRefs',
    );
  });

  it('fails when an ability requires both target and direction without an explicit allowance', () => {
    const failures = collectAbilityContractFailures({
      ...baseSnapshot,
      abilities: [
        createAbility({
          id: 'combo_strike',
          requiresTarget: true,
          requiresDirection: true,
        }),
      ],
    });

    expect(failures).toContain(
      'combo_strike: target + direction payloads require an explicit allowance before both can be mandatory',
    );
  });

  it('fails when trap placement loses its dedicated itemEntityId payload', () => {
    const failures = collectAbilityContractFailures({
      ...baseSnapshot,
      setTrapFields: new Set(['type', 'direction']),
      abilities: [
        createAbility({
          id: 'dagger_set_trap',
          name: 'Set Trap',
          animation: { id: 'fx.utility.trap_placement' },
          requiresDirection: true,
        }),
      ],
    });

    expect(failures).toContain(
      'dagger_set_trap: SET_TRAP schema must expose itemEntityId for trap placement abilities',
    );
  });
});
