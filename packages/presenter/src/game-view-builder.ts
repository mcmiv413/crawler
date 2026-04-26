import type { GameState, EnemyInstance, PlayerDiedEvent, EquipmentDroppedEvent, DomainEvent } from '@dungeon/contracts';
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
import type { NemesisView } from './game-view.js';

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
  const enemyRange = enemy.equipment?.weapon?.range ?? 1;
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
  for (const [key, enemy] of state.run.enemies) {
    if (floor.cells.get(key)?.visibility !== 'visible') continue;

    const template = ENEMY_TEMPLATES.get(enemy.templateId);
    if (!template) continue;

    // Only show instanceColor if there are 2+ of this templateId visible
    const showInstanceColor = templateIdCounts.get(enemy.templateId) ?? 0 >= 2;

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
  // Find most recent NEMESIS_SLAIN event in current run
  let recentlyDefeatedNemesis: NemesisView | null = null;
  if (state.run) {
    let nemesisSslainEvent: Extract<DomainEvent, { type: 'NEMESIS_SLAIN' }> | null = null;
    for (let i = state.world.eventHistory.length - 1; i >= 0; i -= 1) {
      if (state.world.eventHistory[i]!.type === 'NEMESIS_SLAIN') {
        nemesisSslainEvent = state.world.eventHistory[i] as Extract<DomainEvent, { type: 'NEMESIS_SLAIN' }>;
        break;
      }
    }

    if (nemesisSslainEvent) {
      const nemesis = state.world.nemeses.find(n => n.id === nemesisSslainEvent.nemesisId);
      if (nemesis) {
        recentlyDefeatedNemesis = {
          id: nemesis.id,
          name: nemesis.name,
          title: nemesis.title,
          tier: nemesis.tier,
          rank: nemesis.rank,
          floorOfAscension: nemesis.floorOfAscension,
          killCount: nemesis.killCount,
          killedByWeaponType: nemesis.killedByWeaponType,
          isActive: nemesis.isActive,
          weaknesses: nemesis.weaknesses,
          spriteName: ENEMY_TEMPLATES.get(nemesis.sourceTemplateId)?.spriteName ?? null,
        };
      }
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
    recentlyDefeatedNemesis,
    debugMode: state.debugMode ?? false,
  };
}
