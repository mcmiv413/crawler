import type { GameState, WeaponType } from '@dungeon/contracts';
import { ABILITY_DEFINITIONS } from '@dungeon/content';
import type { AbilityView } from '../game-view.js';

type AbilityDefinition = ReturnType<typeof ABILITY_DEFINITIONS.get>;
type PlayerAbilityState = GameState['player']['abilities'][number];

function canUseAbilityWithWeapon(
  requiredWeaponTypes: readonly WeaponType[] | undefined,
  equippedWeaponType: WeaponType | null,
): boolean {
  if (!requiredWeaponTypes || requiredWeaponTypes.length === 0) {
    return true;
  }

  return equippedWeaponType !== null && requiredWeaponTypes.includes(equippedWeaponType);
}

function hasEnoughMana(definition: AbilityDefinition, playerMana: number): boolean {
  return definition?.manaCost === undefined || playerMana >= definition.manaCost;
}

function isRangedAbility(definition: AbilityDefinition): boolean | undefined {
  return definition?.range !== undefined
    || definition?.requiresWeaponTypes?.includes('ranged') === true
    ? true
    : undefined;
}

function buildTargetRange(definition: AbilityDefinition): AbilityView['targetRange'] {
  return definition?.range !== undefined
    ? {
        max: definition.range,
        min: definition.minRange ?? 0,
      }
    : undefined;
}

function buildWeaponRequirement(
  definition: AbilityDefinition,
  equippedWeaponType: WeaponType | null,
): AbilityView['weaponRequirement'] {
  const requiredWeaponTypes = definition?.requiresWeaponTypes;
  if (!requiredWeaponTypes || requiredWeaponTypes.length === 0) {
    return undefined;
  }

  return {
    label: requiredWeaponTypes.join(', '),
    met: equippedWeaponType !== null && requiredWeaponTypes.includes(equippedWeaponType),
  };
}

function buildAbilityView(
  ability: PlayerAbilityState,
  playerMana: number,
  equippedWeaponType: WeaponType | null,
): AbilityView {
  const definition = ABILITY_DEFINITIONS.get(ability.id);
  return {
    id: ability.id,
    ...buildAbilityIdentity(definition, ability.id),
    ...buildAbilityAvailability(definition, ability, playerMana),
    ...buildAbilityUsage(definition, equippedWeaponType),
  };
}

function buildAbilityIdentity(
  definition: AbilityDefinition,
  abilityId: string,
): Pick<AbilityView, 'name' | 'description' | 'cooldown' | 'unlockLevel'> {
  return {
    name: definition?.name ?? abilityId,
    description: definition?.description ?? '',
    cooldown: definition?.cooldown ?? 0,
    unlockLevel: definition?.unlockLevel ?? 0,
  };
}

function buildAbilityAvailability(
  definition: AbilityDefinition,
  ability: PlayerAbilityState,
  playerMana: number,
): Pick<AbilityView, 'ready' | 'cooldownRemaining' | 'manaCost'> {
  const manaCost = definition?.manaCost;
  return {
    ready: ability.cooldownRemaining === 0 && hasEnoughMana(definition, playerMana),
    cooldownRemaining: ability.cooldownRemaining,
    manaCost,
  };
}

function buildAbilityUsage(
  definition: AbilityDefinition,
  equippedWeaponType: WeaponType | null,
): Pick<
  AbilityView,
  | 'requiresTarget'
  | 'requiresDirection'
  | 'isRanged'
  | 'tileTarget'
  | 'targetRange'
  | 'weaponRequirement'
> {
  return {
    requiresTarget: definition?.requiresTarget ?? false,
    requiresDirection: definition?.requiresDirection === true,
    isRanged: isRangedAbility(definition),
    tileTarget: definition?.tileTarget === true,
    targetRange: buildTargetRange(definition),
    weaponRequirement: buildWeaponRequirement(definition, equippedWeaponType),
  };
}

export function buildAbilityList(
  state: GameState,
  equippedWeaponType: WeaponType | null,
): AbilityView[] {
  const playerAbilities = state.player.abilities ?? [];

  return playerAbilities
    .filter(ability => {
      const definition = ABILITY_DEFINITIONS.get(ability.id);
      return definition === undefined
        || canUseAbilityWithWeapon(definition.requiresWeaponTypes, equippedWeaponType);
    })
    .map(ability => buildAbilityView(ability, state.player.mana, equippedWeaponType));
}
