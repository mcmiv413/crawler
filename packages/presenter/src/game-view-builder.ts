import type { GameState, EnemyInstance, PlayerDiedEvent, EquipmentDroppedEvent } from '@dungeon/contracts';
import type { GameView, QuestView, InspectableEntityView, DeathContext } from './game-view.js';
import { ENEMY_TEMPLATES, STATUS_DEFINITIONS, OBJECT_TEMPLATES, DEATH_CONSEQUENCES } from '@dungeon/content';
import { buildPlayerHud } from './builders/player-hud-builder.js';
import { buildMapView } from './builders/map-view-builder.js';

function getEnemyColor(enemy: EnemyInstance): string {
  // Nemesis enemies are gold
  if (enemy.nemesisId) return '#ffd700';

  const damageType = enemy.equipment?.weapon?.damageType ?? 'physical';
  switch (damageType) {
    case 'fire': return '#ff4400';
    case 'frost': return '#44aaff';
    case 'poison': return '#44ff44';
    case 'shock': return '#ffff00';
    case 'corruption': return '#aa44ff';
    default: return '#ff4444';
  }
}
import { buildAvailableActions } from './builders/actions-builder.js';
import { buildTownView } from './builders/town-view-builder.js';
import { buildInventoryView } from './builders/inventory-view-builder.js';
import { buildDeathSummary } from './builders/death-summary-builder.js';

function buildInspectableEntities(state: GameState): readonly InspectableEntityView[] {
  if (!state.run) return [];

  const floor = state.run.floor;
  const seenTemplateIds = new Set<string>();
  const seenObjectKeys = new Set<string>();
  const playerX = state.player.position.x;
  const playerY = state.player.position.y;

  const mutableEntities: InspectableEntityView[] = [];

  // Build visible enemies — deduplicate by templateId (only show one of each type)
  for (const [key, enemy] of state.run.enemies) {
    if (floor.cells.get(key)?.visibility !== 'visible') continue;
    if (seenTemplateIds.has(enemy.templateId)) continue;
    seenTemplateIds.add(enemy.templateId);

    const template = ENEMY_TEMPLATES.get(enemy.templateId);
    if (!template) continue;

    mutableEntities.push({
      id: enemy.id,
      name: enemy.name,
      description: template.description,
      ascii: enemy.ascii,
      color: getEnemyColor(enemy),
      entityType: 'enemy',
      templateId: enemy.templateId,
      health: enemy.stats.health,
      maxHealth: enemy.stats.maxHealth,
      attack: enemy.stats.attack,
      defense: enemy.stats.defense,
      speed: enemy.stats.speed,
      tier: template.tier,
      archetype: template.archetype,
      isFasterThanPlayer: enemy.stats.speed > state.player.stats.speed,
      affinities: template.affinities && Object.keys(template.affinities).length > 0 ? template.affinities : undefined,
      statuses: enemy.statuses.map(s => STATUS_DEFINITIONS[s.id]?.name ?? s.id),
    });
  }

  // Build visible objects — deduplicate by location
  for (const [key, obj] of state.run.objects ?? new Map()) {
    if (floor.cells.get(key)?.visibility !== 'visible') continue;
    if (seenObjectKeys.has(key)) continue;
    seenObjectKeys.add(key);

    const template = OBJECT_TEMPLATES.get(obj.templateId);
    if (!template) continue;

    mutableEntities.push({
      id: obj.id,
      name: template.name,
      description: template.description,
      ascii: template.ascii,
      color: template.color,
      entityType: 'object',
      templateId: obj.templateId,
    });
  }

  // Sort: enemies first (by distance from player), then objects
  const sortComparator = (a: InspectableEntityView, b: InspectableEntityView): number => {
    const aIsEnemy = a.entityType === 'enemy';
    const bIsEnemy = b.entityType === 'enemy';

    // Enemies first
    if (aIsEnemy && !bIsEnemy) return -1;
    if (!aIsEnemy && bIsEnemy) return 1;

    // Both same type: sort by distance from player
    if (aIsEnemy && bIsEnemy) {
      const aPos = state.run!.enemies.get(a.id);
      const bPos = state.run!.enemies.get(b.id);
      if (!aPos || !bPos) return 0;
      const aDist = Math.hypot(aPos.position.x - playerX, aPos.position.y - playerY);
      const bDist = Math.hypot(bPos.position.x - playerX, bPos.position.y - playerY);
      return aDist - bDist;
    }

    return 0;
  };

  mutableEntities.sort(sortComparator);
  return mutableEntities;
}

function buildDeathContext(state: GameState): DeathContext | null {
  const eventHistory = state.world.eventHistory;
  const recentEvents = eventHistory.slice(Math.max(0, eventHistory.length - 30));
  
  // Find most recent death event (iterate backwards)
  let deathEvent: PlayerDiedEvent | null = null;
  for (let i = recentEvents.length - 1; i >= 0; i--) {
    const event = recentEvents[i];
    if (event && event.type === 'PLAYER_DIED') {
      deathEvent = event as PlayerDiedEvent;
      break;
    }
  }
  if (!deathEvent) return null;

  // Find most recent equipment dropped event (iterate backwards)
  let equipEvent: EquipmentDroppedEvent | null = null;
  for (let i = recentEvents.length - 1; i >= 0; i--) {
    const event = recentEvents[i];
    if (event && event.type === 'EQUIPMENT_DROPPED') {
      equipEvent = event as EquipmentDroppedEvent;
      break;
    }
  }

  const permadeathThreshold = Math.floor(
    DEATH_CONSEQUENCES.overkillPermadeathThreshold * state.player.stats.maxHealth
  );

  return {
    killerName: deathEvent.killerName,
    killerSpriteName: deathEvent.killerSpriteName,
    floor: deathEvent.floor,
    equipmentLost: equipEvent ? equipEvent.items : [],
    goldLost: deathEvent.goldLost,
    overkillDamage: deathEvent.overkillDamage,
    permadeathThreshold,
    totalDeaths: state.player.totalDeaths,
  };
}

/** Build a GameView from authoritative GameState */
export function buildGameView(state: GameState): GameView {
  return {
    gameId: state.gameId,
    phase: state.phase,
    player: buildPlayerHud(state),
    map: state.run ? buildMapView(state) : null,
    combatLog: [], // Filled by caller with formatted events
    availableActions: buildAvailableActions(state),
    town: state.phase === 'town' ? buildTownView(state) : null,
    inventory: buildInventoryView(state),
    activeQuests: (state.activeQuests ?? []).map((q): QuestView => ({
      id: q.id,
      title: q.title,
      description: q.description,
      status: q.status,
      rewardGold: q.rewardGold,
      giverNpcId: q.giverNpcId,
    })),
    runResult: state.phase === 'game_over'
      ? (state.run?.runMetrics?.causeOfEnd === 'victory'
        ? 'victory'
        : (state.run === null && state.world.eventHistory.some(e => e.type === 'PERMADEATH')
          ? 'permadeath'
          : 'death'))
      : null,
    deathStashFloor: state.player.deathStash?.floor ?? null,
    deathSummary: buildDeathSummary(state),
    deathContext: state.phase === 'town' && state.world.eventHistory.some(e => e.type === 'PLAYER_DIED')
      ? buildDeathContext(state)
      : null,
    inspectableEntities: buildInspectableEntities(state),
    debugMode: state.debugMode ?? false,
  };
}
