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

function addIndicator(
  mutableIndicators: CombatIndicatorEntry[],
  text: string,
  type: CombatIndicatorEntry['type'],
  x: number,
  y: number,
): void {
  mutableIndicators.push({ text, type, x, y });
}

function handleAttackPerformed(
  event: Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  const pos = getPos(event.defenderId, state);
  if (!pos) return;
  const text = event.hit ? `-${event.damage}` : 'miss';
  addIndicator(indicators, text, 'damage', pos.x, pos.y);
}

function handleStatusApplied(
  event: Extract<DomainEvent, { type: 'STATUS_APPLIED' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  const pos = getPos(event.targetId, state);
  if (!pos) return;
  const statusName = STATUS_DEFINITIONS.get(event.statusId)?.name ?? event.statusId;
  addIndicator(indicators, statusName, 'status', pos.x, pos.y);
}

function handleStatusDamageTick(
  event: Extract<DomainEvent, { type: 'STATUS_DAMAGE_TICK' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  const pos = getPos(event.targetId, state);
  if (!pos) return;
  addIndicator(indicators, `-${event.damage}`, 'damage', pos.x, pos.y);
}

function handleAbilityUsed(
  event: Extract<DomainEvent, { type: 'ABILITY_USED' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  const targetSnapshotLookup = buildAbilityTargetSnapshotLookup(event);

  // Emit damage indicators
  if (event.damageByTarget && event.damageByTarget.size > 0) {
    for (const [targetId, damage] of event.damageByTarget) {
      const pos = getPos(targetId, state, targetSnapshotLookup);
      if (pos) {
        addIndicator(indicators, `-${damage}`, 'damage', pos.x, pos.y);
      }
    }
  } else if (event.damage !== undefined && event.damage > 0 && event.targetId !== undefined) {
    const pos = getPos(event.targetId, state, targetSnapshotLookup);
    if (pos) {
      addIndicator(indicators, `-${event.damage}`, 'damage', pos.x, pos.y);
    }
  }

  // Emit heal indicators
  if (event.healAmount === undefined || event.healAmount <= 0) return;
  if (event.targetId === undefined) return;
  const pos = getPos(event.targetId, state, targetSnapshotLookup);
  if (!pos) return;
  addIndicator(indicators, `+${event.healAmount}`, 'heal', pos.x, pos.y);
}

function handleGoldChanged(
  event: Extract<DomainEvent, { type: 'GOLD_CHANGED' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  if (event.amount <= 0) return;
  const pos = getPos(event.playerId, state);
  if (!pos) return;
  addIndicator(indicators, `+${event.amount}g`, 'gold', pos.x, pos.y);
}

function handleLifeSteal(
  event: Extract<DomainEvent, { type: 'LIFE_STEAL' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  const pos = getPos(event.playerId, state);
  if (!pos) return;
  addIndicator(indicators, `+${event.hpRestored}`, 'heal', pos.x, pos.y);
}

function handleObjectInteracted(
  event: Extract<DomainEvent, { type: 'OBJECT_INTERACTED' }>,
  indicators: CombatIndicatorEntry[],
): void {
  if (event.healthDelta <= 0) return;
  addIndicator(indicators, `+${event.healthDelta}`, 'heal', event.position.x, event.position.y);
}

function handleTrapTriggered(
  event: Extract<DomainEvent, { type: 'TRAP_TRIGGERED' }>,
  indicators: CombatIndicatorEntry[],
): void {
  addIndicator(indicators, `-${event.damage}`, 'damage', event.position.x, event.position.y);
}

function handleThornsReflected(
  event: Extract<DomainEvent, { type: 'THORNS_REFLECTED' }>,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  const pos = getPos(event.targetId, state);
  if (!pos) return;
  addIndicator(indicators, `-${event.damageAmount}`, 'damage', pos.x, pos.y);
}

function processEvent(
  event: DomainEvent,
  state: GameState,
  indicators: CombatIndicatorEntry[],
): void {
  switch (event.type) {
    case 'ATTACK_PERFORMED':
      return handleAttackPerformed(event, state, indicators);
    case 'STATUS_APPLIED':
      return handleStatusApplied(event, state, indicators);
    case 'STATUS_DAMAGE_TICK':
      return handleStatusDamageTick(event, state, indicators);
    case 'ABILITY_USED':
      return handleAbilityUsed(event, state, indicators);
    case 'GOLD_CHANGED':
      return handleGoldChanged(event, state, indicators);
    case 'LIFE_STEAL':
      return handleLifeSteal(event, state, indicators);
    case 'OBJECT_INTERACTED':
      return handleObjectInteracted(event, indicators);
    case 'TRAP_TRIGGERED':
      return handleTrapTriggered(event, indicators);
    case 'THORNS_REFLECTED':
      return handleThornsReflected(event, state, indicators);
  }
}

export function buildCombatIndicators(
  events: readonly DomainEvent[],
  state: GameState,
): readonly CombatIndicatorEntry[] {
  if (state.run == null) return [];

  const mutableIndicators: CombatIndicatorEntry[] = [];

  for (const event of events) {
    processEvent(event, state, mutableIndicators);
  }

  return mutableIndicators;
}
