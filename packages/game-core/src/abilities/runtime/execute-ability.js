import { buildContext } from './build-context.js';
import { validateRequirements } from './validate-ability.js';
import { resolveTargets } from './resolve-targets.js';
import { buildAbilityUsedEvent } from './emit-events.js';
import { applyEffect } from '../effects/apply-effect.js';
import { ALL_ABILITY_DEFINITIONS } from '../definitions/index.js';
import { buildRegistry } from '../registry.js';
const ABILITY_REGISTRY = buildRegistry(ALL_ABILITY_DEFINITIONS);
/**
 * Execute an ability by ID, routing through the new data-driven engine.
 * For abilities in ABILITY_REGISTRY, uses the new system.
 */
export function executeAbility(state, abilityId, rng, targetId) {
    const definition = ABILITY_REGISTRY.get(abilityId);
    // Not yet migrated to new engine
    if (definition === undefined) {
        return { state, events: [], runEnded: false };
    }
    // New data-driven engine
    const context = buildContext(state, rng, targetId);
    // Validate requirements
    const validation = validateRequirements(context, definition.requirements);
    if (validation.valid === false) {
        return { state, events: [], runEnded: false };
    }
    // Resolve targets
    const targets = resolveTargets(context, definition.targeting, targetId);
    // Execute effects in sequence
    let newContext = context;
    let accumulatedEvents = [];
    let resultData = {};
    let lastAttackHit = false;
    for (const effect of definition.effects) {
        if (effect.kind === 'heal') {
            // Heal effects are self-targeted
            const healResult = applyEffect(newContext, effect);
            newContext = { ...newContext, state: healResult.state };
            accumulatedEvents = [...accumulatedEvents, ...healResult.events];
            // Extract heal amount
            const maxHealth = newContext.player.stats.maxHealth;
            if (effect.percentageOfMaxHealth !== undefined) {
                resultData.healAmount = Math.floor(maxHealth * effect.percentageOfMaxHealth);
            }
            else if (effect.flatAmount !== undefined) {
                resultData.healAmount = effect.flatAmount;
            }
        }
        else if (targets.length > 0) {
            // Target-based effects
            for (const { key: targetKey } of targets) {
                const effectResult = applyEffect(newContext, effect, targetKey, lastAttackHit);
                newContext = { ...newContext, state: effectResult.state };
                accumulatedEvents = [...accumulatedEvents, ...effectResult.events];
                // Update lastAttackHit if this was an attack effect
                if (effect.kind === 'attack') {
                    lastAttackHit = effectResult.hit ?? false;
                    // Capture damage from attack effect
                    if (effectResult.damage !== undefined) {
                        resultData.damage = effectResult.damage;
                    }
                }
            }
        }
    }
    // Emit ability used event
    // For self-targeted abilities (no targets resolved), use player ID for heal indicators
    const eventTargetId = targets[0]?.enemy.id ?? (resultData.healAmount !== undefined ? newContext.player.id : undefined);
    const abilityEvent = buildAbilityUsedEvent(newContext, definition.id, definition.name, {
        ...resultData,
        targetId: eventTargetId,
        targetName: targets[0]?.enemy.name,
    });
    accumulatedEvents = [...accumulatedEvents, ...abilityEvent];
    return { state: newContext.state, events: accumulatedEvents, runEnded: false };
}
//# sourceMappingURL=execute-ability.js.map