import type { DomainEvent, GameState, EntityId } from '@dungeon/contracts';
import type {
  BumpAnimationEntry,
  CombatIndicatorEntry,
  MoveAnimationEntry,
  MoveAnimStyle,
} from './game-view.js';

export interface AnimatedEvent {
  type: 'bump' | 'damage' | 'heal' | 'status' | 'move';
  sequenceIndex: number;
  delayMs: number;
  batchId: string;
  data: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry;
}

// ── Duration per style (ms) ──────────────────────────────────────
const MOVE_DURATIONS: Record<MoveAnimStyle, number> = {
  step:  140,
  slide: 180,
  dart:  150,
  drift: 240,
  stomp: 200,
  lurch: 220,
};

// ── Stagger between successive enemy moves (ms) ──────────────────
const MOVE_STAGGER_MS = 120;

// ────────────────────────────────────────────────────────────────

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
  if (entityId === state.player.id) return 'step';
  if (state.run == null) return 'slide';

  for (const enemy of state.run.enemies.values()) {
    if (enemy.id !== entityId) continue;

    // movementBehaviorId → most specific mapping
    switch (enemy.movementBehaviorId) {
      case 'wall_stalker':      return 'dart';
      case 'rearline_anchor':   return 'drift';
      case 'chokepoint_holder': return 'stomp';
      case 'ambush_idle':       return 'lurch';
    }

    // Archetype substring fallbacks
    const arch = enemy.archetype.toLowerCase();
    if (arch.includes('rogue') || arch.includes('shadow') || arch.includes('assassin')) return 'dart';
    if (arch.includes('mage') || arch.includes('ranged') || arch.includes('archer'))    return 'drift';
    if (arch.includes('brute') || arch.includes('guardian') || arch.includes('tank'))   return 'stomp';
    if (arch.includes('horror') || arch.includes('beast') || arch.includes('lurker'))   return 'lurch';

    return 'slide';
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
    orderedMoves.push({
      entityId: state.player.id,
      from: playerMoveEvent.from,
      to: playerMoveEvent.to,
    });
  }

  for (const { event } of sortedEnemyMoves) {
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
    const durationMs = MOVE_DURATIONS[style];

    const entry: MoveAnimationEntry = {
      entityId: move.entityId,
      fromPos: move.from,
      toPos: move.to,
      style,
      durationMs,
    };

    mutableAnimations.push({
      type: 'move',
      sequenceIndex: i,
      delayMs: i * MOVE_STAGGER_MS,
      batchId,
      data: entry,
    });
  }

  // ── 2. Attack (bump + damage indicator) animations ──────────────
  // Same logic as before — sorted by speed, staggered at 500ms each.

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
    const baseDelay = i * 500;

    const attackerPos = getEntityPosition(attack.event.attackerId, state);
    const defenderPos = getEntityPosition(attack.event.defenderId, state) || attack.event.position;
    if (!attackerPos || !defenderPos) continue;

    const bumpEntry: BumpAnimationEntry = {
      attackerId: attack.event.attackerId,
      defenderId: attack.event.defenderId,
      attackerPos,
      defenderPos,
    };

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

    mutableAnimations.push({
      type: 'damage',
      sequenceIndex,
      delayMs: baseDelay + 150,
      batchId,
      data: damageEntry,
    });
  }

  return mutableAnimations;
}
