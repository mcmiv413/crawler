import type { DomainEvent, EnemyInstance, EntityId, GameState } from '@dungeon/contracts';
import { sortedCopy } from '@dungeon/contracts';
import { ABILITY_DEFINITIONS, ANIMATION_REF_BY_ID, animationRefs } from '@dungeon/content';
import type { AnimationId } from '@dungeon/content';
import { ALL_ABILITY_DEFINITIONS } from '@dungeon/core';
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
  readonly events: readonly PendingAnimatedEvent[];
  readonly cursorMs: number;
}

interface BeatActionSpec {
  readonly settleMs: number;
  readonly events: readonly PendingAnimatedEvent[];
}

type AnimationRefEntry = NonNullable<ReturnType<typeof ANIMATION_REF_BY_ID.get>>;
const CORE_ABILITY_DEFINITION_BY_ID = new Map(ALL_ABILITY_DEFINITIONS.map((definition) => [definition.id, definition]));

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
    events: [],
    cursorMs: 0,
  };
}

function scheduleBeatAction(beat: BeatBuilder, spec: BeatActionSpec): BeatBuilder {
  const actionStartMs = beat.cursorMs;
  return {
    ...beat,
    events: [
      ...beat.events,
      ...spec.events.map((event) => ({
        ...event,
        beatRelativeDelayMs: actionStartMs + event.beatRelativeDelayMs,
      })),
    ],
    cursorMs: Math.max(beat.cursorMs, actionStartMs + spec.settleMs),
  };
}

function scheduleActorBeat(
  beats: ReadonlyMap<EntityId, BeatBuilder>,
  actorId: EntityId,
  spec: BeatActionSpec | null,
): ReadonlyMap<EntityId, BeatBuilder> {
  const beat = beats.get(actorId);
  if (beat === undefined || spec === null) return beats;

  return new Map([...beats, [actorId, scheduleBeatAction(beat, spec)]]);
}

function appendBeatEvent(
  beat: BeatBuilder,
  event: PendingAnimatedEvent,
): BeatBuilder {
  return {
    ...beat,
    events: [...beat.events, event],
  };
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

  const enemyActorIds = sortedCopy(
    [...actorIds].filter((actorId) => actorId !== state.player.id),
    (a: EntityId, b: EntityId) => getEntitySpeed(b, state) - getEntitySpeed(a, state),
  );

  return [
    ...(actorIds.has(state.player.id) ? [state.player.id] : []),
    ...enemyActorIds,
  ];
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
  if (event.damageByTarget) {
    return Array.from(event.damageByTarget.entries())
      .map(([targetId, damage]) => {
        const position = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
        return position === null ? null : { pos: position, damage };
      })
      .filter((damagePosition): damagePosition is { readonly pos: { readonly x: number; readonly y: number }; readonly damage: number } => {
        return damagePosition !== null;
      });
  }

  if (event.targetId !== undefined && event.damage !== undefined && event.damage > 0) {
    const targetPos = resolveAbilityTargetPosition(event.targetId, state, targetSnapshotLookup);
    return targetPos === null ? [] : [{ pos: targetPos, damage: event.damage }];
  }

  return [];
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

  const coreAbilityDef = CORE_ABILITY_DEFINITION_BY_ID.get(event.abilityId);
  const playerPos = state.player.position;
  const targetSnapshotLookup = buildAbilityTargetSnapshotLookup(event);
  const targetPos = event.targetId
    ? resolveAbilityTargetPosition(event.targetId, state, targetSnapshotLookup) ?? undefined
    : undefined;
  const blastPositions = resolveAbilityBlastPositions(event, state, targetSnapshotLookup);
  const damagePositions = resolveAbilityDamagePositions(event, state, targetSnapshotLookup);
  const impactTargetIds = resolveAbilityImpactTargetIds(event);
  const healPosition = event.healAmount !== undefined && event.healAmount > 0
    ? resolveAbilityTargetPosition(event.targetId ?? event.playerId, state, targetSnapshotLookup)
    : null;

  let targetHpFraction: number | undefined;
  if (event.abilityId === 'axe_execute' && event.targetId) {
    const targetEnemy = getEnemyById(event.targetId, state);
    if (targetEnemy && targetEnemy.stats.maxHealth > 0) {
      targetHpFraction = targetEnemy.stats.health / targetEnemy.stats.maxHealth;
    }
  }

  const impactFrameMs = animRef.impactFrameMs;
  const hitStopMs = getAnimationRefHitStopMs(animRef);
  const defenderHitDurationMs = hitStopMs ?? animRef.recoveryMs;
  const events: PendingAnimatedEvent[] = [
    {
      type: 'ability',
      beatRelativeDelayMs: 0,
      data: {
        abilityId: event.abilityId,
        animationId: animRef.id,
        selfTargeted: coreAbilityDef?.targeting.selector.kind === 'self',
        playerPos,
        targetPos: targetPos ?? undefined,
        blastPositions,
        targetHpFraction,
        durationMs: animRef.durationMs,
        impactFrameMs,
        suppressActorBump: getSuppressActorBump(animRef),
      } satisfies AbilityAnimationEntry,
    },
    ...damagePositions.map(({ pos, damage }) => ({
      type: 'damage' as const,
      beatRelativeDelayMs: impactFrameMs,
      data: {
        text: `-${damage}`,
        type: 'damage',
        x: pos.x,
        y: pos.y,
      } satisfies CombatIndicatorEntry,
    })),
    ...(healPosition !== null && event.healAmount !== undefined && event.healAmount > 0
      ? [{
          type: 'heal' as const,
          beatRelativeDelayMs: impactFrameMs,
          data: {
            text: `+${event.healAmount}`,
            type: 'heal',
            x: healPosition.x,
            y: healPosition.y,
          } satisfies CombatIndicatorEntry,
        }]
      : []),
    ...(hitStopMs !== undefined && impactTargetIds.length > 0
      ? [{
          type: 'hit-stop' as const,
          beatRelativeDelayMs: impactFrameMs,
          data: {
            durationMs: hitStopMs,
          } satisfies HitStopEntry,
        }]
      : []),
    ...(hasImpactFlash(animRef)
      ? impactTargetIds.map((targetId) => {
          const impactPosition = resolveAbilityTargetPosition(targetId, state, targetSnapshotLookup);
          return {
            type: 'defender-hit' as const,
            beatRelativeDelayMs: impactFrameMs,
            data: {
              entityId: targetId,
              durationMs: defenderHitDurationMs,
              ...(impactPosition !== null ? { position: impactPosition } : {}),
            } satisfies DefenderHitEntry,
          };
        })
      : []),
  ];

  return {
    settleMs: getBeatSettleMs({
      durationMs: animRef.durationMs,
      impactFrameMs: animRef.impactFrameMs,
      recoveryMs: animRef.recoveryMs,
      hitStopMs,
    }),
    events,
  };
}

function buildAttackAction(
  event: Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>,
  state: GameState,
): BeatActionSpec | null {
  const attackerPos = event.attackerPosition ?? getEntityPosition(event.attackerId, state);
  const defenderPos = event.defenderPosition ?? event.position;
  if (attackerPos === null) return null;

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
): PendingAnimatedEvent | null {
  const targetPos = event.targetPosition ?? event.position;

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

  const beats = events.reduce<ReadonlyMap<string, {
    readonly startMs: number;
    readonly events: readonly BeatEventLike[];
  }>>((beatMap, event) => {
    const beat = beatMap.get(event.beatId);
    const beatEvent = {
      type: event.type,
      beatRelativeDelayMs: event.beatRelativeDelayMs,
      data: event.data,
    };
    return new Map([
      ...beatMap,
      [event.beatId, {
        startMs: event.delayMs - event.beatRelativeDelayMs,
        events: [...(beat?.events ?? []), beatEvent],
      }],
    ]);
  }, new Map());

  return Math.max(
    0,
    ...Array.from(beats.values()).map((beat) => beat.startMs + getBeatEventsSettleMs(beat.events)),
  );
}

export function buildAnimationSequence(
  events: readonly DomainEvent[],
  state: GameState,
): readonly AnimatedEvent[] {
  if (state.run == null) return [];

  const batchId = buildAnimationBatchId(events, state);
  const orderedActorIds = collectPrimaryActorIds(events, state);
  let actorBeats: ReadonlyMap<EntityId, BeatBuilder> = new Map(
    orderedActorIds.map((actorId) => [actorId, createBeatBuilder(String(actorId))]),
  );
  let statusBeat: BeatBuilder | null = null;

  for (const event of events) {
    switch (event.type) {
      case 'PLAYER_MOVED': {
        actorBeats = scheduleActorBeat(
          actorBeats,
          state.player.id,
          buildMoveAction(state.player.id, event.from, event.to, state),
        );
        break;
      }
      case 'ENEMY_MOVED': {
        actorBeats = scheduleActorBeat(
          actorBeats,
          event.enemyId,
          buildMoveAction(event.enemyId, event.from, event.to, state),
        );
        break;
      }
      case 'ABILITY_USED': {
        actorBeats = scheduleActorBeat(actorBeats, event.playerId, buildAbilityAction(event, state));
        break;
      }
      case 'ATTACK_PERFORMED': {
        actorBeats = scheduleActorBeat(actorBeats, event.attackerId, buildAttackAction(event, state));
        break;
      }
      case 'ITEM_USED': {
        actorBeats = scheduleActorBeat(actorBeats, event.userId, buildConsumableAction(event, state));
        break;
      }
      case 'STATUS_DAMAGE_TICK': {
        const statusEvent = buildStatusDamageEvent(event);
        if (statusEvent !== null) {
          statusBeat = appendBeatEvent(statusBeat ?? createBeatBuilder('status'), statusEvent);
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
      .filter((beat): beat is BeatBuilder => beat !== undefined && beat.events.length > 0),
    ...(statusBeat !== null && statusBeat.events.length > 0 ? [statusBeat] : []),
  ];

  const sequence = orderedBeats.reduce<{
    readonly animatedEvents: readonly AnimatedEvent[];
    readonly sequenceIndex: number;
    readonly beatStartMs: number;
    readonly visibleBeatIndex: number;
  }>((sequenceState, beat) => {
    if (isBeatVisible(beat.events, state) === false) return sequenceState;

    const beatId = `${batchId}:beat:${sequenceState.visibleBeatIndex}`;
    const animatedEvents = beat.events.map((event, eventIndex) => ({
      type: event.type,
      sequenceIndex: sequenceState.sequenceIndex + eventIndex,
      delayMs: sequenceState.beatStartMs + event.beatRelativeDelayMs,
      beatId,
      beatIndex: sequenceState.visibleBeatIndex,
      beatRelativeDelayMs: event.beatRelativeDelayMs,
      batchId,
      data: event.data,
    } satisfies AnimatedEvent));

    return {
      animatedEvents: [...sequenceState.animatedEvents, ...animatedEvents],
      sequenceIndex: sequenceState.sequenceIndex + animatedEvents.length,
      beatStartMs: sequenceState.beatStartMs + getBeatEventsSettleMs(beat.events),
      visibleBeatIndex: sequenceState.visibleBeatIndex + 1,
    };
  }, {
    animatedEvents: [],
    sequenceIndex: 0,
    beatStartMs: 0,
    visibleBeatIndex: 0,
  });

  return sequence.animatedEvents;
}
