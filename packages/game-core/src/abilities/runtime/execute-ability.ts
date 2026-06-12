import type { GameState, EntityId, DomainEvent, Direction } from '@dungeon/contracts';
import type { SeededRNG } from '../../utils/rng.js';
import type { CommandResult } from '../../engine/handlers/shared.js';
import { rejectPlayerAction } from '../../engine/action-rejection.js';
import { buildContext } from './build-context.js';
import { resolveTargets } from './resolve-targets.js';
import { buildAbilityUsedEvent } from './emit-events.js';
import { applyEffect } from '../effects/apply-effect.js';
import { ALL_ABILITY_DEFINITIONS } from '../definitions/index.js';
import { buildRegistry } from '../registry.js';
import { spendMana } from '../../systems/mana.js';
import { gainSchoolXp } from '../../systems/magic-xp.js';
import { validateAbilityAction } from '../../systems/ability-validator.js';
import { RING_SPELL_BY_ID } from '@dungeon/content';

const ABILITY_REGISTRY = buildRegistry(ALL_ABILITY_DEFINITIONS);
const RING_SPELL_LOOKUP = RING_SPELL_BY_ID;

function buildTargetSnapshots(
  targets: ReadonlyArray<{
    readonly enemy: {
      readonly id: EntityId;
      readonly position: { readonly x: number; readonly y: number };
    };
  }>,
): Array<{ targetId: EntityId; position: { x: number; y: number } }> | undefined {
  const snapshots = new Map<EntityId, { targetId: EntityId; position: { x: number; y: number } }>();

  for (const { enemy } of targets) {
    snapshots.set(enemy.id, {
      targetId: enemy.id,
      position: { ...enemy.position },
    });
  }

  return snapshots.size === 0 ? undefined : Array.from(snapshots.values());
}

/**
 * Execute an ability by ID, routing through the new data-driven engine.
 * For abilities in ABILITY_REGISTRY, uses the new system.
 */
export function executeAbility(
  state: GameState,
  abilityId: string,
  rng: SeededRNG,
  targetId?: EntityId,
  direction?: Direction,
  targetPosition?: { x: number; y: number },
): CommandResult {
  // Use central validator to check all ability constraints
  const validation = validateAbilityAction(state, abilityId, targetPosition, targetId, direction);
  if (validation.valid === false) {
    return rejectPlayerAction(
      state,
      'ABILITY',
      abilityId,
      validation.rejectionCode,
      validation.message,
      state.player.id,
      { abilityId },
    );
  }

  const definition = ABILITY_REGISTRY.get(abilityId);
  if (definition === undefined) {
    // Should never happen due to validator check, but fail safely
    return rejectPlayerAction(
      state,
      'ABILITY',
      abilityId,
      'ABILITY_NOT_FOUND',
      `Ability "${abilityId}" is not defined.`,
      state.player.id,
      { abilityId },
    );
  }

  // New data-driven engine
  const context = buildContext(state, rng, targetId, direction, targetPosition);

  const manaRequirement = definition.requirements.find(requirement => requirement.kind === 'has_mana');
  let spendResult: { state: GameState; events: DomainEvent[] } = { state, events: [] };
  if (manaRequirement !== undefined) {
    spendResult = spendMana(state, manaRequirement.amount, definition.name);
  }

  const paidContext = { ...context, state: spendResult.state, player: spendResult.state.player };

  // Resolve targets
  const targets = resolveTargets(paidContext, definition.targeting, targetId);
  const targetSnapshots = buildTargetSnapshots(targets);

  // Execute effects in sequence
  let newContext = paidContext;
  let accumulatedEvents: DomainEvent[] = [...spendResult.events];
  let resultData: {
    damage?: number;
    healAmount?: number;
    hit?: boolean;
    damageByTarget?: ReadonlyMap<EntityId, number>;
  } = {};
  let lastAttackHit = false;
  let anyAttackHit = false;
  const damageByTarget = new Map<EntityId, number>();

  for (const effect of definition.effects) {
    if (effect.kind === 'heal' || (effect.kind === 'status' && effect.target === 'player')) {
      // Heal effects are self-targeted
      const healResult = applyEffect(newContext, effect);
      newContext = {
        ...newContext,
        state: healResult.state,
        player: healResult.state.player,
        run: healResult.state.run,
      };
      accumulatedEvents = [...accumulatedEvents, ...healResult.events];
      // Extract heal amount
      if (effect.kind === 'heal') {
        const maxHealth = newContext.player.stats.maxHealth;
        if (effect.percentageOfMaxHealth !== undefined) {
          resultData.healAmount = Math.floor(maxHealth * effect.percentageOfMaxHealth);
        } else if (effect.flatAmount !== undefined) {
          resultData.healAmount = effect.flatAmount;
        }
      }
    } else if (targets.length > 0) {
      // Target-based effects
      for (const { key: targetKey, enemy } of targets) {
        const effectResult = applyEffect(newContext, effect, targetKey, lastAttackHit);
        newContext = {
          ...newContext,
          state: effectResult.state,
          player: effectResult.state.player,
          run: effectResult.state.run,
        };
        accumulatedEvents = [...accumulatedEvents, ...effectResult.events];
        // Update lastAttackHit if this was an attack effect
        if (effect.kind === 'attack') {
          lastAttackHit = effectResult.hit ?? false;
          anyAttackHit = anyAttackHit || lastAttackHit;
          resultData.hit = anyAttackHit;
          // Capture damage from attack effect and accumulate per victim
          if (effectResult.damage !== undefined) {
            resultData.damage = effectResult.damage;
            damageByTarget.set(enemy.id, (damageByTarget.get(enemy.id) ?? 0) + effectResult.damage);
          }
        }
      }
    }
  }

  // Build damageByTarget map if we have per-victim damage
  if (damageByTarget.size > 0) {
    resultData.damageByTarget = new Map(damageByTarget);
  }

  const ringSpell = RING_SPELL_LOOKUP.get(abilityId);
  if (ringSpell !== undefined) {
    const updatedPlayer = ringSpell.schools.reduce(
      (player, school) => gainSchoolXp(player, school, ringSpell.xpGainOnCast),
      newContext.state.player,
    );

    if (updatedPlayer !== newContext.state.player) {
      newContext = {
        ...newContext,
        state: {
          ...newContext.state,
          player: updatedPlayer,
        },
        player: updatedPlayer,
      };
    }
  }

  // Emit ability used event
  // For self-targeted abilities (no targets resolved), use player ID for heal indicators
  const eventTargetId = targets[0]?.enemy.id ?? (resultData.healAmount !== undefined ? newContext.player.id : undefined);
  const abilityEvent = buildAbilityUsedEvent(newContext, definition.id, definition.name, {
    ...resultData,
    targetId: eventTargetId,
    targetName: targets[0]?.enemy.name,
    affectedTargetIds: targets.map(target => target.enemy.id),
    targetSnapshots,
  });
  accumulatedEvents = [...accumulatedEvents, ...abilityEvent];

  return { state: newContext.state, events: accumulatedEvents, runEnded: false };
}
