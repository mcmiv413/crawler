import type { DomainEvent, EnemyInstance, EntityId, GameState } from '@dungeon/contracts';
import { ABILITY_DEFINITIONS, ANIMATION_REF_BY_ID, animationRefs } from '@dungeon/content';
import type { AnimationId } from '@dungeon/content';
import type {
  AbilityAnimationEntry,
  BumpAnimationEntry,
  CombatIndicatorEntry,
  ConsumableAnimationEntry,
  MoveAnimationEntry,
  MoveAnimStyle,
} from './game-view.js';
import {
  BUMP_ANIMATION_DURATION_MS,
  BUMP_IMPACT_FRACTION,
  getBeatSettleMs,
  getConsumableAnimationMetadata,
  getConsumableBlastPositions,
  getMoveAnimationStyle,
  getMoveDurationMs,
} from './animation-metadata.js';

export interface HitStopEntry {
  readonly durationMs: number;
}

export interface DefenderHitEntry {
  readonly entityId: EntityId;
  readonly durationMs: number;
  readonly position?: { readonly x: number; readonly y: number };
}

export type AnimatedEventType =
  | 'bump'
  | 'damage'
  | 'heal'
  | 'status'
  | 'move'
  | 'consumable'
  | 'ability'
  | 'hit-stop'
  | 'defender-hit';

type AnimatedEventData =
  | BumpAnimationEntry
  | CombatIndicatorEntry
  | MoveAnimationEntry
  | ConsumableAnimationEntry
  | AbilityAnimationEntry
  | HitStopEntry
  | DefenderHitEntry;

export interface AnimatedEvent {
  readonly type: AnimatedEventType;
  readonly sequenceIndex: number;
  readonly delayMs: number;
  readonly beatId: string;
  readonly beatIndex: number;
  readonly beatRelativeDelayMs: number;
  readonly batchId: string;
  readonly data: AnimatedEventData;
}

interface PendingAnimatedEvent {
  readonly type: AnimatedEventType;
  readonly beatRelativeDelayMs: number;
  readonly data: AnimatedEventData;
}

interface BeatBuilder {
  readonly key: string;
  mutableEvents: PendingAnimatedEvent[];
  cursorMs: number;
}

interface BeatActionSpec {
  readonly settleMs: number;
  readonly events: readonly PendingAnimatedEvent[];
}

type AnimationRefEntry = NonNullable<ReturnType<typeof ANIMATION_REF_BY_ID.get>>;

function getSuppressActorBump(animationRef: AnimationRefEntry): boolean {
  return 'suppressActorBump' in animationRef && animationRef.suppressActorBump === true;
}

function getAnimationRefHitStopMs(animationRef: AnimationRefEntry): number | undefined {
  return 'hitStopMs' in animationRef ? animationRef.hitStopMs : undefined;
}

function hasImpactFlash(animationRef: AnimationRefEntry): boolean {
  return 'impactFlash' in animationRef && animationRef.impactFlash === true;
}

function getEntitySpeed(id: EntityId, state: GameState): number {
  if (state.run == null) return 0;
  if (id === state.player.id) return state.player.stats.speed;
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === id) return enemy.stats.speed;
  }
  return 0;
}

function getEntityPosition(
  id: EntityId,
  state: GameState,
): { x: number; y: number } | null {
  if (state.run == null) return null;
  if (id === state.player.id) return state.player.position;
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === id) return enemy.position;
  }
  return null;
}

function getEnemyById(
  id: EntityId,
  state: GameState,
): EnemyInstance | null {
  if (state.run == null) return null;
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === id) return enemy;
  }
  return null;
}

type Position = { readonly x: number; readonly y: number };
type AbilityTargetSnapshotLookup = ReadonlyMap<EntityId, Position>;

function buildAbilityTargetSnapshotLookup(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
): AbilityTargetSnapshotLookup {
  return new Map(
    (event.targetSnapshots ?? []).map((snapshot) => [snapshot.targetId, snapshot.position]),
  );
}

function resolveAbilityTargetPosition(
  targetId: EntityId,
  state: GameState,
  targetSnapshotLookup: AbilityTargetSnapshotLookup,
): Position | null {
  return targetSnapshotLookup.get(targetId) ?? getEntityPosition(targetId, state);
}

function getConsumableAnimationId(
  event: Extract<DomainEvent, { type: 'ITEM_USED' }>,
  state: GameState,
): AnimationId | undefined {
  const template = state.itemRegistry.items.get(event.itemId);
  if (template === undefined || !('animation' in template)) return undefined;

  const animation = (template as { readonly animation?: { readonly id?: string } }).animation;
  return animation?.id as AnimationId | undefined;
}

function getMoveStyle(entityId: EntityId, state: GameState): MoveAnimStyle {
  if (entityId === state.player.id) {
    return getMoveAnimationStyle({ isPlayer: true });
  }
  if (state.run == null) return 'slide';

  for (const enemy of state.run.enemies.values()) {
    if (enemy.id !== entityId) continue;
    const movementBehavior = enemy.movementBehaviorId;
    return getMoveAnimationStyle({
      isPlayer: false,
      archetype: enemy.archetype,
      ...(movementBehavior !== undefined ? { movementBehaviorId: movementBehavior } : {}),
    });
  }

  return 'slide';
}

export function getBumpTiming(_entityId: EntityId, _state: GameState): {
  readonly durationMs: number;
  readonly impactFrameMs: number;
} {
  const durationMs = BUMP_ANIMATION_DURATION_MS;
  const impactFrameMs = Math.floor(durationMs * BUMP_IMPACT_FRACTION);
  return { durationMs, impactFrameMs };
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildAnimationBatchId(
  events: readonly DomainEvent[],
  state: GameState,
): string {
  if (events.length === 0) {
    return `batch-${state.gameId}-${state.turnNumber}-empty`;
  }

  const signature = events.map((event, index) => {
    if (event.type === 'ATTACK_PERFORMED') {
      return [
        index,
        event.type,
        event.turnNumber,
        event.attackerId,
        event.defenderId,
        event.damage,
        event.hit,
        event.critical,
      ].join(':');
    }

    return [index, event.type, event.turnNumber, event.timestamp].join(':');
  }).join('|');

  return `batch-${state.gameId}-${state.turnNumber}-${hashString(signature)}`;
}

function createBeatBuilder(key: string): BeatBuilder {
  return {
    key,
    mutableEvents: [],
    cursorMs: 0,
  };
}

function scheduleBeatAction(beat: BeatBuilder, spec: BeatActionSpec): void {
  const actionStartMs = beat.cursorMs;
  beat.mutableEvents = [
    ...beat.mutableEvents,
    ...spec.events.map((event) => ({
      ...event,
      beatRelativeDelayMs: actionStartMs + event.beatRelativeDelayMs,
    })),
  ];
  beat.cursorMs = Math.max(beat.cursorMs, actionStartMs + spec.settleMs);
}

function collectPrimaryActorIds(
  events: readonly DomainEvent[],
  state: GameState,
): readonly EntityId[] {
  const actorIds = new Set<EntityId>();

  for (const event of events) {
    switch (event.type) {
      case 'PLAYER_MOVED':
        actorIds.add(state.player.id);
        break;
      case 'ENEMY_MOVED':
        actorIds.add(event.enemyId);
        break;
      case 'ATTACK_PERFORMED':
        actorIds.add(event.attackerId);
        break;
      case 'ABILITY_USED':
        actorIds.add(event.playerId);
        break;
      case 'ITEM_USED':
        actorIds.add(event.userId);
        break;
      default:
        break;
    }
  }

  const mutableOrderedActorIds: EntityId[] = [];
  if (actorIds.delete(state.player.id)) {
    mutableOrderedActorIds.push(state.player.id);
  }

  const mutableEnemyActorIds = Array.from(actorIds);
  mutableEnemyActorIds.sort((a: EntityId, b: EntityId) => getEntitySpeed(b, state) - getEntitySpeed(a, state));
  mutableOrderedActorIds.push(...mutableEnemyActorIds);
  return mutableOrderedActorIds;
}

function buildMoveAction(
  entityId: EntityId,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  state: GameState,
): BeatActionSpec {
  const style = getMoveStyle(entityId, state);
  const durationMs = getMoveDurationMs(style);

  return {
    settleMs: getBeatSettleMs({
      durationMs,
      impactFrameMs: durationMs,
      recoveryMs: 0,
    }),
    events: [{
      type: 'move',
      beatRelativeDelayMs: 0,
      data: {
        entityId,
        fromPos: from,
        toPos: to,
        style,
        durationMs,
      } satisfies MoveAnimationEntry,
    }],
  };
}

function resolveAbilityBlastPositions(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
  state: GameState,
  targetSnapshotLookup: AbilityTargetSnapshotLookup,
): readonly { readonly x: number; readonly y: number }[] {
  if (event.abilityId === 'axe_cleave' && event.damageByTarget) {
    return Array.from(event.damageByTarget.keys()).flatMap((targetId) => {
      const position = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
      return position === null ? [] : [position];
    });
  }

  if (event.abilityId === 'ranged_volley') {
    return event.damageByTarget
      ? Array.from(event.damageByTarget.keys()).flatMap((targetId) => {
          const position = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
          return position === null ? [] : [position];
        })
      : Array.from(state.run?.enemies.values() ?? []).map((enemy) => enemy.position);
  }

  if (event.abilityId === 'cinder_wake' && event.affectedTargetIds !== undefined) {
    return event.affectedTargetIds.flatMap((targetId) => {
      const position = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
      return position === null ? [] : [position];
    });
  }

  // Thunder Step: render lightning strikes at both departure and arrival positions
  if (event.abilityId === 'thunder_step' && event.targetSnapshots !== undefined) {
    return event.targetSnapshots.flatMap((snapshot) => {
      const snapshotId = String(snapshot.targetId);
      if (!snapshotId.startsWith('departure_') && !snapshotId.startsWith('arrival_')) {
        return [];
      }
      return snapshot.position ? [snapshot.position] : [];
    });
  }

  // Thunderstorm: render lightning strikes at each struck enemy position
  if (event.abilityId === 'thunderstorm' && event.targetSnapshots !== undefined) {
    return event.targetSnapshots.flatMap((snapshot) => {
      return snapshot.position ? [snapshot.position] : [];
    });
  }

  return [];
}

function resolveAbilityDamagePositions(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
  state: GameState,
  targetSnapshotLookup: AbilityTargetSnapshotLookup,
): readonly { readonly pos: { readonly x: number; readonly y: number }; readonly damage: number }[] {
  const mutableDamagePositions: Array<{ pos: { x: number; y: number }; damage: number }> = [];

  if (event.damageByTarget) {
    for (const [targetId, damage] of event.damageByTarget.entries()) {
      const position = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
      if (position !== null) {
        mutableDamagePositions.push({ pos: position, damage });
      }
    }
    return mutableDamagePositions;
  }

  if (event.targetId !== undefined && event.damage !== undefined && event.damage > 0) {
    const targetPos = resolveAbilityTargetPosition(event.targetId, state, targetSnapshotLookup);
    if (targetPos !== null) {
      mutableDamagePositions.push({ pos: targetPos, damage: event.damage });
    }
  }

  return mutableDamagePositions;
}

function resolveAbilityImpactTargetIds(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
): readonly EntityId[] {
  if (event.damageByTarget !== undefined) {
    return Array.from(new Set(event.damageByTarget.keys()));
  }
  if (event.affectedTargetIds !== undefined) {
    return Array.from(new Set(event.affectedTargetIds));
  }
  return event.targetId === undefined ? [] : [event.targetId];
}

function resolveAbilityAnimationRef(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
  abilityAnimationId: AnimationId,
): AnimationRefEntry | undefined {
  if (event.abilityId === 'thunderstorm' && event.targetSnapshots !== undefined) {
    return ANIMATION_REF_BY_ID.get(animationRefs.impact.lightningStrike.id as AnimationId);
  }

  return ANIMATION_REF_BY_ID.get(abilityAnimationId);
}

function buildAbilityAction(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
  state: GameState,
): BeatActionSpec | null {
  const abilityDef = ABILITY_DEFINITIONS.get(event.abilityId);
  if (!abilityDef?.animation?.id) return null;

  const animRef = resolveAbilityAnimationRef(event, abilityDef.animation.id as AnimationId);
  if (animRef === undefined) return null;

  const playerPos = state.player.position;
  const targetSnapshotLookup = buildAbilityTargetSnapshotLookup(event);
  const targetPos = event.targetId
    ? resolveAbilityTargetPosition(event.targetId, state, targetSnapshotLookup) ?? undefined
    : undefined;
  const blastPositions = resolveAbilityBlastPositions(event, state, targetSnapshotLookup);
  const damagePositions = resolveAbilityDamagePositions(event, state, targetSnapshotLookup);
  const impactTargetIds = resolveAbilityImpactTargetIds(event);

  let targetHpFraction: number | undefined;
  if (event.abilityId === 'axe_execute' && event.targetId) {
    const targetEnemy = getEnemyById(event.targetId, state);
    if (targetEnemy && targetEnemy.stats.maxHealth > 0) {
      targetHpFraction = targetEnemy.stats.health / targetEnemy.stats.maxHealth;
    }
  }

  const impactFrameMs = animRef.impactFrameMs;
  const hitStopMs = getAnimationRefHitStopMs(animRef);
  const mutableEvents: PendingAnimatedEvent[] = [{
    type: 'ability',
    beatRelativeDelayMs: 0,
    data: {
      abilityId: event.abilityId,
      animationId: animRef.id,
      playerPos,
      targetPos: targetPos ?? undefined,
      blastPositions,
      targetHpFraction,
      durationMs: animRef.durationMs,
      impactFrameMs,
      suppressActorBump: getSuppressActorBump(animRef),
    } satisfies AbilityAnimationEntry,
  }];

  for (const { pos, damage } of damagePositions) {
    mutableEvents.push({
      type: 'damage',
      beatRelativeDelayMs: impactFrameMs,
      data: {
        text: `-${damage}`,
        type: 'damage',
        x: pos.x,
        y: pos.y,
      } satisfies CombatIndicatorEntry,
    });
  }

  if (hitStopMs !== undefined && impactTargetIds.length > 0) {
    mutableEvents.push({
      type: 'hit-stop',
      beatRelativeDelayMs: impactFrameMs,
      data: {
        durationMs: hitStopMs,
      } satisfies HitStopEntry,
    });
  }

  if (hasImpactFlash(animRef)) {
    const defenderHitDurationMs = hitStopMs ?? animRef.recoveryMs;
    for (const targetId of impactTargetIds) {
      const impactPosition = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
      mutableEvents.push({
        type: 'defender-hit',
        beatRelativeDelayMs: impactFrameMs,
        data: {
          entityId: targetId,
          durationMs: defenderHitDurationMs,
          ...(impactPosition !== null ? { position: impactPosition } : {}),
        } satisfies DefenderHitEntry,
      });
    }
  }

  return {
    settleMs: getBeatSettleMs({
      durationMs: animRef.durationMs,
      impactFrameMs: animRef.impactFrameMs,
      recoveryMs: animRef.recoveryMs,
      hitStopMs,
    }),
    events: mutableEvents,
  };
}

function buildAttackAction(
  event: Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>,
  state: GameState,
): BeatActionSpec | null {
  const attackerPos = getEntityPosition(event.attackerId, state);
  const defenderPos = getEntityPosition(event.defenderId, state) ?? event.position;
  if (attackerPos === null || defenderPos === null) return null;

  const { durationMs, impactFrameMs } = getBumpTiming(event.attackerId, state);

  return {
    settleMs: getBeatSettleMs({
      durationMs,
      impactFrameMs,
      recoveryMs: Math.max(durationMs - impactFrameMs, 0),
    }),
    events: [
      {
        type: 'bump',
        beatRelativeDelayMs: 0,
        data: {
          attackerId: event.attackerId,
          defenderId: event.defenderId,
          attackerPos,
          defenderPos,
          durationMs,
          impactFrameMs,
        } satisfies BumpAnimationEntry,
      },
      {
        type: 'damage',
        beatRelativeDelayMs: impactFrameMs,
        data: {
          text: event.hit ? `-${event.damage}` : 'miss',
          type: 'damage',
          x: defenderPos.x,
          y: defenderPos.y,
        } satisfies CombatIndicatorEntry,
      },
    ],
  };
}

function buildConsumableAction(
  event: Extract<DomainEvent, { type: 'ITEM_USED' }>,
  state: GameState,
): BeatActionSpec {
  const playerPos = state.player.position;
  const { effect, presentation } = getConsumableAnimationMetadata(event.effect);
  const animationId = getConsumableAnimationId(event, state);
  const animationRef = animationId === undefined ? undefined : ANIMATION_REF_BY_ID.get(animationId);
  const durationMs = animationRef?.durationMs ?? presentation.durationMs;

  return {
    settleMs: animationRef === undefined
      ? getBeatSettleMs({ durationMs })
      : getBeatSettleMs({
          durationMs: animationRef.durationMs,
          impactFrameMs: animationRef.impactFrameMs,
          recoveryMs: animationRef.recoveryMs,
          hitStopMs: getAnimationRefHitStopMs(animationRef),
        }),
    events: [{
      type: 'consumable',
      beatRelativeDelayMs: 0,
      data: {
        effect,
        playerPos,
        blastPositions: getConsumableBlastPositions(playerPos, presentation),
        durationMs,
        presentation,
        ...(animationRef !== undefined ? { animationId: animationRef.id } : {}),
      } satisfies ConsumableAnimationEntry,
    }],
  };
}

function buildStatusDamageEvent(
  event: Extract<DomainEvent, { type: 'STATUS_DAMAGE_TICK' }>,
  state: GameState,
): PendingAnimatedEvent | null {
  const targetPos = getEntityPosition(event.targetId, state);
  if (targetPos === null) return null;

  return {
    type: 'damage',
    beatRelativeDelayMs: 0,
    data: {
      text: `-${event.damage}`,
      type: 'damage',
      x: targetPos.x,
      y: targetPos.y,
    } satisfies CombatIndicatorEntry,
  };
}

function isPositionVisible(
  position: { readonly x: number; readonly y: number },
  state: GameState,
): boolean {
  if (state.run === null) return false;
  return state.run.floor.cells.get(`${position.x},${position.y}`)?.visibility === 'visible';
}

function isPendingAnimatedEventVisible(
  event: PendingAnimatedEvent,
  state: GameState,
): boolean {
  switch (event.type) {
    case 'move': {
      const move = event.data as MoveAnimationEntry;
      return move.entityId === state.player.id
        || isPositionVisible(move.fromPos, state)
        || isPositionVisible(move.toPos, state);
    }
    case 'bump': {
      const bump = event.data as BumpAnimationEntry;
      return bump.attackerId === state.player.id
        || bump.defenderId === state.player.id
        || isPositionVisible(bump.attackerPos, state)
        || isPositionVisible(bump.defenderPos, state);
    }
    case 'ability': {
      const ability = event.data as AbilityAnimationEntry;
      return isPositionVisible(ability.playerPos, state)
        || (ability.targetPos !== undefined && isPositionVisible(ability.targetPos, state))
        || ability.blastPositions.some((position) => isPositionVisible(position, state));
    }
    case 'consumable': {
      const consumable = event.data as ConsumableAnimationEntry;
      return isPositionVisible(consumable.playerPos, state)
        || consumable.blastPositions.some((position) => isPositionVisible(position, state));
    }
    case 'damage':
    case 'heal':
    case 'status': {
      const indicator = event.data as CombatIndicatorEntry;
      return isPositionVisible({ x: indicator.x, y: indicator.y }, state);
    }
    case 'defender-hit': {
      const defenderHit = event.data as DefenderHitEntry;
      if (defenderHit.entityId === state.player.id) return true;
      const targetPosition = defenderHit.position ?? getEntityPosition(defenderHit.entityId, state);
      return targetPosition !== null && isPositionVisible(targetPosition, state);
    }
    case 'hit-stop':
      return false;
  }
}

function isBeatVisible(
  events: readonly PendingAnimatedEvent[],
  state: GameState,
): boolean {
  return events.some((event) => isPendingAnimatedEventVisible(event, state));
}

type BeatEventLike = Pick<AnimatedEvent, 'type' | 'beatRelativeDelayMs' | 'data'>;

function getBeatEventSettleCandidateMs(event: BeatEventLike): number {
  switch (event.type) {
    case 'move': {
      const move = event.data as MoveAnimationEntry;
      return event.beatRelativeDelayMs + getBeatSettleMs({
        durationMs: move.durationMs,
        impactFrameMs: move.durationMs,
        recoveryMs: 0,
      });
    }
    case 'bump': {
      const bump = event.data as BumpAnimationEntry;
      return event.beatRelativeDelayMs + getBeatSettleMs({
        durationMs: bump.durationMs,
        impactFrameMs: bump.impactFrameMs,
        recoveryMs: Math.max(bump.durationMs - bump.impactFrameMs, 0),
      });
    }
    case 'ability': {
      const ability = event.data as AbilityAnimationEntry;
      const animationRef = ANIMATION_REF_BY_ID.get(ability.animationId as AnimationId);
      return event.beatRelativeDelayMs + getBeatSettleMs({
        durationMs: ability.durationMs,
        impactFrameMs: animationRef?.impactFrameMs ?? ability.impactFrameMs,
        recoveryMs: animationRef?.recoveryMs ?? Math.max(ability.durationMs - ability.impactFrameMs, 0),
      });
    }
    case 'consumable': {
      const consumable = event.data as ConsumableAnimationEntry;
      const animationRef = consumable.animationId === undefined
        ? undefined
        : ANIMATION_REF_BY_ID.get(consumable.animationId as AnimationId);
      return event.beatRelativeDelayMs + getBeatSettleMs({
        durationMs: consumable.durationMs,
        impactFrameMs: animationRef?.impactFrameMs,
        recoveryMs: animationRef?.recoveryMs,
      });
    }
    default:
      return event.beatRelativeDelayMs;
  }
}

function getBeatEventsSettleMs(events: readonly BeatEventLike[]): number {
  let primarySettleMs = 0;
  let hitStopMs = 0;

  for (const event of events) {
    if (event.type === 'hit-stop') {
      hitStopMs = Math.max(hitStopMs, (event.data as HitStopEntry).durationMs);
      continue;
    }

    primarySettleMs = Math.max(primarySettleMs, getBeatEventSettleCandidateMs(event));
  }

  return primarySettleMs + hitStopMs;
}

export function getAnimatedEventBatchSettleMs(events: readonly AnimatedEvent[]): number {
  if (events.length === 0) return 0;

  const beats = new Map<string, {
    startMs: number;
    mutableEvents: BeatEventLike[];
  }>();

  for (const event of events) {
    const beat = beats.get(event.beatId);
    if (beat === undefined) {
      beats.set(event.beatId, {
        startMs: event.delayMs - event.beatRelativeDelayMs,
        mutableEvents: [{
          type: event.type,
          beatRelativeDelayMs: event.beatRelativeDelayMs,
          data: event.data,
        }],
      });
      continue;
    }

    beat.mutableEvents = [
      ...beat.mutableEvents,
      {
        type: event.type,
        beatRelativeDelayMs: event.beatRelativeDelayMs,
        data: event.data,
      },
    ];
  }

  let settleMs = 0;
  for (const beat of beats.values()) {
    settleMs = Math.max(settleMs, beat.startMs + getBeatEventsSettleMs(beat.mutableEvents));
  }
  return settleMs;
}

export function buildAnimationSequence(
  events: readonly DomainEvent[],
  state: GameState,
): readonly AnimatedEvent[] {
  if (state.run == null) return [];

  const batchId = buildAnimationBatchId(events, state);
  const orderedActorIds = collectPrimaryActorIds(events, state);
  const actorBeats = new Map(orderedActorIds.map((actorId) => [actorId, createBeatBuilder(String(actorId))]));
  let statusBeat: BeatBuilder | null = null;

  for (const event of events) {
    switch (event.type) {
      case 'PLAYER_MOVED': {
        const beat = actorBeats.get(state.player.id);
        if (beat !== undefined) {
          scheduleBeatAction(beat, buildMoveAction(state.player.id, event.from, event.to, state));
        }
        break;
      }
      case 'ENEMY_MOVED': {
        const beat = actorBeats.get(event.enemyId);
        if (beat !== undefined) {
          scheduleBeatAction(beat, buildMoveAction(event.enemyId, event.from, event.to, state));
        }
        break;
      }
      case 'ABILITY_USED': {
        const beat = actorBeats.get(event.playerId);
        const action = beat === undefined ? null : buildAbilityAction(event, state);
        if (beat !== undefined && action !== null) {
          scheduleBeatAction(beat, action);
        }
        break;
      }
      case 'ATTACK_PERFORMED': {
        const beat = actorBeats.get(event.attackerId);
        const action = beat === undefined ? null : buildAttackAction(event, state);
        if (beat !== undefined && action !== null) {
          scheduleBeatAction(beat, action);
        }
        break;
      }
      case 'ITEM_USED': {
        const beat = actorBeats.get(event.userId);
        if (beat !== undefined) {
          scheduleBeatAction(beat, buildConsumableAction(event, state));
        }
        break;
      }
      case 'STATUS_DAMAGE_TICK': {
        statusBeat ??= createBeatBuilder('status');
        const statusEvent = buildStatusDamageEvent(event, state);
        if (statusEvent !== null) {
          statusBeat.mutableEvents = [...statusBeat.mutableEvents, statusEvent];
        }
        break;
      }
      default:
        break;
    }
  }

  const orderedBeats = [
    ...orderedActorIds
      .map((actorId) => actorBeats.get(actorId))
      .filter((beat): beat is BeatBuilder => beat !== undefined && beat.mutableEvents.length > 0),
    ...(statusBeat !== null && statusBeat.mutableEvents.length > 0 ? [statusBeat] : []),
  ];

  const mutableAnimatedEvents: AnimatedEvent[] = [];
  let sequenceIndex = 0;
  let beatStartMs = 0;
  let visibleBeatIndex = 0;

  for (const beat of orderedBeats) {
    if (beat === undefined) continue;
    if (isBeatVisible(beat.mutableEvents, state) === false) {
      continue;
    }

    const beatId = `${batchId}:beat:${visibleBeatIndex}`;
    for (const event of beat.mutableEvents) {
      mutableAnimatedEvents.push({
        type: event.type,
        sequenceIndex,
        delayMs: beatStartMs + event.beatRelativeDelayMs,
        beatId,
        beatIndex: visibleBeatIndex,
        beatRelativeDelayMs: event.beatRelativeDelayMs,
        batchId,
        data: event.data,
      });
      sequenceIndex += 1;
    }

    beatStartMs += getBeatEventsSettleMs(beat.mutableEvents);
    visibleBeatIndex += 1;
  }

  return mutableAnimatedEvents;
}
