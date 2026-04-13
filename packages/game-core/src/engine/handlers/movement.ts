import type {
  GameState, DomainEvent, Direction,
} from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { ITEM_BY_ID, OBJECT_TEMPLATES } from '@dungeon/content';
import type { SeededRNG } from '../../utils/rng.js';
import type { CommandResult } from './shared.js';
import { updateRunMetrics } from './shared.js';
import { validateMove } from '../../systems/movement.js';
import { computeFov } from '../../systems/fov.js';
import { moveInDirection } from '../../utils/grid.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { rollChestLoot } from '../../systems/loot.js';
import { addItemToInventory } from '../../systems/inventory.js';
import { handleAttack } from './combat.js';

export function handleMove(
  state: GameState,
  direction: Direction,
  rng: SeededRNG,
): CommandResult {
  const validation = validateMove(state, direction);
  if (!validation.valid || !validation.newPosition) {
    // Bump-to-attack: if blocked by enemy, attack that enemy
    if (validation.reason === 'Tile occupied by enemy' && state.run) {
      try {
        const targetPos = moveInDirection(state.player.position, direction);
        for (const enemy of state.run.enemies.values()) {
          if (enemy.position.x === targetPos.x && enemy.position.y === targetPos.y) {
            return handleAttack(state, enemy.id, rng);
          }
        }
      } catch {
        // If moveInDirection fails (invalid direction), just return empty result
        return { state, events: [], runEnded: false };
      }
    }
    return { state, events: [], runEnded: false };
  }

  const newPos = validation.newPosition;
  let events: DomainEvent[] = [];

  events = [...events, {
    type: 'PLAYER_MOVED',
    from: state.player.position,
    to: newPos,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  }];

  let newState: GameState = {
    ...state,
    player: { ...state.player, position: newPos },
    turnNumber: state.turnNumber + 1,
  };

  // Track turn elapsed
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Recompute FOV after movement
  if (newState.run !== null) {
    const updatedCells = computeFov(newState.run.floor, newPos);
    const updatedFloor = { ...newState.run.floor, cells: updatedCells };
    newState = {
      ...newState,
      run: { ...newState.run, floor: updatedFloor },
    };
  }

  // Process enemy turns with player speed for kiting system, then tick ability cooldowns
  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;
  events = [...events, ...enemyResult.events];
  newState = tickAbilityCooldowns(newState);

  const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
  return { state: newState, events, runEnded };
}

export function handleWait(state: GameState, rng: SeededRNG): CommandResult {
  let newState = { ...state, turnNumber: state.turnNumber + 1 };
  let events: DomainEvent[] = [];
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;
  events = [...events, ...enemyResult.events];
  newState = tickAbilityCooldowns(newState);

  const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
  return { state: newState, events, runEnded };
}

export function handleInteract(
  state: GameState,
  targetPosition: { x: number; y: number },
  rng: SeededRNG,
): CommandResult {
  if (state.run === null) return { state, events: [], runEnded: false };

  const key = posKey(targetPosition);
  const obj = state.run.objects.get(key);
  if (obj === undefined) return { state, events: [], runEnded: false };

  const template = OBJECT_TEMPLATES.get(obj.templateId);
  if (template === undefined) return { state, events: [], runEnded: false };

  let newState = state;
  let events: DomainEvent[] = [];
  let gotLoot = false;

  // Apply health delta if any
  if (template.healthDelta !== 0) {
    const healthBefore = newState.player.stats.health;
    const newHealth = Math.max(0, healthBefore + template.healthDelta);
    newState = {
      ...newState,
      player: {
        ...newState.player,
        stats: {
          ...newState.player.stats,
          health: newHealth,
        },
      },
    };
  }

  // Roll loot if object has lootTableId
  if (template.lootTableId !== undefined && template.lootTableId !== '') {
    const lootItemId = rollChestLoot(newState.run!.floor.depth, rng);
    if (lootItemId !== null) {
      const itemTemplate = ITEM_BY_ID.get(lootItemId);
      if (itemTemplate !== undefined) {
        const inventoryResult = addItemToInventory(newState, itemTemplate);
        newState = inventoryResult.state;
        events = [...events, ...inventoryResult.events];
        gotLoot = true;
      }
    }
  }

  // Emit object interacted event
  events = [...events, {
    type: 'OBJECT_INTERACTED',
    objectId: obj.id,
    objectName: template.name,
    position: targetPosition,
    healthDelta: template.healthDelta,
    gotLoot,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  }];

  // Increment turn
  newState = { ...newState, turnNumber: newState.turnNumber + 1 };
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Remove object from map if consumable
  if (template.consumable === true) {
    const newObjects = new Map(newState.run!.objects);
    newObjects.delete(key);
    newState = {
      ...newState,
      run: { ...newState.run!, objects: newObjects },
    };
  }

  // Process enemy turns with player speed for kiting system and tick cooldowns
  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;
  events = [...events, ...enemyResult.events];
  newState = tickAbilityCooldowns(newState);

  const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
  return { state: newState, events, runEnded };
}
