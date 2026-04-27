import { XP_TABLE, LEVEL_UP_GAINS, ABILITY_UNLOCK_BY_LEVEL } from '@dungeon/content';
import { grantAbility } from './abilities.js';
/** Check if player has enough XP to level up (possibly multiple times) */
export function checkLevelUp(state) {
    let player = state.player;
    let events = [];
    let levelsGained = 0;
    while (player.level + 1 < XP_TABLE.length &&
        player.experience >= XP_TABLE[player.level + 1]) {
        const newLevel = player.level + 1;
        levelsGained++;
        const gains = {
            maxHealth: LEVEL_UP_GAINS.maxHealth,
            attack: LEVEL_UP_GAINS.attack,
            defense: LEVEL_UP_GAINS.defense,
            accuracy: LEVEL_UP_GAINS.accuracy,
            evasion: LEVEL_UP_GAINS.evasion,
        };
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
                timestamp: Date.now(),
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
//# sourceMappingURL=progression.js.map