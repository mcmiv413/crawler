import type { DomainEvent, GameState, EntityId } from '@dungeon/contracts';

export interface BumpAnimationEntry {
  readonly attackerId: EntityId;
  readonly defenderId: EntityId;
  readonly attackerPos: { readonly x: number; readonly y: number };
  readonly defenderPos: { readonly x: number; readonly y: number };
}

function getPos(id: EntityId, state: GameState): { x: number; y: number } | null {
  if (state.run == null) return null;
  if (id === state.player.id) return state.player.position;
  // state.run.enemies is keyed by position string, not entityId — must iterate
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === id) return enemy.position;
  }
  return null;
}

function buildAnimation(
  attackerId: EntityId,
  defenderId: EntityId,
  attackerPos: { x: number; y: number },
  defenderPos: { x: number; y: number },
): BumpAnimationEntry {
  return {
    attackerId,
    defenderId,
    attackerPos,
    defenderPos,
  };
}

function handleAttackPerformed(
  event: Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>,
  state: GameState,
): readonly BumpAnimationEntry[] {
  const attackerPos = getPos(event.attackerId, state);
  const defenderPos = getPos(event.defenderId, state);
  if (!attackerPos || !defenderPos) return [];

  return [buildAnimation(event.attackerId, event.defenderId, attackerPos, defenderPos)];
}

function processEvent(
  event: DomainEvent,
  state: GameState,
): readonly BumpAnimationEntry[] {
  switch (event.type) {
    case 'ATTACK_PERFORMED':
      return handleAttackPerformed(event, state);
    default:
      return [];
  }
}

export function buildBumpAnimations(
  events: readonly DomainEvent[],
  state: GameState,
): readonly BumpAnimationEntry[] {
  if (state.run == null) return [];

  return events.flatMap((event) => processEvent(event, state));
}
