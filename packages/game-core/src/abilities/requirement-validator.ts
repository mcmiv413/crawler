import type { AbilityRequirement } from './types.js';
import type { Player, GameState, Direction } from '@dungeon/contracts';
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
  const dx = Math.abs(player.position.x - target.position.x);
  const dy = Math.abs(player.position.y - target.position.y);
  return dx <= 1 && dy <= 1 && (dx + dy) > 0;
}

function isInWeaponRange(player: Player, target: HasStats, _state: GameState): boolean {
  return isInMeleeRange(player, target);
}
