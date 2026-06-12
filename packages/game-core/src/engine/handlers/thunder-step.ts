import type { GameState, DomainEvent, EntityId, UseAbilityCommand } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { thunderStep, RING_SPELL_BY_ID } from '@dungeon/content';
import type { CommandResult } from './shared.js';
import { updateRunMetrics } from './shared.js';
import { rejectPlayerAction } from '../action-rejection.js';
import { advanceTurnAfterPlayerAction } from '../turn-advance-pipeline.js';
import { applyDamageToEnemy } from '../../systems/damage.js';
import { processEnemyKill } from '../enemy-death-pipeline.js';
import { setAbilityCooldown } from '../../systems/abilities.js';
import { spendMana } from '../../systems/mana.js';
import { gainSchoolXp } from '../../systems/magic-xp.js';
import { validateAbilityAction } from '../../systems/ability-validator.js';
import { computeFov } from '../../systems/fov.js';
import { buildAbilityUsedEvent } from '../../abilities/runtime/emit-events.js';
import type { SeededRNG } from '../../utils/rng.js';
import { chebyshevDistance } from '../../utils/grid.js';

/**
 * Handle Thunder Step ability: teleport to a visible tile and deal shock AOE damage at departure and arrival.
 */
export function handleThunderStep(
  state: GameState,
  command: UseAbilityCommand,
  rng: SeededRNG,
): CommandResult {
  // Use central validator to check all ability constraints
  const validation = validateAbilityAction(state, thunderStep.id, command.targetPosition);
  if (validation.valid === false) {
    return rejectPlayerAction(
      state,
      'ABILITY',
      thunderStep.id,
      validation.rejectionCode,
      validation.message,
      state.player.id,
      { abilityId: thunderStep.id, targetPosition: command.targetPosition },
    );
  }

  if (command.targetPosition === undefined) {
    // Should never happen due to validator, but fail safely
    return rejectPlayerAction(
      state,
      'ABILITY',
      thunderStep.id,
      'MISSING_TILE_TARGET',
      'Target position is required for Thunder Step.',
      state.player.id,
      { abilityId: thunderStep.id },
    );
  }

  const targetPosition = command.targetPosition;

  const ringSpell = RING_SPELL_BY_ID.get(thunderStep.id);
  if (ringSpell === undefined) {
    return rejectPlayerAction(
      state,
      'ABILITY',
      thunderStep.id,
      'ABILITY_NOT_FOUND',
      'Thunder Step definition not found.',
      state.player.id,
      { abilityId: thunderStep.id },
    );
  }

  let events: DomainEvent[] = [];

  // Increment turn and set cooldown
  let newState: GameState = {
    ...state,
    turnNumber: state.turnNumber + 1,
  };
  newState = setAbilityCooldown(newState, thunderStep.id, ringSpell.cooldown);
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Spend mana
  const spendResult = spendMana(newState, ringSpell.manaCost ?? 0, thunderStep.name);
  newState = spendResult.state;
  events = [...events, ...spendResult.events];
  const preEffectEvents = events;
  events = [];

  // Record departure position
  const departurePos = { ...newState.player.position };

  // Teleport player
  newState = {
    ...newState,
    player: {
      ...newState.player,
      position: { ...targetPosition },
    },
  };

  if (newState.run !== null) {
    const updatedCells = computeFov(newState.run.floor, targetPosition);
    newState = {
      ...newState,
      run: {
        ...newState.run,
        floor: {
          ...newState.run.floor,
          cells: updatedCells,
        },
      },
    };
  }

  // AOE damage at both positions (1 tile radius, so 3x3 grid centered on position)
  const baseDamage = ringSpell.baseDamage ?? 5;
  const damageType = 'shock';
  const damageByTarget = new Map<EntityId, number>();
  const damageTargetSnapshots = new Map<EntityId, { x: number; y: number }>();

  // Helper to deal AOE damage at a position
  const dealAOEDamage = (
    currentState: GameState,
    centerPos: { x: number; y: number },
    eventList: DomainEvent[],
  ): { state: GameState; events: DomainEvent[] } => {
    let workingState = currentState;
    let workingEvents = [...eventList];

    // Find all enemies within 1 tile (chebyshev distance)
    for (const [key, enemy] of workingState.run!.enemies) {
      const dist = chebyshevDistance(centerPos, enemy.position);
      if (dist <= 1) {
        damageTargetSnapshots.set(enemy.id, { ...enemy.position });
        const damageResult = applyDamageToEnemy(workingState, enemy.id, {
          amount: baseDamage,
          damageType,
          source: 'ability',
          bypassDefense: false,
          bypassResistance: false,
        });
        workingState = damageResult.state;
        if (damageResult.finalDamage > 0) {
          damageByTarget.set(enemy.id, (damageByTarget.get(enemy.id) ?? 0) + damageResult.finalDamage);
        }

        if (damageResult.killed === true) {
          const killResult = processEnemyKill(workingState, damageResult.targetSnapshot?.enemy ?? enemy, key, rng, {
            targetSnapshot: damageResult.targetSnapshot,
            causeType: 'ability',
            causeId: thunderStep.id,
            killerId: workingState.player.id,
            killerName: workingState.player.name,
            sourceEventType: 'ABILITY_USED',
            turnNumber: workingState.turnNumber,
          });
          workingState = killResult.state;
          workingEvents = [...workingEvents, ...killResult.events];
        }
      }
    }

    return { state: workingState, events: workingEvents };
  };

  // Deal damage at departure position
  const departureResult = dealAOEDamage(newState, departurePos, events);
  newState = departureResult.state;
  events = departureResult.events;

  // Deal damage at arrival position
  const arrivalResult = dealAOEDamage(newState, targetPosition, events);
  newState = arrivalResult.state;
  events = arrivalResult.events;

  // Gain school XP
  let updatedPlayer = newState.player;
  for (const school of ringSpell.schools) {
    updatedPlayer = gainSchoolXp(updatedPlayer, school, ringSpell.xpGainOnCast);
  }
  newState = { ...newState, player: updatedPlayer };

  const abilityTargetSnapshots = [
    { targetId: entityId('departure_' + departurePos.x + '_' + departurePos.y), position: departurePos },
    { targetId: entityId('arrival_' + targetPosition.x + '_' + targetPosition.y), position: targetPosition },
    ...Array.from(damageTargetSnapshots, ([targetId, position]) => ({ targetId, position })),
  ];
  const abilityEvents = buildAbilityUsedEvent({
    state: newState,
    rng,
    player: newState.player,
    run: newState.run,
    equippedWeaponId: newState.player.equipment.weapon,
    abilityId: thunderStep.id,
    targetPosition,
  }, thunderStep.id, thunderStep.name, {
    damageByTarget: damageByTarget.size > 0 ? new Map(damageByTarget) : undefined,
    affectedTargetIds: Array.from(damageByTarget.keys()),
    targetSnapshots: abilityTargetSnapshots,
  });
  events = [...preEffectEvents, ...abilityEvents, ...events];

  return advanceTurnAfterPlayerAction(newState, events, rng);
}
