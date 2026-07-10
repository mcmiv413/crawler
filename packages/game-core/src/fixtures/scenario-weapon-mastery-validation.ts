import { WEAPON_TYPES } from '@dungeon/contracts';
import { isFiniteNumber, isRecord } from '../state/validation-guards.js';
import type { ScenarioFixture, ScenarioValidationError } from './scenario-fixture-types.js';

const VALID_WEAPON_TYPES = new Set<string>(WEAPON_TYPES);

export function validateScenarioWeaponMastery(scenario: ScenarioFixture): ScenarioValidationError[] {
  const rawWeaponMastery = (scenario as { readonly weaponMastery?: unknown }).weaponMastery;
  if (rawWeaponMastery === undefined) return [];
  if (!isRecord(rawWeaponMastery)) {
    return [{ field: 'weaponMastery', message: 'weaponMastery must be a plain object or omitted.' }];
  }

  return Object.entries(rawWeaponMastery).flatMap(([weaponType, value]): ScenarioValidationError[] => {
    if (!VALID_WEAPON_TYPES.has(weaponType)) {
      return [{
        field: `weaponMastery.${weaponType}`,
        message: `Unknown weapon mastery key "${weaponType}". Valid keys: ${WEAPON_TYPES.join(', ')}.`,
      }];
    }
    return isFiniteNumber(value) && Number.isInteger(value) && value >= 0
      ? []
      : [{
          field: `weaponMastery.${weaponType}`,
          message: `weaponMastery.${weaponType} must be a non-negative integer, got ${JSON.stringify(value)}.`,
        }];
  });
}
