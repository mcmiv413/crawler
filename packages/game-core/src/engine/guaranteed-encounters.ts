import type { DungeonFloor, EnemyInstance, GameState, Position, WorldState } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import { ENEMY_TEMPLATES } from '@dungeon/content';
import { createEnemyInstance, assignInstanceColors } from '../generation/enemy-instantiation.js';
import { chebyshevDistance } from '../utils/grid.js';
import type { SeededRNG } from '../utils/rng.js';

export function countGuaranteedEncountersForFloor(
  state: GameState,
  world: WorldState,
  depth: number,
  biomeId: string,
): number {
  let count = 0;

  for (const faction of world.factions) {
    const leader = faction.leader;
    if (faction.status !== 'led' || leader === null || leader.isActive !== true) {
      continue;
    }
    if (isEntityPresentAnywhere(state, leader.id) || !isTemplateEligibleForFloor(leader.templateId, depth, biomeId)) {
      continue;
    }
    count += 1;
  }

  const dungeonOgreId = entityId('dungeon_ogre');
  if (
    world.dungeonOgre.status === 'emerged'
    && world.dungeonOgre.selectedSpawnDepth === depth
    && isEntityPresentAnywhere(state, dungeonOgreId) !== true
  ) {
    count += 1;
  }

  return count;
}

export function applyGuaranteedEncounters(
  state: GameState,
  world: WorldState,
  floor: DungeonFloor,
  enemies: ReadonlyMap<string, EnemyInstance>,
  rng: SeededRNG,
): ReadonlyMap<string, EnemyInstance> {
  const updatedEnemies = new Map(enemies);

  for (const faction of world.factions) {
    const leader = faction.leader;
    if (faction.status !== 'led' || leader === null || leader.isActive !== true) {
      continue;
    }
    if (hasEnemyId(updatedEnemies, leader.id) || isEntityPresentAnywhere(state, leader.id)) {
      continue;
    }
    if (!isTemplateEligibleForFloor(leader.templateId, floor.depth, floor.biomeId)) {
      continue;
    }

    const template = ENEMY_TEMPLATES.get(leader.templateId);
    const position = findGuaranteedEncounterPosition(floor, updatedEnemies, rng);
    if (template === undefined || position === null) {
      continue;
    }

    removeOccupantAtPosition(updatedEnemies, position);
    updatedEnemies.set(posKey(position), createEnemyInstance(template, position, floor.depth, {
      id: leader.id,
      name: `${leader.name} ${leader.title}`,
      skipFactionStrength: true,
    }));
  }

  const dungeonOgreId = entityId('dungeon_ogre');
  if (
    world.dungeonOgre.status === 'emerged'
    && world.dungeonOgre.selectedSpawnDepth === floor.depth
    && !hasEnemyId(updatedEnemies, dungeonOgreId)
    && isEntityPresentAnywhere(state, dungeonOgreId) !== true
  ) {
    const template = ENEMY_TEMPLATES.get('dungeon_ogre');
    const position = findGuaranteedEncounterPosition(floor, updatedEnemies, rng);
    if (template !== undefined && position !== null) {
      removeOccupantAtPosition(updatedEnemies, position);
      updatedEnemies.set(posKey(position), createEnemyInstance(template, position, floor.depth, {
        id: dungeonOgreId,
        skipFactionStrength: true,
      }));
    }
  }

  return assignInstanceColors(updatedEnemies);
}

function hasEnemyId(
  enemies: ReadonlyMap<string, EnemyInstance> | Map<string, EnemyInstance>,
  enemyId: EnemyInstance['id'],
): boolean {
  return [...enemies.values()].some(enemy => enemy.id === enemyId);
}

function findGuaranteedEncounterPosition(
  floor: DungeonFloor,
  enemies: ReadonlyMap<string, EnemyInstance>,
  rng: SeededRNG,
): Position | null {
  const candidates = Array.from(floor.cells)
    .filter(([key, cell]) => {
      if (cell.tile.walkable !== true) {
        return false;
      }

      const [x, y] = key.split(',').map(Number);
      const position = { x: x!, y: y! };
      if (key === posKey(floor.entrance) || key === posKey(floor.exit)) {
        return false;
      }

      return chebyshevDistance(position, floor.entrance) > 2;
    })
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x!, y: y! };
    });

  const openPositions = candidates.filter(position => !enemies.has(posKey(position)));
  if (openPositions.length > 0) {
    return rng.pick(openPositions);
  }

  if (candidates.length === 0) {
    return null;
  }

  const mutableCandidates = [...candidates];
  mutableCandidates.sort((left, right) =>
    chebyshevDistance(right, floor.entrance) - chebyshevDistance(left, floor.entrance));
  return mutableCandidates[0] ?? null;
}

function removeOccupantAtPosition(enemies: Map<string, EnemyInstance>, position: Position): void {
  enemies.delete(posKey(position));
}

function isTemplateEligibleForFloor(templateId: string, depth: number, biomeId: string): boolean {
  const template = ENEMY_TEMPLATES.get(templateId);
  if (template === undefined) {
    return false;
  }

  const [minDepth, maxDepth] = template.spawn.floorRange;
  if (depth < minDepth || depth > maxDepth) {
    return false;
  }

  return template.biomes?.some(biome => biome.biomeId === biomeId) ?? true;
}

function isEntityPresentAnywhere(
  state: GameState,
  entityIdToFind: EnemyInstance['id'],
): boolean {
  if (state.run?.enemies && hasEnemyId(state.run.enemies, entityIdToFind)) {
    return true;
  }

  for (const floor of state.run?.floorCache?.values() ?? []) {
    if (hasEnemyId(floor.enemies, entityIdToFind)) {
      return true;
    }
  }

  for (const floor of state.persistedFloorCache?.values() ?? []) {
    if (hasEnemyId(floor.enemies, entityIdToFind)) {
      return true;
    }
  }

  return false;
}
