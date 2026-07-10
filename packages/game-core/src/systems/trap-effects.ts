import type {
  DomainEvent,
  DamageType,
  EnemyInstance,
  EntityId,
  GameState,
  ObjectInstance,
  ObjectTemplate,
  Position,
  StatusId,
} from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { buildStatusAppliedEvent } from '../abilities/runtime/emit-events.js';
import { applyDamageToEnemy, applyDamageToPlayer, type EnemyDamageSnapshot } from './damage.js';
import { calculateHazardDamage, hazardTypeToDamageType } from './hazard-damage.js';
import { getStatusDefaultDuration } from './status-application.js';
import { applyStatusToEnemy, applyStatusToPlayer } from './status-effects.js';

interface TrapTriggerResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly killed: boolean;
  readonly exhausted: boolean;
}

export interface PlayerTrapTriggerResult extends TrapTriggerResult {
  readonly damage: number;
}

export interface EnemyTrapTriggerResult extends TrapTriggerResult {
  readonly damage: number;
  readonly targetSnapshot?: EnemyDamageSnapshot;
}

function trapDamageType(template: ObjectTemplate): DamageType {
  return template.hazardType !== undefined ? hazardTypeToDamageType(template.hazardType) : 'physical';
}

function shouldExhaustTrap(trap: ObjectInstance): boolean {
  return trap.origin === 'player';
}

function trapOrigin(trap: ObjectInstance): 'environment' | 'player' {
  return trap.origin ?? 'environment';
}

function exhaustTrapAtPosition(
  state: GameState,
  trap: ObjectInstance,
  position: Position,
): GameState {
  if (state.run === null || shouldExhaustTrap(trap) === false) return state;

  const key = posKey(position);
  const currentTrap = state.run.objects.get(key);
  if (currentTrap === undefined || currentTrap.id !== trap.id || currentTrap.isExhausted === true) {
    return state;
  }

  const objects = new Map(state.run.objects);
  objects.set(key, { ...currentTrap, isExhausted: true });

  return {
    ...state,
    run: {
      ...state.run,
      objects,
    },
  };
}

function applyTrapStatusToPlayer(
  state: GameState,
  statusId: StatusId,
  sourceId: EntityId,
  turnNumber: number,
): { readonly state: GameState; readonly event: DomainEvent } {
  const duration = getStatusDefaultDuration(statusId);
  const player = applyStatusToPlayer(state.player, statusId, duration, 1, sourceId);
  return {
    state: { ...state, player },
    event: buildStatusAppliedEvent({
      targetId: state.player.id,
      statusId,
      duration,
      sourceId,
      turnNumber,
    }),
  };
}

function findEnemyById(
  state: GameState,
  enemyId: EntityId,
): { readonly key: string; readonly enemy: EnemyInstance } | null {
  if (state.run === null) return null;
  for (const [key, enemy] of state.run.enemies.entries()) {
    if (enemy.id === enemyId) {
      return { key, enemy };
    }
  }
  return null;
}

function applyTrapStatusToEnemy(
  state: GameState,
  enemyId: EntityId,
  statusId: StatusId,
  sourceId: EntityId,
  turnNumber: number,
): { readonly state: GameState; readonly event: DomainEvent } | null {
  const target = findEnemyById(state, enemyId);
  if (target === null || state.run === null) return null;

  const duration = getStatusDefaultDuration(statusId);
  const enemy = applyStatusToEnemy(target.enemy, statusId, duration, 1, sourceId);
  const enemies = new Map(state.run.enemies);
  enemies.set(target.key, enemy);

  return {
    state: {
      ...state,
      run: {
        ...state.run,
        enemies,
      },
    },
    event: buildStatusAppliedEvent({
      targetId: enemyId,
      statusId,
      duration,
      sourceId,
      turnNumber,
    }),
  };
}

export function triggerTrapOnPlayer(args: {
  readonly state: GameState;
  readonly trap: ObjectInstance;
  readonly template: ObjectTemplate;
  readonly position: Position;
  readonly turnNumber: number;
}): PlayerTrapTriggerResult {
  const { state, trap, template, position, turnNumber } = args;
  if (trap.isExhausted === true) {
    return { state, events: [], damage: 0, killed: false, exhausted: false };
  }

  const preHealth = state.player.stats.health;
  const trapDamage = calculateHazardDamage(template, state.player.stats.maxHealth);
  const damageResult = applyDamageToPlayer(state, {
    amount: trapDamage,
    damageType: trapDamageType(template),
    source: 'trap',
    sourceId: trap.id,
  });
  let nextState = exhaustTrapAtPosition(damageResult.state, trap, position);
  const exhausted = nextState !== damageResult.state;

  const trapEvent: DomainEvent = {
    type: 'TRAP_TRIGGERED',
    trapId: trap.id,
    trapName: template.name,
    position: { ...position },
    damage: damageResult.finalDamage,
    rarity: template.rarity,
    hazardType: template.hazardType,
    statusEffect: template.statusEffect,
    trapOrigin: trapOrigin(trap),
    exhausted,
    targetId: state.player.id,
    targetName: state.player.name,
    targetPosition: { ...position },
    preHealth,
    postHealth: nextState.player.stats.health,
    maxHealth: state.player.stats.maxHealth,
    killed: damageResult.killed,
    timestamp: turnNumber,
    turnNumber,
  };

  let events: DomainEvent[] = [trapEvent];
  if (damageResult.killed === false && template.statusEffect !== undefined) {
    const statusResult = applyTrapStatusToPlayer(nextState, template.statusEffect, trap.id, turnNumber);
    nextState = statusResult.state;
    events = [...events, statusResult.event];
  }

  return {
    state: nextState,
    events,
    damage: damageResult.finalDamage,
    killed: damageResult.killed,
    exhausted,
  };
}

export function triggerTrapOnEnemy(args: {
  readonly state: GameState;
  readonly enemyId: EntityId;
  readonly trap: ObjectInstance;
  readonly template: ObjectTemplate;
  readonly position: Position;
  readonly turnNumber: number;
}): EnemyTrapTriggerResult {
  const { state, enemyId, trap, template, position, turnNumber } = args;
  if (trap.isExhausted === true) {
    return { state, events: [], damage: 0, killed: false, exhausted: false };
  }

  const trapDamage = calculateHazardDamage(template, findEnemyById(state, enemyId)?.enemy.stats.maxHealth ?? 1);
  const damageResult = applyDamageToEnemy(state, enemyId, {
    amount: trapDamage,
    damageType: trapDamageType(template),
    source: 'trap',
    sourceId: trap.id,
  });
  let nextState = exhaustTrapAtPosition(damageResult.state, trap, position);
  const exhausted = nextState !== damageResult.state;
  const snapshot = damageResult.targetSnapshot;

  const trapEvent: DomainEvent = {
    type: 'TRAP_TRIGGERED',
    trapId: trap.id,
    trapName: template.name,
    position: { ...position },
    damage: damageResult.finalDamage,
    rarity: template.rarity,
    hazardType: template.hazardType,
    statusEffect: template.statusEffect,
    trapOrigin: trapOrigin(trap),
    exhausted,
    ...(snapshot !== undefined
      ? {
          targetId: snapshot.id,
          targetName: snapshot.name,
          targetPosition: { ...snapshot.position },
          preHealth: snapshot.preHealth,
          postHealth: snapshot.postHealth,
          maxHealth: snapshot.maxHealth,
          killed: damageResult.killed,
        }
      : {}),
    timestamp: turnNumber,
    turnNumber,
  };

  let events: DomainEvent[] = [trapEvent];
  if (damageResult.killed === false && template.statusEffect !== undefined && snapshot !== undefined) {
    const statusResult = applyTrapStatusToEnemy(nextState, snapshot.id, template.statusEffect, trap.id, turnNumber);
    if (statusResult !== null) {
      nextState = statusResult.state;
      events = [...events, statusResult.event];
    }
  }

  return {
    state: nextState,
    events,
    damage: damageResult.finalDamage,
    killed: damageResult.killed,
    exhausted,
    ...(snapshot !== undefined ? { targetSnapshot: snapshot } : {}),
  };
}
