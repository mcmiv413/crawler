import type { GameState } from '@dungeon/contracts';
import { OBJECT_TEMPLATES, ENEMY_TEMPLATES, BIOMES, forest, mossCaverns, crystalCave, frozenDepths } from '@dungeon/content';
import type { MapView, EntityView } from '../game-view.js';
import { getEnemyColor } from './entity-colors.js';

// Sprite names for map rendering - using left-facing variants for map consistency
const STAIRS_UP_SPRITE = 'staircase up left';
const STAIRS_DOWN_SPRITE = 'staircase down left';

function computeDangerLevel(depth: number, playerLevel: number): 'safe' | 'moderate' | 'dangerous' | 'deadly' {
  const diff = depth - playerLevel;
  if (diff <= -2) return 'safe';
  if (diff <= 0) return 'moderate';
  if (diff <= 2) return 'dangerous';
  return 'deadly';
}

export function buildMapView(state: GameState): MapView | null {
  if (!state.run) return null;
  const floor = state.run.floor;
  const biome = BIOMES.get(floor.biomeId);

  // Build cell views — only visible + remembered
  const cellArray = Array.from(floor.cells)
    .filter(([, cell]) => cell.visibility !== 'hidden')
    .map(([key, cell]) => {
      const [x, y] = key.split(',').map(Number);
      const dimmed = cell.visibility === 'remembered';

      // Determine sprite name based on tile type and biome
      let spriteName: string | undefined;

      // Stairs sprites are universal, not biome-specific
      if (cell.tile.type === 'stairs_up') {
        spriteName = STAIRS_UP_SPRITE;
      } else if (cell.tile.type === 'stairs_down') {
        spriteName = STAIRS_DOWN_SPRITE;
      } else if (biome?.tileSprites) {
        // Other tile types use biome-specific sprites
        if (cell.tile.type === 'floor') {
          spriteName = biome.tileSprites.floor;
        } else if (cell.tile.type === 'wall') {
          spriteName = biome.tileSprites.wall;
          // Add organic variation to walls in cellular biomes
          const variation = (x! + y! * 7) % 2;
          if (variation === 1) {
            switch (biome.biomeId) {
              case forest.biomeId:
                spriteName = 'trunk b';
                break;
              case mossCaverns.biomeId:
                spriteName = 'bright rock wall flat';
                break;
              case crystalCave.biomeId:
                spriteName = 'bright blue wall flat';
                break;
              case frozenDepths.biomeId:
                spriteName = 'bright ice wall flat';
                break;
            }
          }
        } else if (cell.tile.type === 'door') {
          spriteName = biome.tileSprites.interactable;
        }
      }

      return {
        x: x!,
        y: y!,
        ascii: cell.tile.ascii,
        color: dimmed ? '#555' : cell.tile.color,
        bgColor: dimmed ? '#111' : '#1a1a1a',
        visibility: cell.visibility,
        walkable: cell.tile.walkable,
        tileType: cell.tile.type,
        spriteName,
      };
    });

  // Build player entity
  const playerEntity: EntityView = {
    id: state.player.id,
    x: state.player.position.x,
    y: state.player.position.y,
    ascii: '@',
    color: '#fff',
    name: state.player.name,
    type: 'player',
    health: state.player.stats.health,
    maxHealth: state.player.stats.maxHealth,
    templateId: null,
  };

  // Build visible enemies
  const visibleEnemies = Array.from(state.run.enemies)
    .filter(([key]) => floor.cells.get(key)?.visibility === 'visible')
    .map(([, enemy]) => enemy);

  // Count visible enemies by templateId to determine which should show instance colors
  const templateIdCounts = new Map<string, number>();
  for (const enemy of visibleEnemies) {
    templateIdCounts.set(enemy.templateId, (templateIdCounts.get(enemy.templateId) ?? 0) + 1);
  }

  const enemyEntities = visibleEnemies.map((enemy): EntityView => {
    const template = ENEMY_TEMPLATES.get(enemy.templateId);
    const showInstanceColor = (templateIdCounts.get(enemy.templateId) ?? 0) >= 2;
    return {
      id: enemy.id,
      x: enemy.position.x,
      y: enemy.position.y,
      ascii: enemy.ascii,
      color: getEnemyColor(enemy),
      name: enemy.name,
      type: 'enemy',
      health: enemy.stats.health,
      maxHealth: enemy.stats.maxHealth,
      templateId: enemy.templateId,
      spriteName: template?.spriteName,
      instanceColor: showInstanceColor ? enemy.instanceColor : undefined,
    };
  });

  // Build visible objects
  const objectEntities = Array.from(state.run.objects ?? new Map())
    .filter(([key]) => floor.cells.get(key)?.visibility === 'visible')
    .map(([key, obj]): EntityView => {
      const [x, y] = key.split(',').map(Number);
      const template = OBJECT_TEMPLATES.get(obj.templateId);
      const isDisarmableTrap = template?.objectCategory === 'trap' && template?.hazardType !== undefined;
      return {
        id: obj.id,
        x: x!,
        y: y!,
        ascii: template?.ascii ?? '?',
        color: template?.color ?? '#fff',
        name: template?.name ?? obj.templateId,
        type: 'object',
        templateId: obj.templateId,
        spriteName: template?.spriteName,
        objectCategory: template?.objectCategory,
        isDisarmableTrap,
        hazardType: template?.hazardType,
      };
    });

  return {
    width: floor.width,
    height: floor.height,
    cells: cellArray,
    entities: [...objectEntities, ...enemyEntities, playerEntity],
    playerPosition: state.player.position,
    biomeId: floor.biomeId,
    dangerLevel: computeDangerLevel(floor.depth, state.player.level),
  };
}
