/**
 * Modular ability system.
 * Public API for ability definitions, registry, and runtime.
 */

export type { AbilityDefinition, AbilityContext, AbilityEffect } from './types.js';
export type { AbilityTag, AbilityUnlock, AbilityRequirement, AbilityCondition, TargetSelector, AbilityTargeting } from './types.js';
export type { AttackEffect, HealEffect, StatusEffect, ModifyStatEffect, ConditionalEffect } from './types.js';

export type { AbilityRegistry } from './registry.js';
export { buildRegistry } from './registry.js';

export { buildContext } from './runtime/build-context.js';
export { validateRequirements } from './runtime/validate-ability.js';
export { resolveTargets } from './runtime/resolve-targets.js';
export { buildAbilityUsedEvent } from './runtime/emit-events.js';
export { executeAbility } from './runtime/execute-ability.js';

export { deriveMasteryAbilities } from './derive-mastery-map.js';

export { ALL_ABILITY_DEFINITIONS } from './definitions/index.js';
