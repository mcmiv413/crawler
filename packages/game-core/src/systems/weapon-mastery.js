import { MASTERY_THRESHOLDS, MASTERY_ABILITIES, ABILITY_DEFINITIONS } from '@dungeon/content';
import { grantAbility } from './abilities.js';
export function checkWeaponMasteryUnlocks(state, weaponType) {
    const hits = state.weaponMastery[weaponType];
    let events = [];
    let newState = state;
    const tiers = [1, 2];
    for (const tier of tiers) {
        if (hits >= MASTERY_THRESHOLDS[tier]) {
            const abilityId = MASTERY_ABILITIES[weaponType][tier];
            const alreadyOwned = newState.player.abilities.some(a => a.id === abilityId);
            if (alreadyOwned !== true) {
                newState = grantAbility(newState, abilityId);
                const def = ABILITY_DEFINITIONS.get(abilityId);
                events = [...events, {
                        type: 'MASTERY_UNLOCKED',
                        playerId: newState.player.id,
                        weaponType,
                        tier,
                        abilityId,
                        abilityName: def?.name ?? abilityId,
                        timestamp: Date.now(),
                        turnNumber: newState.turnNumber,
                    }];
            }
        }
    }
    return { state: newState, events };
}
//# sourceMappingURL=weapon-mastery.js.map