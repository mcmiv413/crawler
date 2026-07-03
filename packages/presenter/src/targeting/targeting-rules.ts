import type { EntityView } from '../game-view.js';

type Position = { readonly x: number; readonly y: number };
type WalkableCell = { readonly x: number; readonly y: number; readonly walkable: boolean };
type TrapEntityView = EntityView & { readonly isDisarmableTrap?: boolean };

/**
 * Pure targeting rules for both presenter and web layer.
 * Determines which enemies are valid targets for attacks and abilities.
 * Works with view types to avoid coupling to game-state internals.
 */
function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Get the effective range for an attack or ability.
 * For melee, returns 1. For ranged abilities, uses weapon range.
 */
export function getEffectiveRange(
  ability: { readonly isRanged?: boolean; readonly targetRange?: { readonly max: number; readonly min: number } } | null,
  weapon: { readonly weaponStats?: { readonly weaponRange?: number; readonly minRange?: number } } | null,
): { max: number; min: number } {
  if (ability?.targetRange !== undefined) {
    return ability.targetRange;
  }

  if (ability?.isRanged === true && weapon?.weaponStats !== undefined) {
    return {
      max: weapon.weaponStats.weaponRange ?? 1,
      min: weapon.weaponStats.minRange ?? 0,
    };
  }

  return { max: 1, min: 0 };
}

/**
 * Get all valid enemy targets (EntityView[]) for a targeting mode.
 * Returns enemies in range (default melee range 1).
 */
export function getValidEnemyTargets(
  enemies: readonly EntityView[],
  playerPos: Position,
  range: { readonly max: number; readonly min: number } = { max: 1, min: 0 },
): EntityView[] {
  const enemyEntities = enemies.filter((enemy) => enemy.type === 'enemy');

  return enemyEntities.filter((enemy) => {
    const distance = chebyshevDistance(playerPos, { x: enemy.x, y: enemy.y });
    return distance > 0 && distance <= range.max && distance >= range.min;
  });
}

/**
 * Determine if a targeted ability or attack should auto-fire or show a chooser.
 * - If 0 valid targets: return null (disabled)
 * - If 1 valid target: return that target (auto-fire)
 * - If 2+ valid targets: return null (show chooser)
 */
export function getAutoTargetOrShowChooser(
  targets: readonly EntityView[],
): EntityView | null {
  if (targets.length === 1) {
    return targets[0]!;
  }

  return null;
}

/**
 * Determine if an ability/attack is enabled based on targeting requirements.
 */
export function isTargetingActionEnabled(
  targetMode: string | undefined,
  validTargets: readonly EntityView[],
): boolean {
  if (targetMode === 'self' || targetMode === 'all_visible_enemies' || targetMode === 'aoe') {
    return true;
  }

  if (targetMode === 'single_enemy' || targetMode === 'attack') {
    return validTargets.length > 0;
  }

  return true;
}

/**
 * Get valid adjacent disarmable traps (for Disarm Trap ability).
 * Works with EntityView array of objects.
 */
export function getValidDisarmableTraps(
  playerPos: Position,
  objects: readonly EntityView[],
): EntityView[] {
  return objects.filter((obj) => {
    if (obj.type !== 'object') {
      return false;
    }

    const isDisarmableTrap = (obj as TrapEntityView).isDisarmableTrap === true;
    if (isDisarmableTrap !== true) {
      return false;
    }

    const position = { x: obj.x, y: obj.y };
    return chebyshevDistance(playerPos, position) === 1;
  });
}

/**
 * Get valid adjacent directions for trap placement.
 * Returns array of {x, y} positions that are walkable and not occupied by objects/enemies.
 */
export function getValidTrapPlacementDirections(
  playerPos: Position,
  objects: readonly EntityView[],
  enemies: readonly EntityView[],
  cells?: readonly WalkableCell[],
): Array<{ readonly x: number; readonly y: number }> {
  const occupiedPositions = new Set([
    ...enemies
      .filter((enemy) => enemy.type === 'enemy')
      .map((enemy) => `${enemy.x},${enemy.y}`),
    ...objects
      .filter((obj) => obj.type === 'object')
      .map((obj) => `${obj.x},${obj.y}`),
  ]);

  const walkablePositions = new Set(
    (cells ?? [])
      .filter((cell) => cell.walkable === true)
      .map((cell) => `${cell.x},${cell.y}`),
  );

  return [-1, 0, 1].flatMap((dx) => {
    return [-1, 0, 1].map((dy) => ({ dx, dy }));
  })
    .filter(({ dx, dy }) => dx !== 0 || dy !== 0)
    .map(({ dx, dy }) => ({ x: playerPos.x + dx, y: playerPos.y + dy }))
    .filter((position) => {
      const key = `${position.x},${position.y}`;
      return (walkablePositions.size === 0 || walkablePositions.has(key))
        && !occupiedPositions.has(key);
    });
}
