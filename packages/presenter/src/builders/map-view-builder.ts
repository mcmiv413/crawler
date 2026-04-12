import type { GameState, EnemyInstance, DamageType } from '@dungeon/contracts';
import { OBJECT_TEMPLATES } from '@dungeon/content';
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

  // Build cell views — only visible + remembered
  const cellArray = Array.from(floor.cells)
    .filter(([, cell]) => cell.visibility !== 'hidden')
    .map(([key, cell]) => {
      const [x, y] = key.split(',').map(Number);
      const dimmed = cell.visibility === 'remembered';
      return {
        x: x!,
        y: y!,
        ascii: cell.tile.ascii,
        color: dimmed ? '#555' : cell.tile.color,
        bgColor: dimmed ? '#111' : '#1a1a1a',
        visibility: cell.visibility,
        walkable: cell.tile.walkable,
        tileType: cell.tile.type,
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
    .map(([, enemy]): EntityView => ({
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
    }));

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
