import type { GameState, EnemyInstance, PlayerDiedEvent, EquipmentDroppedEvent, DomainEvent, EntityId } from '@dungeon/contracts';
import type { GameView, QuestView, InspectableEntityView, DeathContext } from './game-view.js';
import { ENEMY_TEMPLATES, STATUS_DEFINITIONS, OBJECT_TEMPLATES, DEATH_CONSEQUENCES, COMBAT } from '@dungeon/content';
import { calculateHitChance, applyRangeAccuracyPenalty } from '@dungeon/core/utils/dice.js';
import { chebyshevDistance } from '@dungeon/core/utils/grid.js';
import { getEffectiveStat } from '@dungeon/core/systems/status-effects.js';
import { getObjectiveText } from '@dungeon/core/systems/quest-progress.js';
import { buildPlayerHud } from './builders/player-hud-builder.js';
import { buildMapView } from './builders/map-view-builder.js';

function getEnemyColor(enemy: EnemyInstance): string {
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

function computeThreatRating(enemy: EnemyInstance, state: GameState): 'Low' | 'Moderate' | 'High' | 'Deadly' {
  const playerStats = state.player.stats;
  const enemyStats = enemy.stats;

  // Estimate mid-band damage
  const enemyMidBand = Math.round(enemyStats.attack * 1);
  const playerMidBand = Math.round(playerStats.attack * 1);

  // Calculate hits to kill
  const hitsToKillPlayer = Math.ceil(playerStats.health / Math.max(1, enemyMidBand));
  const hitsToKillEnemy = Math.ceil(enemyStats.health / Math.max(1, playerMidBand));

  // Get range info
  const enemyRange = enemy.equipment?.weapon?.weaponRange ?? 1;
  const playerRange = (() => {
    if (state.player.equipment.weapon === null) return 1;
    const wt = state.itemRegistry.items.get(state.player.equipment.weapon);
    if (wt && wt.itemClass === 'weapon') {
      const weapon = (wt as { weapon: { weaponRange: number } }).weapon;
      return weapon.weaponRange ?? 1;
    }
    return 1;
  })();

  // Speed comparison
  const enemyFaster = enemyStats.speed > playerStats.speed;

  // Deadly conditions
  if (hitsToKillPlayer <= 2) return 'Deadly';
  if (enemyFaster && enemyRange > playerRange) return 'Deadly';

  // High conditions
  if (hitsToKillPlayer === 3) return 'High';
  if (enemyFaster && enemyRange > 1) return 'High';
  if (hitsToKillEnemy >= 5) return 'High';

  // Moderate conditions
  if (hitsToKillPlayer >= 4 && hitsToKillPlayer <= 5) return 'Moderate';
  if (enemyRange > playerRange) return 'Moderate';
  if (enemyFaster) return 'Moderate';

  // Low condition
  return 'Low';
}

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

    // Calculate distance and hit chances
    const dist = chebyshevDistance(state.player.position, enemy.position);
    
    // Player hit chance (with range penalty)
    let playerAccuracy = getEffectiveStat(state.player.stats.accuracy, 'accuracy', state.player.statuses);
    let playerWeaponRange = 1;
    let playerMinRange = 0;
    if (state.player.equipment.weapon !== null) {
      const wt = state.itemRegistry.items.get(state.player.equipment.weapon);
      if (wt?.itemClass === 'weapon') {
        const weapon = (wt as { weapon: { weaponRange: number; minRange?: number } }).weapon;
        playerWeaponRange = weapon.weaponRange;
        playerMinRange = weapon.minRange ?? 0;
      }
    }
    if (playerWeaponRange > 1 || playerMinRange > 0) {
      playerAccuracy = applyRangeAccuracyPenalty(playerAccuracy, dist, playerMinRange, COMBAT.rangedAccuracyDropPerTile);
    }
    const playerHitChance = calculateHitChance(
      COMBAT.baseHitChance,
      playerAccuracy,
      enemy.stats.evasion,
      COMBAT.minHitChance,
      COMBAT.maxHitChance,
    );

    // Enemy hit chance (with range penalty)
    let enemyAccuracy = getEffectiveStat(enemy.stats.accuracy, 'accuracy', enemy.statuses);
    let enemyWeaponRange = 1;
    let enemyMinRange = 0;
     
    if (enemy.equipment?.weapon) {
      enemyWeaponRange = enemy.equipment.weapon.weaponRange;
      enemyMinRange = enemy.equipment.weapon.minRange ?? 0;
    }
    if (enemyWeaponRange > 1 || enemyMinRange > 0) {
      enemyAccuracy = applyRangeAccuracyPenalty(enemyAccuracy, dist, enemyMinRange, COMBAT.rangedAccuracyDropPerTile);
    }
    const enemyHitChance = calculateHitChance(
      COMBAT.baseHitChance,
      enemyAccuracy,
      state.player.stats.evasion,
      COMBAT.minHitChance,
      COMBAT.maxHitChance,
    );

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
      statuses: enemy.statuses.map(s => STATUS_DEFINITIONS.get(s.id)?.name ?? s.id),
      threatRating: computeThreatRating(enemy, state),
      instanceColor: showInstanceColor ? enemy.instanceColor : undefined,
      playerHitChance,
      enemyHitChance,
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

function buildNotice(event: DomainEvent, index: number): GameView['notice'] | undefined {
  switch (event.type) {
    case 'FACTION_LEADER_EMERGED': {
      const spriteName = ENEMY_TEMPLATES.get(event.leaderTemplateId)?.spriteName;
      return {
        id: `faction_leader_emerged_${index}`,
        kind: event.type,
        title: 'Faction Leader Emerged',
        message: `${event.leaderName}, ${event.leaderTitle}, now leads the ${event.factionName}.`,
        detail: `A new leader rose on floor ${event.emergedOnDepth}. Break the faction to stop its pressure.`,
        spriteName,
      };
    }
    case 'FACTION_LEADER_SLAIN':
      return {
        id: `faction_leader_slain_${index}`,
        kind: event.type,
        title: 'Faction Leader Slain',
        message: `${event.leaderName}, ${event.leaderTitle}, has been slain.`,
        detail: `${event.factionName} is broken.`,
      };
    case 'DUNGEON_OGRE_EMERGED': {
      const eligibleDepths = event.eligibleSpawnDepths.join(', ');
      return {
        id: `dungeon_ogre_emerged_${index}`,
        kind: event.type,
        title: 'Dungeon Ogre Emerged',
        message: `The Dungeon Ogre has claimed floor ${event.selectedSpawnDepth}.`,
        detail: `Eligible depths were ${eligibleDepths}. Its lair will stay fixed until you slay it.`,
        spriteName: ENEMY_TEMPLATES.get('dungeon_ogre')?.spriteName,
      };
    }
    case 'EQUIP_BLOCKED':
      return {
        id: `equip_blocked_${index}`,
        kind: event.type,
        title: 'Equipment Blocked',
        message: event.reason,
      };
    default:
      return undefined;
  }
}

/** Build a GameView from authoritative GameState */
export function buildGameView(state: GameState): GameView {
  let notice: GameView['notice'];
  for (let i = state.world.eventHistory.length - 1; i >= 0; i -= 1) {
    const evt = state.world.eventHistory[i]!;
    notice = buildNotice(evt, i);
    if (notice !== undefined) {
      break;
    }
  }

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
  };
}
