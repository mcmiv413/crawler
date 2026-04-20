import type { DomainEvent, GameState, EntityId } from '@dungeon/contracts';
import type { BumpAnimationEntry, CombatIndicatorEntry } from './game-view.js';

export interface AnimatedEvent {
  type: 'bump' | 'damage' | 'heal' | 'status';
  sequenceIndex: number;
  delayMs: number;
  batchId: string;
  data: BumpAnimationEntry | CombatIndicatorEntry;
}

interface AttackerWithSpeed {
  attackerId: EntityId;
  speed: number;
  event: Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>;
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

export function buildAnimationSequence(
  events: readonly DomainEvent[],
  state: GameState,
): readonly AnimatedEvent[] {
  if (state.run == null) return [];

  // Generate unique batchId for this animation sequence
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Extract attack events with their speeds
  const attacksWithSpeeds: AttackerWithSpeed[] = [];
  for (const event of events) {
    if (event.type === 'ATTACK_PERFORMED') {
      const attackEvent = event as Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>;
      const speed = getEntitySpeed(attackEvent.attackerId, state);
      attacksWithSpeeds.push({
        attackerId: attackEvent.attackerId,
        speed,
        event: attackEvent,
      });
    }
  }

  // Sort by speed descending (highest speed first)
  attacksWithSpeeds.sort((a, b) => b.speed - a.speed);

  // Create animation entries with timing
  const mutableAnimations: AnimatedEvent[] = [];

  for (let i = 0; i < attacksWithSpeeds.length; i += 1) {
    const attack = attacksWithSpeeds[i];
    if (!attack) continue;

    const sequenceIndex = i;
    const baseDelay = sequenceIndex * 500;

    // Get attacker and defender positions
    const attackerPos = getEntityPosition(attack.event.attackerId, state);
    const defenderPos = getEntityPosition(attack.event.defenderId, state);
    if (!attackerPos || !defenderPos) continue;

    // Bump animation (starts immediately for this attack in sequence)
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

    // Damage indicator (100ms after bump starts)
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

  // Also process other indicator types (STATUS_APPLIED, ABILITY_USED with heal, etc.)
  // and add them with appropriate sequence indices
  // For now, keep focus on attacks and damages

  return mutableAnimations;
}
