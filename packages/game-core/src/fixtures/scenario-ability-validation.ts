import { ALL_ABILITY_DEFINITIONS } from '../abilities/definitions/index.js';
import { validateContentRef } from '../state/validation-guards.js';
import type { ScenarioFixture, ScenarioValidationError } from './scenario-fixture-types.js';

const ABILITY_DEFINITION_BY_ID = new Map(ALL_ABILITY_DEFINITIONS.map(definition => [definition.id, definition]));

export function validateScenarioPlayerAbilityIds(scenario: ScenarioFixture): ScenarioValidationError[] {
  const rawAbilityIds = (scenario as { readonly playerAbilityIds?: unknown }).playerAbilityIds;
  if (rawAbilityIds === undefined) return [];
  if (!Array.isArray(rawAbilityIds)) {
    return [{ field: 'playerAbilityIds', message: 'playerAbilityIds must be an array of ability ids.' }];
  }

  const seen = new Set<string>();
  return rawAbilityIds.flatMap((abilityId, i): ScenarioValidationError[] => {
    const duplicateErrors: ScenarioValidationError[] = typeof abilityId === 'string' && seen.has(abilityId)
      ? [{ field: `playerAbilityIds[${i}]`, message: `Duplicate ability id "${abilityId}".` }]
      : [];
    if (typeof abilityId === 'string') {
      seen.add(abilityId);
    }
    return [
      ...duplicateErrors,
      ...validateContentRef<string, ScenarioValidationError>(
        `playerAbilityIds[${i}]`,
        abilityId,
        ABILITY_DEFINITION_BY_ID,
        'ALL_ABILITY_DEFINITIONS',
        {
          invalidType: value => `player ability id must be a string, got ${JSON.stringify(value)}.`,
          missing: value => `Unknown player ability id "${value}". Must exist in ALL_ABILITY_DEFINITIONS.`,
        },
      ),
    ];
  });
}
