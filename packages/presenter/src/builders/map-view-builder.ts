import type { GameState, EnemyInstance, DamageType } from '@dungeon/contracts';
import { OBJECT_TEMPLATES, ENEMY_TEMPLATES, BIOMES } from '@dungeon/content';
import type { MapView, EntityView } from '../game-view.js';

function getDamageTypeColor(damageType: DamageType): string {
  switch (damageType) {
    case 'fire': return '#ff4400';
    case 'frost': return '#44aaff';
    case 'poison': return '#44ff44';
    case 'shock': return '#ffff00';
    case 'corruption': return '#aa44ff';
    case 'arcane': return '#dd44ff';
    case 'shadow': return '#333366';
    default: return '#ff4444';
  }
}

function getEnemyColor(enemy: EnemyInstance): string {
  // Nemesis enemies are gold
  if (enemy.nemesisId) return '#ffd700';

  // Prefer template color if set
  if (enemy.color) return enemy.color;

  const damageType = enemy.equipment?.weapon?.damageType ?? 'physical';
  return getDamageTypeColor(damageType);
}

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
        spriteName = 'large stairs up';
      } else if (cell.tile.type === 'stairs_down') {
        spriteName = 'large stairs down';
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
              case 'forest':
                spriteName = 'trunk b';
                break;
              case 'moss_caverns':
                spriteName = 'bright rock wall flat';
                break;
              case 'crystal_cave':
                spriteName = 'bright blue wall flat';
                break;
              case 'frozen_depths':
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
  const enemyEntities = Array.from(state.run.enemies)
    .filter(([key]) => floor.cells.get(key)?.visibility === 'visible')
    .map(([, enemy]): EntityView => {
      const template = ENEMY_TEMPLATES.get(enemy.templateId);
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
        isNemesis: !!enemy.nemesisId,
        nemesisName: enemy.nemesisId ? enemy.name : undefined,
        spriteName: template?.spriteName,
      };
    });

  // Build visible objects
  const objectEntities = Array.from(state.run.objects ?? new Map())
    .filter(([key]) => floor.cells.get(key)?.visibility === 'visible')
    .map(([key, obj]): EntityView => {
      const [x, y] = key.split(',').map(Number);
      const template = OBJECT_TEMPLATES.get(obj.templateId);
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
      };
    });

  return {
    width: floor.width,
    height: floor.height,
    cells: cellArray,
    entities: [playerEntity, ...enemyEntities, ...objectEntities],
    playerPosition: state.player.position,
    biomeId: floor.biomeId,
    dangerLevel: computeDangerLevel(floor.depth, state.player.level),
  };
}
