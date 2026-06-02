import type { GameState, DomainEvent, EntityId, UseAbilityCommand } from '@dungeon/contracts';
import { posKey, entityId } from '@dungeon/contracts';
import { thunderStep, RING_SPELL_BY_ID } from '@dungeon/content';
import type { CommandResult } from './shared.js';
import { updateRunMetrics } from './shared.js';
import { advanceTurnAfterPlayerAction } from '../turn-advance-pipeline.js';
import { applyDamageToEnemy } from '../../systems/damage.js';
import { processEnemyKill } from '../enemy-death-pipeline.js';
import { setAbilityCooldown, canUseAbility } from '../../systems/abilities.js';
import { spendMana, canAffordMana } from '../../systems/mana.js';
import { gainSchoolXp } from '../../systems/magic-xp.js';
import { canUseLearnedRingSpell } from '../../systems/ring-spell-availability.js';
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
  if (command.targetPosition === undefined) {
    return { state, events: [], runEnded: false };
  }

  if (state.run === null || state.phase !== 'dungeon') {
    return { state, events: [], runEnded: false };
  }

  const targetPosition = command.targetPosition;

  const ringSpell = RING_SPELL_BY_ID.get(thunderStep.id);
  if (ringSpell === undefined) {
    return { state, events: [], runEnded: false };
  }

  // Check ring spell eligibility
  const equippedItemIds = Object.values(state.player.equipment)
    .filter((id): id is EntityId => id !== null)
    .map(entityId => state.itemRegistry.items.get(entityId)?.itemId)
    .filter((id): id is string => id !== undefined);
  if (!canUseLearnedRingSpell(state.player, thunderStep.id, equippedItemIds)) {
    return { state, events: [], runEnded: false };
  }

  if (!canUseAbility(state, thunderStep.id)) {
    return { state, events: [], runEnded: false };
  }

  if (!canAffordMana(state.player.mana, ringSpell.manaCost ?? 0)) {
    return { state, events: [], runEnded: false };
  }

  // Validate target position: visible, walkable, unoccupied
  const targetKey = posKey(targetPosition);
  const targetCell = state.run.floor.cells.get(targetKey);

  if (targetCell === undefined || targetCell.tile.walkable !== true) {
    return { state, events: [], runEnded: false };
  }

  if (targetCell.visibility !== 'visible') {
    return { state, events: [], runEnded: false };
  }

  if (targetPosition.x === state.player.position.x && targetPosition.y === state.player.position.y) {
    return { state, events: [], runEnded: false };
  }

  const noEnemy = state.run.enemies.get(targetKey) === undefined;
  const noObject = state.run.objects.get(targetKey) === undefined;

  if (!noEnemy || !noObject) {
    return { state, events: [], runEnded: false };
  }

  // Check range
  const distance = chebyshevDistance(state.player.position, targetPosition);
  const maxRange = ringSpell.range;
  if (distance > maxRange) {
    return { state, events: [], runEnded: false };
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
          const killResult = processEnemyKill(workingState, enemy, key, rng);
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
  events = [
    ...events,
    ...buildAbilityUsedEvent({
      state: newState,
      rng,
      player: newState.player,
      run: newState.run,
      equippedWeaponId: newState.player.equipment.weapon,
      targetPosition,
    }, thunderStep.id, thunderStep.name, {
      damageByTarget: damageByTarget.size > 0 ? new Map(damageByTarget) : undefined,
      affectedTargetIds: Array.from(damageByTarget.keys()),
      targetSnapshots: abilityTargetSnapshots,
    }),
  ];

  return advanceTurnAfterPlayerAction(newState, events, rng);
}
