import type { WeaponType } from '@dungeon/contracts';
import type { AbilityDefinition, TargetSelector } from './types.js';

/**
 * UI-focused metadata derived from ability definitions.
 * This is the single source of truth for ability targeting, range, and presentation.
 */
export interface AbilityUiMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cooldown: number;
  readonly unlockLevel: number;
  readonly requiresWeaponTypes?: readonly WeaponType[];
  readonly targetMode:
    | 'self'
    | 'single_enemy'
    | 'all_visible_enemies'
    | 'target_plus_adjacent_enemies'
    | 'trap_disarm'
    | 'trap_set';
  readonly isRanged?: boolean;
}

/**
 * Classifies the target mode from an ability's target selector and tags.
 */
function classifyTargetMode(
  selector: TargetSelector,
  tags: readonly string[]
): AbilityUiMetadata['targetMode'] {
  // Special cases for directional trap interactions
  if (tags.includes('trap_disarm')) return 'trap_disarm';
  if (tags.includes('trap_set')) return 'trap_set';

  switch (selector.kind) {
    case 'self':
      return 'self';
    case 'single_enemy':
      return 'single_enemy';
    case 'all_visible_enemies':
      return 'all_visible_enemies';
    case 'target_plus_adjacent_enemies':
      return 'target_plus_adjacent_enemies';
    case 'nearest_enemy_melee':
      return 'single_enemy';
    case 'nearest_visible_enemy':
      return 'single_enemy';
    default:
      return 'self';
  }
}

/**
 * Extract weapon types from ability requirements.
 */
function extractWeaponTypes(requirements: AbilityDefinition['requirements']): WeaponType[] | undefined {
  const weaponTypes = requirements
    .filter(req => req.kind === 'weapon_type' && 'weaponType' in req)
    .map(req => (req as { weaponType: WeaponType }).weaponType);

  return weaponTypes.length > 0 ? weaponTypes : undefined;
}

/**
 * Extract unlock level from ability unlocks.
 */
function extractUnlockLevel(unlocks: AbilityDefinition['unlocks']): number {
  const levelUnlock = unlocks.find(u => u.kind === 'level');
  return levelUnlock && 'minLevel' in levelUnlock ? levelUnlock.minLevel : 1;
}

/**
 * Determine if ability is ranged based on weapon type requirements.
 */
function isRangedAbility(weaponTypes?: WeaponType[]): boolean {
  return weaponTypes?.includes('ranged') ?? false;
}

/**
 * Derive UI-focused metadata from an ability definition.
 * This is the single source of truth that presenter and web layers consume.
 */
export function getAbilityUiMetadata(ability: AbilityDefinition): AbilityUiMetadata {
  const weaponTypes = extractWeaponTypes(ability.requirements);
  const unlockLevel = extractUnlockLevel(ability.unlocks);
  const targetMode = classifyTargetMode(ability.targeting.selector, Array.from(ability.tags));
  const isRanged = isRangedAbility(weaponTypes);

  return {
    id: ability.id,
    name: ability.name,
    description: ability.description,
    cooldown: ability.cooldown,
    unlockLevel,
    requiresWeaponTypes: weaponTypes,
    targetMode,
    isRanged: isRanged === true ? true : undefined,
  };
}

/**
 * Build a map of ability ID to UI metadata for fast lookups.
 */
export function buildAbilityUiMetadataMap(
  abilities: readonly AbilityDefinition[]
): Map<string, AbilityUiMetadata> {
  const map = new Map<string, AbilityUiMetadata>();
  for (const ability of abilities) {
    map.set(ability.id, getAbilityUiMetadata(ability));
  }
  return map;
}
