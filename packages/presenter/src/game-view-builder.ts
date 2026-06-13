import type { GameState, PlayerDiedEvent, EquipmentDroppedEvent, EntityId } from '@dungeon/contracts';
import type { GameView, QuestView, InspectableEntityView, DeathContext } from './game-view.js';
import { ENEMY_TEMPLATES, STATUS_DEFINITIONS, OBJECT_TEMPLATES, DEATH_CONSEQUENCES } from '@dungeon/content';
import { getEnemyCombatPreview } from '@dungeon/core';
import { getObjectiveText } from '@dungeon/core/systems/quest-progress.js';
import { buildPlayerHud } from './builders/player-hud-builder.js';
import { buildMapView } from './builders/map-view-builder.js';
import { buildGameNotices, findLatestDismissibleNotice } from './builders/game-notice-builder.js';
import { getEnemyColor } from './builders/entity-colors.js';
import { buildAvailableActions } from './builders/actions-builder.js';
import { buildTownView } from './builders/town-view-builder.js';
import { buildInventoryView } from './builders/inventory-view-builder.js';
import { buildDeathSummary } from './builders/death-summary-builder.js';

function buildInspectableEntities(state: GameState): readonly InspectableEntityView[] {
  if (!state.run) return [];

  const floor = state.run.floor;
  const seenObjectKeys = new Set<string>();
  const playerX = state.player.position.x;
  const playerY = state.player.position.y;

  const mutableEntities: InspectableEntityView[] = [];

  // Count visible enemies by templateId to determine when to show colors
  const visibleEnemies = Array.from(state.run.enemies.values()).filter(
    (e) => floor.cells.get(`${e.position.x},${e.position.y}`)?.visibility === 'visible'
  );
  const templateIdCounts = new Map<string, number>();
  for (const enemy of visibleEnemies) {
    templateIdCounts.set(enemy.templateId, (templateIdCounts.get(enemy.templateId) ?? 0) + 1);
  }

  // Build visible enemies — no deduplication, include instanceColor when 2+ of same type visible
  // Map enemy IDs to their position keys for use in sorting
  const enemyIdToPositionKey = new Map<EntityId, string>();
  for (const [key, enemy] of state.run.enemies) {
    if (floor.cells.get(key)?.visibility === 'visible') {
      enemyIdToPositionKey.set(enemy.id, key);
    }
  }

  for (const [key, enemy] of state.run.enemies) {
    if (floor.cells.get(key)?.visibility !== 'visible') continue;

    const template = ENEMY_TEMPLATES.get(enemy.templateId);
    if (!template) continue;

    // Only show instanceColor if there are 2+ of this templateId visible
    const showInstanceColor = templateIdCounts.get(enemy.templateId) ?? 0 >= 2;

    const preview = getEnemyCombatPreview(state, enemy);

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
      isFasterThanPlayer: preview.isFasterThanPlayer,
      affinities: template.affinities && Object.keys(template.affinities).length > 0 ? template.affinities : undefined,
      statuses: enemy.statuses.map(s => STATUS_DEFINITIONS.get(s.id)?.name ?? s.id),
      threatRating: preview.threatRating,
      instanceColor: showInstanceColor ? enemy.instanceColor : undefined,
      playerHitChance: preview.playerHitChance,
      enemyHitChance: preview.enemyHitChance,
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
      const aPositionKey = enemyIdToPositionKey.get(a.id as EntityId);
      const bPositionKey = enemyIdToPositionKey.get(b.id as EntityId);
      const aPos = aPositionKey ? state.run!.enemies.get(aPositionKey) : undefined;
      const bPos = bPositionKey ? state.run!.enemies.get(bPositionKey) : undefined;
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
  const notices = buildGameNotices(state);
  const notice = findLatestDismissibleNotice(notices);

  return {
    gameId: state.gameId,
    phase: state.phase,
    player: buildPlayerHud(state),
    map: state.run ? buildMapView(state) : null,
    combatLog: [], // Filled by caller with formatted events
    animatedEvents: [], // Filled by caller with buildAnimationSequence
    availableActions: buildAvailableActions(state),
    town: state.phase === 'town' ? buildTownView(state) : null,
    inventory: buildInventoryView(state),
    activeQuests: (state.activeQuests ?? []).map((q): QuestView => ({
      id: q.id,
      title: q.title,
      description: q.description,
      status: q.status,
      objectiveText: getObjectiveText(q),
      progress: q.objective.progress,
      rewardGold: q.reward.amount ?? q.rewardGold ?? 0,
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
    notice,
    notices,
  };
}
