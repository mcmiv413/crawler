/**
 * Build an ABILITY_USED event from context and execution results.
 */
export function buildAbilityUsedEvent(context, abilityId, abilityName, result) {
    const event = {
        type: 'ABILITY_USED',
        playerId: context.player.id,
        abilityId,
        abilityName,
        targetId: result.targetId,
        targetName: result.targetName,
        damage: result.damage,
        healAmount: result.healAmount,
        timestamp: Date.now(),
        turnNumber: context.state.turnNumber,
    };
    return [event];
}
//# sourceMappingURL=emit-events.js.map