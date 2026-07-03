import type { DomainEvent, GameState, EntityId } from '@dungeon/contracts';
import { STATUS_DEFINITIONS } from '@dungeon/content';

export interface CombatIndicatorEntry {
  readonly text: string;
  readonly type: 'damage' | 'heal' | 'status' | 'gold';
  readonly x: number;
  readonly y: number;
}

type Position = { readonly x: number; readonly y: number };

function buildAbilityTargetSnapshotLookup(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
): ReadonlyMap<EntityId, Position> {
  return new Map(
    (event.targetSnapshots ?? []).map((snapshot) => [snapshot.targetId, snapshot.position]),
  );
}

function getPos(
  id: EntityId,
  state: GameState,
  targetSnapshotLookup: ReadonlyMap<EntityId, Position> = new Map(),
): { x: number; y: number } | null {
  if (state.run == null) return null;
  const snapshotPosition = targetSnapshotLookup.get(id);
  if (snapshotPosition !== undefined) {
    return snapshotPosition;
  }
  if (id === state.player.id) return state.player.position;
  // state.run.enemies is keyed by position string, not entityId — must iterate
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === id) return enemy.position;
  }
  return null;
}

function buildIndicator(
  text: string,
  type: CombatIndicatorEntry['type'],
  x: number,
  y: number,
): CombatIndicatorEntry {
  return { text, type, x, y };
}

function handleAttackPerformed(
  event: Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>,
  _state: GameState,
): readonly CombatIndicatorEntry[] {
  const pos = event.position;
  const text = event.hit ? `-${event.damage}` : 'miss';
  return [buildIndicator(text, 'damage', pos.x, pos.y)];
}

function handleStatusApplied(
  event: Extract<DomainEvent, { type: 'STATUS_APPLIED' }>,
  state: GameState,
): readonly CombatIndicatorEntry[] {
  const pos = getPos(event.targetId, state);
  if (!pos) return [];
  const statusName = STATUS_DEFINITIONS.get(event.statusId)?.name ?? event.statusId;
  return [buildIndicator(statusName, 'status', pos.x, pos.y)];
}

function handleStatusDamageTick(
  event: Extract<DomainEvent, { type: 'STATUS_DAMAGE_TICK' }>,
  _state: GameState,
): readonly CombatIndicatorEntry[] {
  const pos = event.position;
  return [buildIndicator(`-${event.damage}`, 'damage', pos.x, pos.y)];
}

function buildTargetDamageIndicator(
  targetId: EntityId | undefined,
  damage: number | undefined,
  state: GameState,
  targetSnapshotLookup: ReadonlyMap<EntityId, Position>,
): readonly CombatIndicatorEntry[] {
  if (damage === undefined || damage <= 0 || targetId === undefined) return [];
  const pos = getPos(targetId, state, targetSnapshotLookup);
  return pos ? [buildIndicator(`-${damage}`, 'damage', pos.x, pos.y)] : [];
}

function handleAbilityUsed(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
  state: GameState,
): readonly CombatIndicatorEntry[] {
  const targetSnapshotLookup = buildAbilityTargetSnapshotLookup(event);

  // Emit damage indicators
  const damageIndicators = event.damageByTarget && event.damageByTarget.size > 0
    ? Array.from(event.damageByTarget).flatMap(([targetId, damage]) => {
        const pos = getPos(targetId, state, targetSnapshotLookup);
        return pos ? [buildIndicator(`-${damage}`, 'damage', pos.x, pos.y)] : [];
      })
    : buildTargetDamageIndicator(event.targetId, event.damage, state, targetSnapshotLookup);

  // Emit heal indicators
  if (event.healAmount === undefined || event.healAmount <= 0) return damageIndicators;
  if (event.targetId === undefined) return damageIndicators;
  const pos = getPos(event.targetId, state, targetSnapshotLookup);
  if (!pos) return damageIndicators;
  return [
    ...damageIndicators,
    buildIndicator(`+${event.healAmount}`, 'heal', pos.x, pos.y),
  ];
}

function handleGoldChanged(
  event: Extract<DomainEvent, { type: 'GOLD_CHANGED' }>,
  state: GameState,
): readonly CombatIndicatorEntry[] {
  if (event.amount <= 0) return [];
  const pos = getPos(event.playerId, state);
  if (!pos) return [];
  return [buildIndicator(`+${event.amount}g`, 'gold', pos.x, pos.y)];
}

function handleLifeSteal(
  event: Extract<DomainEvent, { type: 'LIFE_STEAL' }>,
  state: GameState,
): readonly CombatIndicatorEntry[] {
  const pos = getPos(event.playerId, state);
  if (!pos) return [];
  return [buildIndicator(`+${event.hpRestored}`, 'heal', pos.x, pos.y)];
}

function handleObjectInteracted(
  event: Extract<DomainEvent, { type: 'OBJECT_INTERACTED' }>,
): readonly CombatIndicatorEntry[] {
  if (event.healthDelta <= 0) return [];
  return [buildIndicator(`+${event.healthDelta}`, 'heal', event.position.x, event.position.y)];
}

function handleTrapTriggered(
  event: Extract<DomainEvent, { type: 'TRAP_TRIGGERED' }>,
): readonly CombatIndicatorEntry[] {
  return [buildIndicator(`-${event.damage}`, 'damage', event.position.x, event.position.y)];
}

function handleThornsReflected(
  event: Extract<DomainEvent, { type: 'THORNS_REFLECTED' }>,
  _state: GameState,
): readonly CombatIndicatorEntry[] {
  const pos = event.position;
  return [buildIndicator(`-${event.damageAmount}`, 'damage', pos.x, pos.y)];
}

function processEvent(
  event: DomainEvent,
  state: GameState,
): readonly CombatIndicatorEntry[] {
  switch (event.type) {
    case 'ATTACK_PERFORMED':
      return handleAttackPerformed(event, state);
    case 'STATUS_APPLIED':
      return handleStatusApplied(event, state);
    case 'STATUS_DAMAGE_TICK':
      return handleStatusDamageTick(event, state);
    case 'ABILITY_USED':
      return handleAbilityUsed(event, state);
    case 'GOLD_CHANGED':
      return handleGoldChanged(event, state);
    case 'LIFE_STEAL':
      return handleLifeSteal(event, state);
    case 'OBJECT_INTERACTED':
      return handleObjectInteracted(event);
    case 'TRAP_TRIGGERED':
      return handleTrapTriggered(event);
    case 'THORNS_REFLECTED':
      return handleThornsReflected(event, state);
    default:
      return [];
  }
}

export function buildCombatIndicators(
  events: readonly DomainEvent[],
  state: GameState,
): readonly CombatIndicatorEntry[] {
  if (state.run == null) return [];

  return events.flatMap((event) => processEvent(event, state));
}
