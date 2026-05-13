import type { DomainEvent, GameState, EntityId, EnemyInstance } from '@dungeon/contracts';
import type {
  BumpAnimationEntry,
  CombatIndicatorEntry,
  MoveAnimationEntry,
  MoveAnimStyle,
  ConsumableAnimationEntry,
  AbilityAnimationEntry,
} from './game-view.js';
import {
  ANIMATION_TIMING,
  getConsumableAnimationMetadata,
  getConsumableBlastPositions,
  getMoveAnimationStyle,
  getMoveDurationMs,
} from './animation-metadata.js';
import { ABILITY_DEFINITIONS, ANIMATION_REF_BY_ID } from '@dungeon/content';
import type { AnimationId } from '@dungeon/content';

export interface HitStopEntry {
  durationMs: number;
}

export interface DefenderHitEntry {
  entityId: string;
  durationMs: number;
}

export interface AnimatedEvent {
  type: 'bump' | 'damage' | 'heal' | 'status' | 'move' | 'consumable' | 'ability' | 'hit-stop' | 'defender-hit';
  sequenceIndex: number;
  delayMs: number;
  batchId: string;
  data: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry | ConsumableAnimationEntry | AbilityAnimationEntry | HitStopEntry | DefenderHitEntry;
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

function getConsumableAnimationId(
  event: Extract<DomainEvent, { type: 'ITEM_USED' }>,
  state: GameState,
): AnimationId | undefined {
  const template = state.itemRegistry.items.get(event.itemId);
  if (template === undefined || !('animation' in template)) return undefined;

  const animation = (template as { readonly animation?: { readonly id?: string } }).animation;
  return animation?.id as AnimationId | undefined;
}

/**
 * Derive the movement animation style for an entity.
 * Checks movementBehaviorId first (most specific), then falls back to archetype
 * substring matching, then defaults to 'slide'.
 */
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

function getLastAttackImpactDelayMs(
  maxAbilityDurationMs: number,
  attackCount: number,
): number {
  if (attackCount === 0) {
    return maxAbilityDurationMs;
  }

  return maxAbilityDurationMs
    + ((attackCount - 1) * ANIMATION_TIMING.attackStaggerMs)
    + ANIMATION_TIMING.damageIndicatorDelayMs;
}

export function buildAnimationSequence(
  events: readonly DomainEvent[],
  state: GameState,
): readonly AnimatedEvent[] {
  if (state.run == null) return [];

  const batchId = buildAnimationBatchId(events, state);
  const mutableAnimations: AnimatedEvent[] = [];

  // ── 1. Movement animations ──────────────────────────────────────
  // Collect player and enemy move events, then stagger them in speed order.

  const playerMoveEvent = events.find(
    (e): e is Extract<DomainEvent, { type: 'PLAYER_MOVED' }> => e.type === 'PLAYER_MOVED',
  );

  const enemyMoveEvents = events
    .filter((e): e is Extract<DomainEvent, { type: 'ENEMY_MOVED' }> => e.type === 'ENEMY_MOVED')
    .map((e) => ({ event: e, speed: getEntitySpeed(e.enemyId, state) }));

  // Sort enemies by speed descending — fastest acts first visually
  // eslint-disable-next-line dungeon/no-array-mutation
  const sortedEnemyMoves = [...enemyMoveEvents].sort((a, b) => b.speed - a.speed);

  // Build ordered list: player first, then enemies by speed
  interface MoveEntry { entityId: EntityId; from: { x: number; y: number }; to: { x: number; y: number } }
  const orderedMoves: MoveEntry[] = [];

  if (playerMoveEvent) {
    // eslint-disable-next-line dungeon/no-array-mutation
    orderedMoves.push({
      entityId: state.player.id,
      from: playerMoveEvent.from,
      to: playerMoveEvent.to,
    });
  }

  for (const { event } of sortedEnemyMoves) {
    // eslint-disable-next-line dungeon/no-array-mutation
    orderedMoves.push({
      entityId: event.enemyId,
      from: event.from,
      to: event.to,
    });
  }

  for (let i = 0; i < orderedMoves.length; i += 1) {
    const move = orderedMoves[i];
    if (!move) continue;

    const style = getMoveStyle(move.entityId, state);
    const durationMs = getMoveDurationMs(style);

    const entry: MoveAnimationEntry = {
      entityId: move.entityId,
      fromPos: move.from,
      toPos: move.to,
      style,
      durationMs,
    };
//HUMANNOTE: I don't undertand why it is ok for this to be mutable.
    mutableAnimations.push({
      type: 'move',
      sequenceIndex: i,
      delayMs: i * ANIMATION_TIMING.moveStaggerMs,
      batchId,
      data: entry,
    });
  }

  // ── 2. Ability animations ───────────────────────────────────────
  // Resolved from ABILITY_USED events using the ability catalog.
  // Fire FIRST (before attacks/damage) at the start of the turn.

  const abilityUsedEvents = events.filter(
    (e): e is Extract<DomainEvent, { type: 'ABILITY_USED' }> => e.type === 'ABILITY_USED',
  );

  for (let i = 0; i < abilityUsedEvents.length; i += 1) {
    const event = abilityUsedEvents[i];
    if (!event) continue;

    const abilityDef = ABILITY_DEFINITIONS.get(event.abilityId);
    if (!abilityDef || !abilityDef.animation?.id) continue;

    const animRef = ANIMATION_REF_BY_ID.get(abilityDef.animation.id as AnimationId);
    if (!animRef) continue;

    const playerPos = state.player.position;
    const targetPos = event.targetId ? getEntityPosition(event.targetId, state) : undefined;

    let blastPositions: Array<{ x: number; y: number }> = [];
    let targetHpFraction: number | undefined;

    // Handle special ability shapes based on ability ID
    if (event.abilityId === 'axe_cleave' && event.damageByTarget) {
      // Cleave: animation at each affected enemy position
      blastPositions = Array.from(event.damageByTarget.keys()).flatMap((targetId) => {
        const position = getEntityPosition(targetId, state);
        return position === null ? [] : [position];
      });
    } else if (event.abilityId === 'ranged_volley') {
      // Volley: prefer actual hit positions, then fall back to visible enemies.
      blastPositions = event.damageByTarget
        ? Array.from(event.damageByTarget.keys()).flatMap((targetId) => {
            const position = getEntityPosition(targetId, state);
            return position === null ? [] : [position];
          })
        : Array.from(state.run.enemies.values()).map(enemy => enemy.position);
    } else if (event.abilityId === 'axe_execute') {
      // Execute: compute HP fraction from target's current health
      if (event.targetId) {
        const targetEnemy = getEnemyById(event.targetId, state);
        if (targetEnemy && targetEnemy.stats.maxHealth > 0) {
          targetHpFraction = targetEnemy.stats.health / targetEnemy.stats.maxHealth;
        }
      }
    } else if (event.abilityId === 'cinder_wake' && event.affectedTargetIds !== undefined) {
      blastPositions = event.affectedTargetIds.flatMap((targetId) => {
        const position = getEntityPosition(targetId, state);
        return position === null ? [] : [position];
      });
    }

    const sequenceIndex = orderedMoves.length + i;

    mutableAnimations.push({
      type: 'ability',
      sequenceIndex,
      delayMs: 0,
      batchId,
      data: {
        abilityId: event.abilityId,
        animationId: animRef.id,
        playerPos,
        targetPos: targetPos ?? undefined,
        blastPositions,
        targetHpFraction,
        durationMs: animRef.durationMs,
        suppressActorBump: 'suppressActorBump' in animRef && animRef.suppressActorBump ? true : false,
      } satisfies AbilityAnimationEntry,
    });
  }

  // Calculate max ability animation duration to stagger attacks after them
  let maxAbilityDurationMs = 0;
  for (const event of abilityUsedEvents) {
    const abilityDef = ABILITY_DEFINITIONS.get(event.abilityId);
    if (abilityDef?.animation?.id) {
      const animRef = ANIMATION_REF_BY_ID.get(abilityDef.animation.id as AnimationId);
      if (animRef && animRef.durationMs > maxAbilityDurationMs) {
        maxAbilityDurationMs = animRef.durationMs;
      }
    }
  }

  // ── 2b. Ability damage indicators ────────────────────────────────
  // Create damage indicators for abilities that deal damage.
  // These appear at the target position(s), delayed until after animation starts.

  for (let i = 0; i < abilityUsedEvents.length; i += 1) {
    const event = abilityUsedEvents[i];
    if (!event) continue;

    const abilityDef = ABILITY_DEFINITIONS.get(event.abilityId);
    if (!abilityDef || !abilityDef.animation?.id) continue;

    const animRef = ANIMATION_REF_BY_ID.get(abilityDef.animation.id as AnimationId);
    if (!animRef) continue;

    // Determine damage positions and amounts based on ability type
    let mutableDamagePositions: Array<{ pos: { x: number; y: number }; damage: number }> = [];
    const impactTargetIds = event.damageByTarget
      ? Array.from(new Set(event.damageByTarget.keys()))
      : event.affectedTargetIds !== undefined
        ? Array.from(new Set(event.affectedTargetIds))
        : event.targetId !== undefined
          ? [event.targetId]
          : [];

    if (event.abilityId === 'axe_cleave' && event.damageByTarget) {
      // Cleave: damage at each affected position
      for (const [targetId, damage] of event.damageByTarget.entries()) {
        const position = getEntityPosition(targetId, state);
        if (position) {
          mutableDamagePositions.push({ pos: position, damage });
        }
      }
    } else if (event.abilityId === 'ranged_volley' && event.damageByTarget) {
      // Volley: damage at each hit enemy position
      for (const [targetId, damage] of event.damageByTarget.entries()) {
        const position = getEntityPosition(targetId, state);
        if (position) {
          mutableDamagePositions.push({ pos: position, damage });
        }
      }
    } else if (event.targetId && event.damage !== undefined && event.damage > 0) {
      // Single-target ability with damage
      const targetPos = getEntityPosition(event.targetId, state);
      if (targetPos) {
        mutableDamagePositions.push({ pos: targetPos, damage: event.damage });
      }
    }

    const sequenceIndex = orderedMoves.length + abilityUsedEvents.length + i;
    const impactDelayMs = animRef.durationMs;
    const impactHitStopMs = 'hitStopMs' in animRef ? animRef.hitStopMs : undefined;
    const impactFlash = 'impactFlash' in animRef ? animRef.impactFlash === true : false;

    // Create damage indicators for each position
    for (const { pos, damage } of mutableDamagePositions) {
      const damageEntry: CombatIndicatorEntry = {
        text: `-${damage}`,
        type: 'damage',
        x: pos.x,
        y: pos.y,
      };

      mutableAnimations.push({
        type: 'damage',
        sequenceIndex,
        delayMs: impactDelayMs,  // Appear during animation, not after
        batchId,
        data: damageEntry,
      });
    }

    if (impactHitStopMs !== undefined && impactTargetIds.length > 0) {
      mutableAnimations.push({
        type: 'hit-stop',
        sequenceIndex,
        delayMs: impactDelayMs,
        batchId,
        data: {
          durationMs: impactHitStopMs,
        } satisfies HitStopEntry,
      });
    }

    if (impactFlash) {
      const defenderHitDurationMs = impactHitStopMs ?? ANIMATION_TIMING.damageIndicatorDelayMs;
      for (const targetId of impactTargetIds) {
        mutableAnimations.push({
          type: 'defender-hit',
          sequenceIndex,
          delayMs: impactDelayMs,
          batchId,
          data: {
            entityId: targetId,
            durationMs: defenderHitDurationMs,
          } satisfies DefenderHitEntry,
        });
      }
    }
  }

  // ── 3. Attack (bump + damage indicator) animations ──────────────
  // Sorted by speed, staggered, and delayed until after abilities complete.

  let attacksWithSpeeds = events
    .filter((event): event is Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }> => event.type === 'ATTACK_PERFORMED')
    .map((attackEvent) => ({
      attackerId: attackEvent.attackerId,
      speed: getEntitySpeed(attackEvent.attackerId, state),
      event: attackEvent,
    }));

  // eslint-disable-next-line dungeon/no-array-mutation
  const mutableSorted = [...attacksWithSpeeds].sort((a, b) => b.speed - a.speed);
  attacksWithSpeeds = mutableSorted;

  for (let i = 0; i < attacksWithSpeeds.length; i += 1) {
    const attack = attacksWithSpeeds[i];
    if (!attack) continue;

    const sequenceIndex = orderedMoves.length + abilityUsedEvents.length + i; // continue sequence after moves and abilities
    const baseDelay = maxAbilityDurationMs + i * ANIMATION_TIMING.attackStaggerMs;

    const attackerPos = getEntityPosition(attack.event.attackerId, state);
    const defenderPos = getEntityPosition(attack.event.defenderId, state) || attack.event.position;
    if (!attackerPos || !defenderPos) continue;

    const bumpEntry: BumpAnimationEntry = {
      attackerId: attack.event.attackerId,
      defenderId: attack.event.defenderId,
      attackerPos,
      defenderPos,
    };
//HUMANNOTE: I don't undertand why it is ok for this to be mutable.
    mutableAnimations.push({
      type: 'bump',
      sequenceIndex,
      delayMs: baseDelay,
      batchId,
      data: bumpEntry,
    });

    const damageText = attack.event.hit ? `-${attack.event.damage}` : 'miss';
    const damageEntry: CombatIndicatorEntry = {
      text: damageText,
      type: 'damage',
      x: defenderPos.x,
      y: defenderPos.y,
    };
//HUMANNOTE: I don't undertand why it is ok for this to be mutable.
    mutableAnimations.push({
      type: 'damage',
      sequenceIndex,
      delayMs: baseDelay + ANIMATION_TIMING.damageIndicatorDelayMs,
      batchId,
      data: damageEntry,
    });
  }

  const lastAttackImpactDelayMs = getLastAttackImpactDelayMs(maxAbilityDurationMs, attacksWithSpeeds.length);

  // ── 3b. Status damage indicators ───────────────────────────────────
  const statusDamageTickEvents = events.filter(
    (event): event is Extract<DomainEvent, { type: 'STATUS_DAMAGE_TICK' }> => event.type === 'STATUS_DAMAGE_TICK',
  );

  for (let i = 0; i < statusDamageTickEvents.length; i += 1) {
    const event = statusDamageTickEvents[i];
    if (!event) continue;

    const targetPos = getEntityPosition(event.targetId, state);
    if (!targetPos) continue;

    mutableAnimations.push({
      type: 'damage',
      sequenceIndex: orderedMoves.length + abilityUsedEvents.length + attacksWithSpeeds.length + i,
      delayMs: lastAttackImpactDelayMs + (i * ANIMATION_TIMING.damageIndicatorDelayMs),
      batchId,
      data: {
        text: `-${event.damage}`,
        type: 'damage',
        x: targetPos.x,
        y: targetPos.y,
      } satisfies CombatIndicatorEntry,
    });
  }

  // ── 4. Consumable animations ────────────────────────────────────
  // One consumable per turn max. Fires at delay 0 — concurrent with movement.

  const itemUsedEvents = events.filter(
    (e): e is Extract<DomainEvent, { type: 'ITEM_USED' }> => e.type === 'ITEM_USED',
  );

  for (let i = 0; i < itemUsedEvents.length; i += 1) {
    const event = itemUsedEvents[i];
    if (!event) continue;

    const playerPos = state.player.position;
    const { effect, presentation } = getConsumableAnimationMetadata(event.effect);
    const animationId = getConsumableAnimationId(event, state);
    const animationRef = animationId === undefined ? undefined : ANIMATION_REF_BY_ID.get(animationId);
    const blastPositions = getConsumableBlastPositions(playerPos, presentation);

    const entry: ConsumableAnimationEntry = {
      effect,
      playerPos,
      blastPositions,
      durationMs: animationRef?.durationMs ?? presentation.durationMs,
      presentation,
      ...(animationRef !== undefined ? { animationId: animationRef.id } : {}),
    };

    const sequenceIndex = orderedMoves.length + abilityUsedEvents.length + attacksWithSpeeds.length + statusDamageTickEvents.length + i;

    mutableAnimations.push({
      type: 'consumable',
      sequenceIndex,
      delayMs: lastAttackImpactDelayMs + (statusDamageTickEvents.length * ANIMATION_TIMING.damageIndicatorDelayMs),
      batchId,
      data: entry,
    });
  }

  return mutableAnimations;
}
