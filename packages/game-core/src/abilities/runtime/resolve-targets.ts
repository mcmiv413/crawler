import type { Direction, EnemyInstance, EntityId, Position } from '@dungeon/contracts';
import type { AbilityContext, AbilityTargeting, TargetSelector } from '../types.js';

const DIRECTION_DELTAS: Readonly<Record<Direction, Position>> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  NE: { x: 1, y: -1 },
  NW: { x: -1, y: -1 },
  SE: { x: 1, y: 1 },
  SW: { x: -1, y: 1 },
};

/**
 * Resolve target(s) based on the targeting specification.
 * If a targetId is provided, it takes precedence over the targeting definition's requestedTargetId.
 */
export function resolveTargets(
  context: AbilityContext,
  targeting: AbilityTargeting,
  targetId?: EntityId,
): Array<{ enemy: EnemyInstance; key: string }> {
  // Use the provided targetId, falling back to the definition's requestedTargetId
  const requestedId = targetId ?? targeting.requestedTargetId;
  return resolveSelector(context, targeting.selector, requestedId);
}

function resolveSelector(
  context: AbilityContext,
  selector: TargetSelector,
  requestedTargetId?: EntityId,
): Array<{ enemy: EnemyInstance; key: string }> {
  if (context.run === null) {
    return [];
  }

  switch (selector.kind) {
    case 'self':
      return [];

    case 'single_enemy': {
      if (requestedTargetId === undefined) {
        return [];
      }
      for (const [key, enemy] of context.run.enemies) {
        if (enemy.id === requestedTargetId) {
          return [{ enemy, key }];
        }
      }
      return [];
    }

    case 'nearest_enemy_melee': {
      // Find nearest enemy within melee range (distance <= 1)
      let nearest: { enemy: EnemyInstance; key: string } | null = null;
      let minDist = Infinity;

      for (const [key, enemy] of context.run.enemies) {
        const dist = Math.abs(context.player.position.x - enemy.position.x) +
                     Math.abs(context.player.position.y - enemy.position.y);
        if (dist <= 1 && dist < minDist) {
          minDist = dist;
          nearest = { enemy, key };
        }
      }

      return nearest !== null ? [nearest] : [];
    }

    case 'nearest_visible_enemy': {
      // Find nearest visible enemy (for now, all enemies are "visible" if not hidden)
      let nearest: { enemy: EnemyInstance; key: string } | null = null;
      let minDist = Infinity;

      for (const [key, enemy] of context.run.enemies) {
        const dist = Math.abs(context.player.position.x - enemy.position.x) +
                     Math.abs(context.player.position.y - enemy.position.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = { enemy, key };
        }
      }

      return nearest !== null ? [nearest] : [];
    }

    case 'all_visible_enemies': {
      return Array.from(context.run.enemies)
        .filter(([key]) => context.run!.floor.cells.get(key)?.visibility === 'visible')
        .map(([key, enemy]) => ({ enemy, key }));
    }

    case 'line_from_player': {
      if (context.direction === undefined) {
        return [];
      }

      const delta = DIRECTION_DELTAS[context.direction];
      const linePositions = Array.from({ length: selector.range }, (_, index) => ({
        x: context.player.position.x + delta.x * (index + 1),
        y: context.player.position.y + delta.y * (index + 1),
      }));

      return linePositions.flatMap((position) => {
        const target = Array.from(context.run!.enemies.entries()).find(([, enemy]) =>
          enemy.position.x === position.x && enemy.position.y === position.y,
        );
        if (target === undefined) return [];
        const [key, enemy] = target;
        const cell = context.run!.floor.cells.get(key);
        return cell?.visibility === 'visible' ? [{ enemy, key }] : [];
      });
    }

    case 'target_plus_adjacent_enemies': {
      if (context.target !== undefined) {
        const tx = context.target.instance.position.x;
        const ty = context.target.instance.position.y;
        const adjacentTargets = Array.from(context.run.enemies)
          .filter(([, enemy]) => enemy.id !== context.target!.instance.id)
          .filter(([key, enemy]) => {
          const dx = Math.abs(enemy.position.x - tx);
          const dy = Math.abs(enemy.position.y - ty);
            return dx <= 1 && dy <= 1 && context.run!.floor.cells.get(key)?.visibility === 'visible';
          })
          .map(([key, enemy]) => ({ enemy, key }));

        return [{ enemy: context.target.instance, key: context.target.key }, ...adjacentTargets];
      }

      return [];
    }

    case 'custom':
      return [];

    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new Error(`Unknown selector kind: ${(selector as any).kind}`);

  }
}
