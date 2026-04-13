import type { GameState, EntityId, DomainEvent } from '@dungeon/contracts';
import type { SeededRNG } from '../../utils/rng.js';
import type { CommandResult } from '../../engine/handlers/shared.js';
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
export function executeAbility(
  state: GameState,
  abilityId: string,
  rng: SeededRNG,
  targetId?: EntityId,
): CommandResult {
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
  let accumulatedEvents: DomainEvent[] = [];
  let resultData: { damage?: number; healAmount?: number } = {};
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
      } else if (effect.flatAmount !== undefined) {
        resultData.healAmount = effect.flatAmount;
      }
    } else if (targets.length > 0) {
      // Target-based effects
      for (const { key: targetKey } of targets) {
        const effectResult = applyEffect(newContext, effect, targetKey, lastAttackHit);
        newContext = { ...newContext, state: effectResult.state };
        accumulatedEvents = [...accumulatedEvents, ...effectResult.events];
        // Update lastAttackHit if this was an attack effect
        if (effect.kind === 'attack') {
          lastAttackHit = (effectResult as any).hit ?? false;
        }
      }
    }
  }

  // Emit ability used event
  const abilityEvent = buildAbilityUsedEvent(newContext, definition.id, definition.name, {
    ...resultData,
    targetId: targets[0]?.enemy.id,
    targetName: targets[0]?.enemy.name,
  });
  accumulatedEvents = [...accumulatedEvents, ...abilityEvent];

  return { state: newContext.state, events: accumulatedEvents, runEnded: false };
}
