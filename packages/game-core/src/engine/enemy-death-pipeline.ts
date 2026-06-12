import type {
  GameState, DomainEvent, EnemyInstance, CombatCauseType, EntityId,
} from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import type { EnemyDamageSnapshot } from '../systems/damage.js';
import {
  MAGIC, burn, getPrimaryFactionId,
} from '@dungeon/content';
import { processEnemyLoot } from '../systems/loot.js';
import { checkLevelUp } from '../systems/progression.js';
import { applyDungeonOgreSlain, applyFactionLeaderSlain, applyFactionMemberKill } from '../systems/factions.js';
import { applyLifeStealOnKill, getExpBonusMultiplier } from '../systems/enchantment-hooks.js';
import { spreadBurnFromDeadEnemy } from '../systems/burn-spread.js';
import {
  canFireMasteryRestoreManaOnBurnKill,
  gainSchoolXp,
} from '../systems/magic-xp.js';
import { restorePlayerMana } from '../systems/mana.js';
import { updateRunMetrics } from './handlers/shared.js';

export interface EnemyDeathContext {
  readonly targetSnapshot?: EnemyDamageSnapshot;
  readonly causeType?: CombatCauseType;
  readonly causeId?: string;
  readonly killerId?: EntityId | null;
  readonly killerName?: string | null;
  readonly sourceEventType?: string;
  readonly turnNumber?: number;
}

function stateContainsEnemy(state: GameState, enemyId: EntityId, enemyPosKey: string): boolean {
  if (state.run === null) return false;
  const keyedEnemy = state.run.enemies.get(enemyPosKey);
  if (keyedEnemy?.id === enemyId) return true;
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === enemyId) return true;
  }
  return false;
}

function removeEnemyById(
  enemies: ReadonlyMap<string, EnemyInstance>,
  enemyId: EntityId,
  preferredKey: string,
): Map<string, EnemyInstance> {
  const newEnemies = new Map(enemies);
  newEnemies.delete(preferredKey);
  for (const [key, enemy] of newEnemies) {
    if (enemy.id === enemyId) {
      newEnemies.delete(key);
    }
  }
  return newEnemies;
}

export function processEnemyKill(
  state: GameState,
  enemy: EnemyInstance,
  enemyPosKey: string,
  rng: SeededRNG,
  context: EnemyDeathContext = {},
): { state: GameState, events: DomainEvent[] } {
  if (state.run === null) return { state, events: [] };

  const deathEnemy = context.targetSnapshot?.enemy ?? enemy;
  const deathEnemyPosKey = context.targetSnapshot?.mapKey ?? enemyPosKey;
  if (stateContainsEnemy(state, deathEnemy.id, deathEnemyPosKey) === false) {
    return { state, events: [] };
  }

  let events: DomainEvent[] = [];
  let newState = state;

  // 1. Remove enemy from map
  const newEnemies = removeEnemyById(state.run.enemies, deathEnemy.id, deathEnemyPosKey);
  const hadBurn = deathEnemy.statuses.some(status => status.id === burn.id);
  const hadPlayerBurn = deathEnemy.statuses.some(status =>
    status.id === burn.id && status.sourceId === newState.player.id
  );
  const eventTurnNumber = context.turnNumber ?? newState.turnNumber;
  const killerId = context.killerId === undefined ? newState.player.id : context.killerId;
  const killerName = context.killerName === undefined
    ? (killerId === newState.player.id ? newState.player.name : null)
    : context.killerName;
  const entityPosition = context.targetSnapshot?.position ?? deathEnemy.position;

  // 2. Emit ENTITY_DIED
  events = [...events, {
    type: 'ENTITY_DIED',
    entityId: deathEnemy.id,
    killerId,
    entityName: deathEnemy.name,
    entityPosition: { ...entityPosition },
    entityMapKey: deathEnemyPosKey,
    killerName,
    causeId: context.causeId,
    causeType: context.causeType ?? 'unknown',
    sourceEventType: context.sourceEventType,
    timestamp: eventTurnNumber,
    turnNumber: eventTurnNumber,
  }];

  // 3. Calculate XP with enchantment bonus
  const expGained = Math.round(deathEnemy.experienceValue * getExpBonusMultiplier(newState));

  // 4. Apply life-steal-on-kill
  const lifeStealHp = applyLifeStealOnKill(newState);
  const newHealthAfterSteal = lifeStealHp > 0
    ? Math.min(newState.player.stats.maxHealth, newState.player.stats.health + lifeStealHp)
    : newState.player.stats.health;

  // Emit life steal event if applicable
  if (lifeStealHp > 0) {
    events = [...events, {
      type: 'LIFE_STEAL',
      playerId: newState.player.id,
      enemyId: deathEnemy.id,
      enemyName: deathEnemy.name,
      hpRestored: lifeStealHp,
      timestamp: eventTurnNumber,
      turnNumber: eventTurnNumber,
    }];
  }

  // 5. Update player stats (totalKills, experience, health)
  newState = {
    ...newState,
    run: { ...newState.run!, enemies: newEnemies },
    player: {
      ...newState.player,
      totalKills: newState.player.totalKills + 1,
      experience: newState.player.experience + expGained,
      stats: { ...newState.player.stats, health: newHealthAfterSteal },
    },
  };

  if (hadBurn === true) {
    const spreadResult = spreadBurnFromDeadEnemy(newState, deathEnemy, rng);
    const playerWithSchoolXp = hadPlayerBurn === true
      ? gainSchoolXp(newState.player, 'fire', MAGIC.schoolXpPerBurningKill)
      : newState.player;
    newState = {
      ...newState,
      run: newState.run === null ? null : { ...newState.run, enemies: spreadResult.enemies },
      player: playerWithSchoolXp,
    };
    events = [...events, ...spreadResult.events];

    if (hadPlayerBurn === true && canFireMasteryRestoreManaOnBurnKill(playerWithSchoolXp) === true) {
      const manaResult = restorePlayerMana(newState, MAGIC.burnKillManaRestore, 'Burning kill');
      newState = manaResult.state;
      events = [...events, ...manaResult.events];
    }
  }

  // 6. Process loot + gold tracking
  const goldBeforeLoot = newState.player.gold;
  const lootResult = processEnemyLoot(newState, deathEnemy, rng);
  newState = lootResult.state;
  events = [...events, ...lootResult.events];
  const goldFromLoot = newState.player.gold - goldBeforeLoot;
  if (goldFromLoot > 0) newState = updateRunMetrics(newState, { goldEarned: goldFromLoot });

  // 8. Update faction progression
  const eventContext = {
    timestamp: newState.turnNumber,
    turnNumber: newState.turnNumber,
    depth: newState.run?.floor.depth ?? state.player.floor,
  };
  const leaderFaction = newState.world.factions.find(faction => faction.activeLeaderId === deathEnemy.id);

  if (newState.world.dungeonOgre.status === 'emerged' && deathEnemy.id === entityId('dungeon_ogre')) {
    const ogreResult = applyDungeonOgreSlain(newState.world, eventContext);
    newState = { ...newState, world: ogreResult.world };
    events = [...events, ...ogreResult.events];
    newState = updateRunMetrics(newState, { causeOfEnd: 'victory' });
    const victoryRun = newState.run!;
    newState = { ...newState, phase: 'game_over' };
    events = [...events, {
      type: 'RUN_ENDED',
      runId: victoryRun.runId,
      reason: 'victory',
      floorsCleared: victoryRun.floor.depth,
      timestamp: newState.turnNumber,
      turnNumber: newState.turnNumber,
    }];
  } else if (leaderFaction !== undefined) {
    const factionResult = applyFactionLeaderSlain(newState.world, leaderFaction.id, eventContext, state.seed);
    newState = { ...newState, world: factionResult.world };
    events = [...events, ...factionResult.events];
  } else {
    const factionResult = applyFactionMemberKill(newState.world, getPrimaryFactionId(deathEnemy.templateId), eventContext);
    newState = { ...newState, world: factionResult.world };
    events = [...events, ...factionResult.events];
  }

  // 9. Track kill metric
  newState = updateRunMetrics(newState, { enemiesKilled: 1 });

  // 10. Check for level up
  const levelResult = checkLevelUp(newState);
  newState = levelResult.state;
  events = [...events, ...levelResult.events];

  // 11. Update quest progress from enemy defeat (defeat_enemy objectives)
  const updatedQuests = newState.activeQuests.map(q => {
    if (q.status !== 'active' || q.objective.type !== 'defeat_enemy') {
      return q;
    }
    // Check if this quest is for this enemy template
    if (q.objective.targetId !== deathEnemy.templateId) {
      return q;
    }
    // Increment progress (targetCount defaults to 1)
    const targetCount = q.objective.targetCount ?? 1;
    const newProgress = Math.min(q.objective.progress + 1, targetCount);
    return {
      ...q,
      objective: {
        ...q.objective,
        progress: newProgress,
      },
    };
  });
  newState = {
    ...newState,
    activeQuests: updatedQuests,
  };

  return { state: newState, events };
}
