import type { GameState, PlayerStats } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { XP_TABLE, LEVEL_UP_GAINS, ABILITY_UNLOCK_BY_LEVEL, BASE_PLAYER_STATS } from '@dungeon/content';
import { grantAbility } from './abilities.js';

export interface PlayerLevelStatGains {
  readonly maxHealth: number;
  readonly attack: number;
  readonly defense: number;
  readonly accuracy: number;
  readonly evasion: number;
}

export interface LevelUpResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly levelsGained: number;
}

export function getPlayerLevelUpGains(_level: number): PlayerLevelStatGains {
  return {
    maxHealth: LEVEL_UP_GAINS.maxHealth,
    attack: LEVEL_UP_GAINS.attack,
    defense: LEVEL_UP_GAINS.defense,
    accuracy: LEVEL_UP_GAINS.accuracy,
    evasion: LEVEL_UP_GAINS.evasion,
  };
}

export function getBasePlayerStatsForLevel(level: number): PlayerStats {
  const normalizedLevel = Number.isInteger(level) && level > 0 ? level : 1;
  const levelsToApply = Array.from(
    { length: Math.max(0, normalizedLevel - 1) },
    (_, i) => i + 2,
  );
  return levelsToApply.reduce<PlayerStats>((stats, currentLevel) => {
    const gains = getPlayerLevelUpGains(currentLevel);
    return {
      ...stats,
      maxHealth: stats.maxHealth + gains.maxHealth,
      health: stats.health + gains.maxHealth,
      attack: stats.attack + gains.attack,
      defense: stats.defense + gains.defense,
      accuracy: stats.accuracy + gains.accuracy,
      evasion: stats.evasion + gains.evasion,
    };
  }, { ...BASE_PLAYER_STATS });
}

/** Check if player has enough XP to level up (possibly multiple times) */
export function checkLevelUp(state: GameState): LevelUpResult {
  let player = state.player;
  let events: DomainEvent[] = [];
  let levelsGained = 0;

  while (
    player.level + 1 < XP_TABLE.length &&
    player.experience >= XP_TABLE[player.level + 1]!
  ) {
    const newLevel = player.level + 1;
    levelsGained++;

    const gains = getPlayerLevelUpGains(newLevel);

    player = {
      ...player,
      level: newLevel,
      baseStats: {
        ...player.baseStats,
        maxHealth: player.baseStats.maxHealth + gains.maxHealth,
        attack: player.baseStats.attack + gains.attack,
        defense: player.baseStats.defense + gains.defense,
        accuracy: player.baseStats.accuracy + gains.accuracy,
        evasion: player.baseStats.evasion + gains.evasion,
      },
      stats: {
        ...player.stats,
        maxHealth: player.stats.maxHealth + gains.maxHealth,
        health: player.stats.health + gains.maxHealth, // Heal the gained HP
        attack: player.stats.attack + gains.attack,
        defense: player.stats.defense + gains.defense,
        accuracy: player.stats.accuracy + gains.accuracy,
        evasion: player.stats.evasion + gains.evasion,
      },
    };

    events = [...events, {
      type: 'LEVEL_UP',
      playerId: player.id,
      newLevel,
      statGains: gains,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

    // Grant ability unlocked at this level (if any)
    const unlockedAbilityId = ABILITY_UNLOCK_BY_LEVEL[newLevel];
    if (unlockedAbilityId !== undefined) {
      const tempState = { ...state, player };
      const afterGrant = grantAbility(tempState, unlockedAbilityId);
      player = afterGrant.player;
    }
  }

  return {
    state: { ...state, player },
    events,
    levelsGained,
  };
}
