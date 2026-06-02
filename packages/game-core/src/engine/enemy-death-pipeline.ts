import type {
  GameState, DomainEvent, EnemyInstance,
} from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
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

export function processEnemyKill(
  state: GameState,
  enemy: EnemyInstance,
  enemyPosKey: string,
  rng: SeededRNG,
): { state: GameState, events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let newState = state;

  // 1. Remove enemy from map
  const newEnemies = new Map(newState.run!.enemies);
  newEnemies.delete(enemyPosKey);
  const hadBurn = enemy.statuses.some(status => status.id === burn.id);

  // 2. Emit ENTITY_DIED
  events = [...events, {
    type: 'ENTITY_DIED',
    entityId: enemy.id,
    killerId: newState.player.id,
    entityName: enemy.name,
    timestamp: newState.turnNumber,
    turnNumber: newState.turnNumber,
  }];

  // 3. Calculate XP with enchantment bonus
  const expGained = Math.round(enemy.experienceValue * getExpBonusMultiplier(newState));

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
      enemyId: enemy.id,
      enemyName: enemy.name,
      hpRestored: lifeStealHp,
      timestamp: newState.turnNumber,
      turnNumber: newState.turnNumber,
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
    const spreadResult = spreadBurnFromDeadEnemy(newState, enemy, rng);
    const playerWithSchoolXp = gainSchoolXp(newState.player, 'fire', MAGIC.schoolXpPerBurningKill);
    newState = {
      ...newState,
      run: newState.run === null ? null : { ...newState.run, enemies: spreadResult.enemies },
      player: playerWithSchoolXp,
    };
    events = [...events, ...spreadResult.events];

    if (canFireMasteryRestoreManaOnBurnKill(playerWithSchoolXp) === true) {
      const manaResult = restorePlayerMana(newState, MAGIC.burnKillManaRestore, 'Burning kill');
      newState = manaResult.state;
      events = [...events, ...manaResult.events];
    }
  }

  // 6. Process loot + gold tracking
  const goldBeforeLoot = newState.player.gold;
  const lootResult = processEnemyLoot(newState, enemy, rng);
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
  const leaderFaction = newState.world.factions.find(faction => faction.activeLeaderId === enemy.id);

  if (newState.world.dungeonOgre.status === 'emerged' && enemy.id === entityId('dungeon_ogre')) {
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
    const factionResult = applyFactionMemberKill(newState.world, getPrimaryFactionId(enemy.templateId), eventContext);
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
    if (q.objective.targetId !== enemy.templateId) {
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
