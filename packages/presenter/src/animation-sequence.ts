import type { DomainEvent, GameState, EntityId } from '@dungeon/contracts';
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

export interface AnimatedEvent {
  type: 'bump' | 'damage' | 'heal' | 'status' | 'move' | 'consumable' | 'ability';
  sequenceIndex: number;
  delayMs: number;
  batchId: string;
  data: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry | ConsumableAnimationEntry | AbilityAnimationEntry;
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

  // ── 2. Attack (bump + damage indicator) animations ──────────────
  // Same logic as before: sorted by speed, staggered by shared timing metadata.

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

    const sequenceIndex = orderedMoves.length + i; // continue sequence after moves
    const baseDelay = i * ANIMATION_TIMING.attackStaggerMs;

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

  // ── 3. Consumable animations ────────────────────────────────────
  // One consumable per turn max. Fires at delay 0 — concurrent with movement.

  const itemUsedEvents = events.filter(
    (e): e is Extract<DomainEvent, { type: 'ITEM_USED' }> => e.type === 'ITEM_USED',
  );

  for (let i = 0; i < itemUsedEvents.length; i += 1) {
    const event = itemUsedEvents[i];
    if (!event) continue;

    const playerPos = state.player.position;
    const { effect, presentation } = getConsumableAnimationMetadata(event.effect);
    const blastPositions = getConsumableBlastPositions(playerPos, presentation);

    const entry: ConsumableAnimationEntry = {
      effect,
      playerPos,
      blastPositions,
      durationMs: presentation.durationMs,
      presentation,
    };

    const sequenceIndex = orderedMoves.length + attacksWithSpeeds.length + i;

    mutableAnimations.push({
      type: 'consumable',
      sequenceIndex,
      delayMs: 0,
      batchId,
      data: entry,
    });
  }

  // ── 4. Ability animations ───────────────────────────────────────
  // Resolved from ABILITY_USED events using the ability catalog.

  const abilityUsedEvents = events.filter(
    (e): e is Extract<DomainEvent, { type: 'ABILITY_USED' }> => e.type === 'ABILITY_USED',
  );

  for (let i = 0; i < abilityUsedEvents.length; i += 1) {
    const event = abilityUsedEvents[i];
    if (!event) continue;

    const abilityDef = ABILITY_DEFINITIONS.get(event.abilityId);
    if (!abilityDef || !abilityDef.animation?.id) continue;

    const animRef = ANIMATION_REF_BY_ID.get(abilityDef.animation.id as keyof typeof animRef);
    if (!animRef) continue;

    const playerPos = state.player.position;
    const targetPos = event.targetId ? getEntityPosition(event.targetId, state) : undefined;

    let blastPositions: Array<{ x: number; y: number }> = [];
    let targetHpFraction: number | undefined;

    // Handle special ability shapes based on ability ID
    if (event.abilityId === 'axe_cleave' && targetPos) {
      // Cleave: 8 adjacent tiles around target
      const directions = [
        { x: 0, y: -1 },   // n
        { x: 1, y: -1 },   // ne
        { x: 1, y: 0 },    // e
        { x: 1, y: 1 },    // se
        { x: 0, y: 1 },    // s
        { x: -1, y: 1 },   // sw
        { x: -1, y: 0 },   // w
        { x: -1, y: -1 },  // nw
      ];
      blastPositions = directions.map(d => ({ x: targetPos.x + d.x, y: targetPos.y + d.y }));
    } else if (event.abilityId === 'ranged_volley') {
      // Volley: all visible enemy positions
      const volleyPositions: Array<{ x: number; y: number }> = [];
      state.run.enemies.forEach(enemy => {
        // eslint-disable-next-line dungeon/no-array-mutation
        volleyPositions.push(enemy.position);
      });
      blastPositions = volleyPositions;
    } else if (event.abilityId === 'axe_execute') {
      // Execute: compute HP fraction from target's current health
      if (event.targetId) {
        const targetEnemy = state.run.enemies.get(event.targetId);
        if (targetEnemy && targetEnemy.stats.maxHealth > 0) {
          targetHpFraction = targetEnemy.stats.health / targetEnemy.stats.maxHealth;
        }
      }
    }

    const sequenceIndex = orderedMoves.length + attacksWithSpeeds.length + itemUsedEvents.length + i;

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

  return mutableAnimations;
}
