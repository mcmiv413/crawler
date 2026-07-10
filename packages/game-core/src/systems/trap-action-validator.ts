import type { GameState, Direction, TrapItemTemplate, ObjectTemplate, AnyItemTemplate, ObjectInstance, EntityId } from '@dungeon/contracts';
import {
  OBJECT_TEMPLATES,
  ITEM_BY_ID,
  absoluteZeroTrap,
  blazingTrap,
  fireTrap,
  frostTrapItem,
  frozenTrap,
  infernoTrap,
  ironSpikeTrap,
  lethalPoisonTrap,
  lightningTrapItem,
  poisonGasTrap,
  steelSpikeTrap,
  thunderTrap,
  toxicTrap,
  woodenSpikeTrap,
} from '@dungeon/content';
import { moveInDirection } from '../utils/grid.js';
import { HAZARD_DAMAGE_TYPE_MAP } from './hazard-damage.js';
import { posKey } from '@dungeon/contracts';
import {
  WRONG_PHASE,
  INVALID_DIRECTION,
  NO_TRAP_TARGET,
  TRAP_NOT_DISARMABLE,
  TRAP_ITEM_NOT_FOUND,
  TRAP_TEMPLATE_NOT_FOUND,
  TRAP_ITEM_NOT_IN_INVENTORY,
  ITEM_NOT_FOUND,
  ITEM_NOT_TRAP,
  TILE_OCCUPIED,
  TILE_OCCUPIED_BY_ENEMY,
} from '../engine/rejection-codes.js';

/**
 * Result of a trap disarm action validation.
 *
 * On success, provides resolved data needed by the handler:
 * - adjacent position
 * - object key and instance
 * - trap object template
 * - recovered trap item template
 */
export type DisarmTrapValidationResult =
  | {
      readonly valid: true;
      readonly adjacentPos: { x: number; y: number };
      readonly objectKey: string;
      readonly trapObject: ObjectInstance;
      readonly trapTemplate: ObjectTemplate;
      readonly recoveredItemTemplate: AnyItemTemplate;
    }
  | {
      readonly valid: false;
      readonly rejectionCode: string;
      readonly message: string;
    };

/**
 * Result of a trap placement action validation.
 *
 * On success, provides resolved data needed by the handler:
 * - adjacent position
 * - trap item and its template
 * - hazard template for the trap
 */
export type SetTrapValidationResult =
  | {
      readonly valid: true;
      readonly adjacentPos: { x: number; y: number };
      readonly objectKey: string;
      readonly trapItem: AnyItemTemplate;
      readonly trapItemTemplate: TrapItemTemplate;
      readonly hazardTemplate: ObjectTemplate;
    }
  | {
      readonly valid: false;
      readonly rejectionCode: string;
      readonly message: string;
    };

/**
 * Validate a disarm trap action.
 *
 * Checks:
 * 1. State is in dungeon phase
 * 2. Direction is valid
 * 3. Adjacent tile has a trap object
 * 4. Object is a disarmable trap type
 * 5. Trap item mapping exists for the hazard type/rarity
 * 6. Trap item template exists in content
 *
 * Does not mutate state or emit events.
 */
export function validateDisarmTrapAction(
  state: GameState,
  direction: Direction,
): DisarmTrapValidationResult {
  // Guard: state is in dungeon phase
  if (state.run === null || state.phase !== 'dungeon') {
    return {
      valid: false,
      rejectionCode: WRONG_PHASE,
      message: 'You cannot disarm traps right now.',
    };
  }

  // Guard: direction is valid (moveInDirection will throw if not)
  let adjacentPos;
  try {
    adjacentPos = moveInDirection(state.player.position, direction);
  } catch {
    return {
      valid: false,
      rejectionCode: INVALID_DIRECTION,
      message: 'You cannot move that way.',
    };
  }

  const objKey = posKey(adjacentPos);
  const objAtPos = state.run.objects.get(objKey);

  // Guard: adjacent tile has an object
  if (objAtPos === undefined) {
    return {
      valid: false,
      rejectionCode: NO_TRAP_TARGET,
      message: 'There is no trap there.',
    };
  }

  // Guard: object is a hazard
  const template = OBJECT_TEMPLATES.get(objAtPos.templateId);
  if (template === undefined || template.isHazard !== true) {
    return {
      valid: false,
      rejectionCode: NO_TRAP_TARGET,
      message: 'There is no trap there.',
    };
  }

  // Guard: hazard type is disarmable
  if (!isDisarmableTrapType(template.hazardType ?? '')) {
    return {
      valid: false,
      rejectionCode: TRAP_NOT_DISARMABLE,
      message: 'That trap cannot be disarmed.',
    };
  }

  // Guard: trap item mapping exists
  const trapItemId = findTrapItemForHazard(
    template.hazardType === undefined ? '' : template.hazardType,
    template.rarity ?? 'common'
  );
  if (trapItemId === null) {
    return {
      valid: false,
      rejectionCode: TRAP_ITEM_NOT_FOUND,
      message: 'No disarm item found for this trap.',
    };
  }

  // Guard: trap item template exists
  const trapItemTemplate = ITEM_BY_ID.get(trapItemId);
  if (trapItemTemplate === undefined) {
    return {
      valid: false,
      rejectionCode: TRAP_TEMPLATE_NOT_FOUND,
      message: 'Trap item template not found.',
    };
  }

  return {
    valid: true,
    adjacentPos,
    objectKey: objKey,
    trapObject: objAtPos,
    trapTemplate: template,
    recoveredItemTemplate: trapItemTemplate,
  };
}

/**
 * Validate a set trap action.
 *
 * Checks:
 * 1. State is in dungeon phase
 * 2. Player has the trap item in inventory
 * 3. Trap item exists in item registry
 * 4. Item is a trap type
 * 5. Hazard template exists for the trap
 * 6. Direction is valid
 * 7. Adjacent tile is not occupied by an object
 * 8. Adjacent tile is not occupied by an enemy
 *
 * Does not mutate state or emit events.
 *
 * Note: Semantic checks (inventory, item type) are done BEFORE positional checks (direction, tile occupancy)
 * so that semantic errors (TRAP_ITEM_NOT_IN_INVENTORY) are reported before directional errors (INVALID_DIRECTION).
 */
export function validateSetTrapAction(
  state: GameState,
  direction: Direction,
  itemEntityId: EntityId,
): SetTrapValidationResult {
  // Guard: state is in dungeon phase
  if (state.run === null || state.phase !== 'dungeon') {
    return {
      valid: false,
      rejectionCode: WRONG_PHASE,
      message: 'You cannot place traps right now.',
    };
  }

  // Guard: player has the trap item in inventory (semantic check - do before positional checks)
  if (!state.player.inventory.includes(itemEntityId)) {
    return {
      valid: false,
      rejectionCode: TRAP_ITEM_NOT_IN_INVENTORY,
      message: 'You do not have that trap item.',
    };
  }

  // Guard: trap item exists in registry
  const trapItem = state.itemRegistry.items.get(itemEntityId);
  if (trapItem === undefined) {
    return {
      valid: false,
      rejectionCode: ITEM_NOT_FOUND,
      message: 'Item not found in inventory.',
    };
  }

  // Guard: item is a trap
  if (trapItem.itemClass !== 'trap') {
    return {
      valid: false,
      rejectionCode: ITEM_NOT_TRAP,
      message: 'That is not a trap item.',
    };
  }

  const trapItemTemplate = trapItem as TrapItemTemplate;

  // Guard: hazard template exists
  const hazardTemplate = OBJECT_TEMPLATES.get(trapItemTemplate.trapTemplateId);
  if (hazardTemplate === undefined) {
    return {
      valid: false,
      rejectionCode: TRAP_TEMPLATE_NOT_FOUND,
      message: 'Trap template not found.',
    };
  }

  // Guard: direction is valid (positional check - do after semantic checks)
  let adjacentPos;
  try {
    adjacentPos = moveInDirection(state.player.position, direction);
  } catch {
    return {
      valid: false,
      rejectionCode: INVALID_DIRECTION,
      message: 'You cannot move that way.',
    };
  }

  const objKey = posKey(adjacentPos);

  // Guard: adjacent tile is not occupied by an object
  if (state.run.objects.has(objKey)) {
    return {
      valid: false,
      rejectionCode: TILE_OCCUPIED,
      message: 'That tile is already occupied.',
    };
  }

  // Guard: adjacent tile is not occupied by an enemy
  for (const enemy of state.run.enemies.values()) {
    if (enemy.position.x === adjacentPos.x && enemy.position.y === adjacentPos.y) {
      return {
        valid: false,
        rejectionCode: TILE_OCCUPIED_BY_ENEMY,
        message: 'An enemy is blocking that tile.',
      };
    }
  }

  return {
    valid: true,
    adjacentPos,
    objectKey: objKey,
    trapItem,
    trapItemTemplate,
    hazardTemplate,
  };
}

/**
 * Check if a hazard type is disarmable.
 */
function isDisarmableTrapType(hazardType: string): boolean {
  return hazardType in HAZARD_DAMAGE_TYPE_MAP;
}

/**
 * Find a trap item that matches the given hazard type and rarity.
 */
function findTrapItemForHazard(hazardType: string, rarity: string): EntityId | null {
  const trapMap: Record<string, Record<string, string>> = {
    spike: {
      common: woodenSpikeTrap.itemId,
      uncommon: ironSpikeTrap.itemId,
      rare: steelSpikeTrap.itemId,
      epic: steelSpikeTrap.itemId,
    },
    fire: {
      common: fireTrap.itemId,
      uncommon: infernoTrap.itemId,
      rare: blazingTrap.itemId,
      epic: blazingTrap.itemId,
    },
    poison: {
      uncommon: poisonGasTrap.itemId,
      rare: toxicTrap.itemId,
      epic: lethalPoisonTrap.itemId,
    },
    frost: {
      uncommon: frostTrapItem.itemId,
      rare: frozenTrap.itemId,
      epic: absoluteZeroTrap.itemId,
    },
    lightning: {
      rare: lightningTrapItem.itemId,
      epic: thunderTrap.itemId,
    },
  };

  const trapItems = trapMap[hazardType];
  if (trapItems === undefined) return null;

  // Try exact match first, then fallback to epic variant
  const result = trapItems[rarity] ?? trapItems.epic ?? null;
  return result as EntityId | null;
}
