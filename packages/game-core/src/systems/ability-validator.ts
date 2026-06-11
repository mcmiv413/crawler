import type { GameState, Position, EntityId, Direction } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { RING_SPELL_BY_ID } from '@dungeon/content';
import { buildRegistry } from '../abilities/registry.js';
import { ALL_ABILITY_DEFINITIONS } from '../abilities/definitions/index.js';
import { validateRequirements } from '../abilities/runtime/validate-ability.js';
import { buildContext } from '../abilities/runtime/build-context.js';
import { canUseLearnedRingSpell } from './ring-spell-availability.js';
import { canUseAbility } from './abilities.js';
import { canAffordMana } from './mana.js';
import { chebyshevDistance } from '../utils/grid.js';
import { SeededRNG } from '../utils/rng.js';

const ABILITY_REGISTRY = buildRegistry(ALL_ABILITY_DEFINITIONS);

export type AbilityValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly rejectionCode: string;
      readonly message: string;
    };

/**
 * Central hub for ability action validation.
 *
 * Validates a complete ability action including:
 * 1. Ability definition exists
 * 2. Requirements (mana, cooldown, phase)
 * 3. Ring spell availability (learned + equipped) - checked after generic requirements
 * 4. Tile target validation (if targetPosition provided)
 *
 * Rejection codes:
 * - ABILITY_NOT_FOUND: Ability is not defined
 * - ABILITY_NOT_UNLOCKED: Ability is defined but not present in the player's ability list
 * - ABILITY_REQUIREMENTS_NOT_MET: Failed a requirement (mana, health, etc.)
 * - ABILITY_NOT_AVAILABLE: Ring spell not learned or required rings not equipped
 * - ABILITY_ON_COOLDOWN: Ability is still on cooldown
 * - INSUFFICIENT_MANA: Player lacks mana for the ability
 * - MISSING_TILE_TARGET: Tile target required but not provided
 * - WRONG_PHASE: Cannot use ability in current game phase
 * - INVALID_TILE_TARGET: Target tile is not walkable
 * - TILE_NOT_VISIBLE: Target tile is not visible to player
 * - TILE_OCCUPIED: Target tile is occupied by enemy or object
 * - OUT_OF_RANGE: Target tile is beyond ability range
 */
export function validateAbilityAction(
  state: GameState,
  abilityId: string,
  targetPosition?: Position,
  targetId?: EntityId,
  direction?: Direction,
): AbilityValidationResult {
  // 1. Check ability definition exists
  const definition = ABILITY_REGISTRY.get(abilityId);
  if (definition === undefined) {
    return {
      valid: false,
      rejectionCode: 'ABILITY_NOT_FOUND',
      message: `Ability "${abilityId}" is not defined.`,
    };
  }

  // 1.5. Check phase and run BEFORE buildContext
  if (state.phase !== 'dungeon' || state.run === null) {
    return {
      valid: false,
      rejectionCode: 'WRONG_PHASE',
      message: `${definition.name} can only be used during dungeon exploration.`,
    };
  }

  // 2a. Check player has unlocked or equipped the ability before any runtime checks.
  const abilityInList = state.player.abilities.some(a => a.id === abilityId);
  if (abilityInList === false) {
    return {
      valid: false,
      rejectionCode: 'ABILITY_NOT_UNLOCKED',
      message: `${definition.name} is not unlocked.`,
    };
  }

  if (!canUseAbility(state, abilityId)) {
    return {
      valid: false,
      rejectionCode: 'ABILITY_ON_COOLDOWN',
      message: `${definition.name} is on cooldown.`,
    };
  }

  // 2b. Validate other requirements (mana, targets, etc.)
  const context = buildContext(state, new SeededRNG(state.seed), targetId, direction, targetPosition);
  const validation = validateRequirements(context, definition.requirements);

  if (validation.valid === false) {
    // Determine if it's a mana issue or a general requirement issue
    const manaRequirement = definition.requirements.find(r => r.kind === 'has_mana');
    if (
      manaRequirement !== undefined
      && !canAffordMana(state.player.mana, manaRequirement.amount)
    ) {
      return {
        valid: false,
        rejectionCode: 'INSUFFICIENT_MANA',
        message: `${definition.name} requires ${manaRequirement.amount} mana.`,
      };
    }

    // Generic requirement failure
    const message = validation.reason ?? `Cannot use ${definition.name}.`;
    return {
      valid: false,
      rejectionCode: 'ABILITY_REQUIREMENTS_NOT_MET',
      message,
    };
  }

  // 3. Check ring spell availability (if it's a ring spell) - AFTER generic requirements
  const ringSpell = RING_SPELL_BY_ID.get(abilityId);
  if (ringSpell !== undefined) {
    const equippedItemIds = Object.values(state.player.equipment)
      .filter((id): id is EntityId => id !== null)
      .map(entityId => state.itemRegistry.items.get(entityId)?.itemId)
      .filter((id): id is string => id !== undefined);

    if (!canUseLearnedRingSpell(state.player, abilityId, equippedItemIds)) {
      return {
        valid: false,
        rejectionCode: 'ABILITY_NOT_AVAILABLE',
        message: `Ring spell "${definition.name}" is not available. Learn it or equip the required ring.`,
      };
    }
  }

  // 4. Tile target validation (if targetPosition provided)
  if (targetPosition !== undefined) {
    // Check tile target exists and is walkable
    const targetKey = posKey(targetPosition);
    const targetCell = state.run.floor.cells.get(targetKey);

    if (targetCell === undefined || targetCell.tile.walkable !== true) {
      return {
        valid: false,
        rejectionCode: 'INVALID_TILE_TARGET',
        message: 'Target tile is not walkable.',
      };
    }

    // Check visibility
    if (targetCell.visibility !== 'visible') {
      return {
        valid: false,
        rejectionCode: 'TILE_NOT_VISIBLE',
        message: 'Target tile is not visible.',
      };
    }

    // Check not same as player position
    if (
      targetPosition.x === state.player.position.x
      && targetPosition.y === state.player.position.y
    ) {
      return {
        valid: false,
        rejectionCode: 'INVALID_TILE_TARGET',
        message: 'Cannot target your current location.',
      };
    }

    // Check not occupied by enemy
    if (state.run.enemies.get(targetKey) !== undefined) {
      return {
        valid: false,
        rejectionCode: 'TILE_OCCUPIED',
        message: 'Target tile is occupied by an enemy.',
      };
    }

    // Check not blocked by object
    if (state.run.objects.get(targetKey) !== undefined) {
      return {
        valid: false,
        rejectionCode: 'INVALID_TILE_TARGET',
        message: 'Target tile is blocked.',
      };
    }

    // Check range (if ring spell has range)
    if (ringSpell !== undefined) {
      const distance = chebyshevDistance(state.player.position, targetPosition);
      if (distance > ringSpell.range) {
        return {
          valid: false,
          rejectionCode: 'OUT_OF_RANGE',
          message: `Target is out of range. Maximum range is ${ringSpell.range}.`,
        };
      }
    }
  } else if (definition.tileTarget === true) {
    // Tile-target abilities require a target position
    return {
      valid: false,
      rejectionCode: 'MISSING_TILE_TARGET',
      message: `${definition.name} requires a target position.`,
    };
  }

  return { valid: true };
}
