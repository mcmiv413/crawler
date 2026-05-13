import type { AbilityRequirement } from './types.js';
import type { Player, GameState, Direction, WeaponTemplate } from '@dungeon/contracts';
import { canAffordMana } from '../systems/mana.js';

interface HasStats {
  readonly stats: { health: number; maxHealth: number };
  readonly position: { x: number; y: number };
}

export function validateRequirement(
  requirement: AbilityRequirement,
  player: Player,
  state: GameState,
  target: HasStats | undefined,
  direction?: Direction,
): boolean {
  switch (requirement.kind) {
    case 'has_mana':
      return canAffordMana(player.mana, requirement.amount);
    case 'has_direction':
      return direction !== undefined;
    case 'has_target':
      return target !== undefined;
    case 'no_target':
      return target === undefined;
    case 'player_missing_hp':
      return player.stats.health < player.stats.maxHealth;
    case 'target_in_melee_range':
      return target !== undefined && isInMeleeRange(player, target);
    case 'target_in_weapon_range':
      return target !== undefined && isInWeaponRange(player, target, state);
    case 'target_in_ability_range':
      return target !== undefined && isInRange(player, target, requirement.range, requirement.minRange ?? 0);
    case 'target_visible':
      return target !== undefined;
    case 'target_below_hp_pct':
      return target !== undefined && target.stats.health < (target.stats.maxHealth * requirement.percentage) / 100;
    case 'weapon_type':
      return true;
    default:
      const _exhaustive: never = requirement;
      return _exhaustive;
  }
}

export function validateAllRequirements(
  requirements: readonly AbilityRequirement[],
  player: Player,
  state: GameState,
  target: HasStats | undefined,
  direction?: Direction,
): boolean {
  return requirements.every((req) => validateRequirement(req, player, state, target, direction));
}

function isInMeleeRange(player: Player, target: HasStats): boolean {
  return isInRange(player, target, 1, 0);
}

function isInWeaponRange(player: Player, target: HasStats, state: GameState): boolean {
  const weaponId = state.player.equipment.weapon;
  const weaponTemplate = weaponId === null ? undefined : state.itemRegistry.items.get(weaponId);
  const weapon = weaponTemplate?.itemClass === 'weapon'
    ? (weaponTemplate as WeaponTemplate).weapon
    : undefined;

  return isInRange(player, target, weapon?.weaponRange ?? 1, weapon?.minRange ?? 0);
}

function isInRange(
  player: Player,
  target: HasStats,
  maxRange: number,
  minRange: number,
): boolean {
  const dx = Math.abs(player.position.x - target.position.x);
  const dy = Math.abs(player.position.y - target.position.y);
  const distance = Math.max(dx, dy);
  return distance > 0 && distance <= maxRange && distance >= minRange;
}
