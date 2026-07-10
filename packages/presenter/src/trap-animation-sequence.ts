import type { DomainEvent, EntityId, GameState, Position } from '@dungeon/contracts';
import { ANIMATION_REF_BY_ID, animationRefs } from '@dungeon/content';
import type { AnimationId } from '@dungeon/content';
import type { AbilityAnimationEntry, CombatIndicatorEntry } from './game-view.js';
import { getBeatSettleMs } from './animation-metadata.js';

type AnimationRefEntry = NonNullable<ReturnType<typeof ANIMATION_REF_BY_ID.get>>;

interface TrapHitStopEntry {
  readonly durationMs: number;
}

interface TrapDefenderHitEntry {
  readonly entityId: EntityId;
  readonly durationMs: number;
  readonly position?: Position;
}

type TrapAnimatedEventType =
  | 'damage'
  | 'ability'
  | 'hit-stop'
  | 'defender-hit';

type TrapAnimatedEventData =
  | CombatIndicatorEntry
  | AbilityAnimationEntry
  | TrapHitStopEntry
  | TrapDefenderHitEntry;

interface PendingTrapAnimatedEvent {
  readonly type: TrapAnimatedEventType;
  readonly beatRelativeDelayMs: number;
  readonly data: TrapAnimatedEventData;
}

export interface TrapBeatActionSpec {
  readonly settleMs: number;
  readonly events: readonly PendingTrapAnimatedEvent[];
}

function getSuppressActorBump(animationRef: AnimationRefEntry): boolean {
  return 'suppressActorBump' in animationRef && animationRef.suppressActorBump === true;
}

function getAnimationRefHitStopMs(animationRef: AnimationRefEntry): number | undefined {
  return 'hitStopMs' in animationRef ? animationRef.hitStopMs : undefined;
}

function hasImpactFlash(animationRef: AnimationRefEntry): boolean {
  return 'impactFlash' in animationRef && animationRef.impactFlash === true;
}

function getEntityPosition(
  id: EntityId,
  state: GameState,
): Position | null {
  if (state.run == null) return null;
  if (id === state.player.id) return state.player.position;
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === id) return enemy.position;
  }
  return null;
}

function getTrapTriggerAnimationRef(
  event: Extract<DomainEvent, { type: 'TRAP_TRIGGERED' }>,
): AnimationRefEntry {
  switch (event.hazardType) {
    case 'fire':
      return ANIMATION_REF_BY_ID.get(animationRefs.aoe.bombBlast.id as AnimationId)!;
    case 'frost':
      return ANIMATION_REF_BY_ID.get(animationRefs.aoe.shatterBurst.id as AnimationId)!;
    case 'lightning':
      return ANIMATION_REF_BY_ID.get(animationRefs.impact.lightningStrike.id as AnimationId)!;
    case 'poison':
    case 'spike':
    default:
      return ANIMATION_REF_BY_ID.get(animationRefs.utility.trapSpark.id as AnimationId)!;
  }
}

function buildTrapFxAction(args: {
  readonly abilityId: string;
  readonly animationRef: AnimationRefEntry;
  readonly anchorPos: Position;
  readonly sourcePos?: Position;
  readonly damage?: number;
  readonly targetId?: EntityId;
}): TrapBeatActionSpec {
  const { abilityId, animationRef, anchorPos, sourcePos, damage, targetId } = args;
  const impactFrameMs = animationRef.impactFrameMs;
  const hitStopMs = getAnimationRefHitStopMs(animationRef);
  const defenderHitDurationMs = hitStopMs ?? animationRef.recoveryMs;
  const isAoe = animationRef.category === 'aoe';
  const isUtility = animationRef.category === 'utility';
  const playerPos = sourcePos ?? anchorPos;
  const targetPos = animationRef.category === 'impact' || isAoe ? anchorPos : undefined;
  const impactTargetIds = targetId === undefined ? [] : [targetId];

  const events: PendingTrapAnimatedEvent[] = [
    {
      type: 'ability',
      beatRelativeDelayMs: 0,
      data: {
        abilityId,
        animationId: animationRef.id,
        selfTargeted: isUtility,
        playerPos,
        ...(targetPos !== undefined ? { targetPos } : {}),
        blastPositions: isAoe ? [anchorPos] : [],
        durationMs: animationRef.durationMs,
        impactFrameMs,
        suppressActorBump: getSuppressActorBump(animationRef),
      } satisfies AbilityAnimationEntry,
    },
    ...(damage !== undefined && damage > 0
      ? [{
          type: 'damage' as const,
          beatRelativeDelayMs: impactFrameMs,
          data: {
            text: `-${damage}`,
            type: 'damage',
            x: anchorPos.x,
            y: anchorPos.y,
          } satisfies CombatIndicatorEntry,
        }]
      : []),
    ...(hitStopMs !== undefined && impactTargetIds.length > 0
      ? [{
          type: 'hit-stop' as const,
          beatRelativeDelayMs: impactFrameMs,
          data: {
            durationMs: hitStopMs,
          } satisfies TrapHitStopEntry,
        }]
      : []),
    ...(hasImpactFlash(animationRef)
      ? impactTargetIds.map((entityId) => ({
          type: 'defender-hit' as const,
          beatRelativeDelayMs: impactFrameMs,
          data: {
            entityId,
            durationMs: defenderHitDurationMs,
            position: anchorPos,
          } satisfies TrapDefenderHitEntry,
        }))
      : []),
  ];

  return {
    settleMs: getBeatSettleMs({
      durationMs: animationRef.durationMs,
      impactFrameMs: animationRef.impactFrameMs,
      recoveryMs: animationRef.recoveryMs,
      hitStopMs,
    }),
    events,
  };
}

export function buildTrapPlacedAction(
  event: Extract<DomainEvent, { type: 'TRAP_PLACED' }>,
): TrapBeatActionSpec {
  const animationRef = ANIMATION_REF_BY_ID.get(animationRefs.utility.trapPlacement.id as AnimationId)!;
  return buildTrapFxAction({
    abilityId: 'trap_placed',
    animationRef,
    anchorPos: event.position,
  });
}

export function buildTrapDisarmedAction(
  event: Extract<DomainEvent, { type: 'TRAP_DISARMED' }>,
  state: GameState,
): TrapBeatActionSpec {
  const animationRef = ANIMATION_REF_BY_ID.get(animationRefs.impact.disarmStrike.id as AnimationId)!;
  const sourcePos = getEntityPosition(event.playerId, state);
  return buildTrapFxAction({
    abilityId: 'trap_disarmed',
    animationRef,
    anchorPos: event.position,
    ...(sourcePos !== null ? { sourcePos } : {}),
  });
}

export function buildTrapTriggeredAction(
  event: Extract<DomainEvent, { type: 'TRAP_TRIGGERED' }>,
): TrapBeatActionSpec {
  const animationRef = getTrapTriggerAnimationRef(event);
  const anchorPos = event.targetPosition ?? event.position;
  return buildTrapFxAction({
    abilityId: `trap_triggered_${event.hazardType ?? 'hazard'}`,
    animationRef,
    anchorPos,
    damage: event.damage,
    ...(event.targetId !== undefined ? { targetId: event.targetId } : {}),
  });
}
