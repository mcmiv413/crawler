import type {
  AbilityTargetSnapshot,
  BlueprintUnlockedEvent,
  DomainEvent,
  EnchantmentAppliedEvent,
  EntityId,
  GoldChangedEvent,
  ManaChangedEvent,
  SpellUnlockedEvent,
  StatusAppliedEvent,
  StatusId,
} from '@dungeon/contracts';
import type { AbilityContext } from '../types.js';

interface AbilityExecutionResult {
  damage?: number;
  healAmount?: number;
  targetId?: EntityId;
  targetName?: string;
  hit?: boolean;
  damageByTarget?: ReadonlyMap<EntityId, number>;
  affectedTargetIds?: readonly EntityId[];
  targetSnapshots?: readonly AbilityTargetSnapshot[];
}

/**
 * Build an ABILITY_USED event from context and execution results.
 */
export function buildAbilityUsedEvent(
  context: AbilityContext,
  abilityId: string,
  abilityName: string,
  result: AbilityExecutionResult,
): DomainEvent[] {
  const damage = result.damageByTarget !== undefined
    ? Array.from(result.damageByTarget.values()).reduce((sum, val) => sum + val, 0)
    : result.damage;

  const event: DomainEvent = {
    type: 'ABILITY_USED',
    playerId: context.player.id,
    abilityId,
    abilityName,
    targetId: result.targetId,
    targetName: result.targetName,
    hit: result.hit ?? true,
    damage,
    healAmount: result.healAmount,
    damageByTarget: result.damageByTarget,
    affectedTargetIds: result.affectedTargetIds,
    targetSnapshots: result.targetSnapshots,
    timestamp: context.state.turnNumber,
    turnNumber: context.state.turnNumber,
  };

  return [event];
}

/**
 * Build a STATUS_APPLIED event. All status application paths must construct
 * the event through this factory so the shape stays centralized.
 */
export function buildStatusAppliedEvent(params: {
  readonly targetId: EntityId;
  readonly statusId: StatusId;
  readonly duration: number;
  readonly sourceId: EntityId | null;
  readonly turnNumber: number;
}): StatusAppliedEvent {
  return {
    type: 'STATUS_APPLIED',
    targetId: params.targetId,
    statusId: params.statusId,
    duration: params.duration,
    sourceId: params.sourceId,
    timestamp: params.turnNumber,
    turnNumber: params.turnNumber,
  };
}

/** Build a GOLD_CHANGED event through the central factory. */
export function buildGoldChangedEvent(params: {
  readonly playerId: EntityId;
  readonly amount: number;
  readonly newTotal: number;
  readonly reason: string;
  readonly turnNumber: number;
}): GoldChangedEvent {
  return {
    type: 'GOLD_CHANGED',
    playerId: params.playerId,
    amount: params.amount,
    newTotal: params.newTotal,
    reason: params.reason,
    timestamp: params.turnNumber,
    turnNumber: params.turnNumber,
  };
}

/** Build a MANA_CHANGED event through the central factory. */
export function buildManaChangedEvent(params: {
  readonly playerId: EntityId;
  readonly amount: number;
  readonly newTotal: number;
  readonly reason: string;
  readonly turnNumber: number;
}): ManaChangedEvent {
  return {
    type: 'MANA_CHANGED',
    playerId: params.playerId,
    amount: params.amount,
    newTotal: params.newTotal,
    reason: params.reason,
    timestamp: params.turnNumber,
    turnNumber: params.turnNumber,
  };
}

/** Build a SPELL_UNLOCKED event through the central factory. */
export function buildSpellUnlockedEvent(params: {
  readonly playerId: EntityId;
  readonly spellId: string;
  readonly spellName: string;
  readonly turnNumber: number;
}): SpellUnlockedEvent {
  return {
    type: 'SPELL_UNLOCKED',
    playerId: params.playerId,
    spellId: params.spellId,
    spellName: params.spellName,
    timestamp: params.turnNumber,
    turnNumber: params.turnNumber,
  };
}

/** Build an ENCHANTMENT_APPLIED event through the central factory. */
export function buildEnchantmentAppliedEvent(params: {
  readonly playerId: EntityId;
  readonly itemId: EntityId;
  readonly itemName: string;
  readonly enchantmentId: string;
  readonly enchantmentName: string;
  readonly slot: string;
  readonly turnNumber: number;
}): EnchantmentAppliedEvent {
  return {
    type: 'ENCHANTMENT_APPLIED',
    playerId: params.playerId,
    itemId: params.itemId,
    itemName: params.itemName,
    enchantmentId: params.enchantmentId,
    enchantmentName: params.enchantmentName,
    slot: params.slot,
    timestamp: params.turnNumber,
    turnNumber: params.turnNumber,
  };
}

/** Build a BLUEPRINT_UNLOCKED event through the central factory. */
export function buildBlueprintUnlockedEvent(params: {
  readonly playerId: EntityId;
  readonly blueprintIds: readonly string[];
  readonly turnNumber: number;
}): BlueprintUnlockedEvent {
  return {
    type: 'BLUEPRINT_UNLOCKED',
    playerId: params.playerId,
    blueprintIds: params.blueprintIds,
    timestamp: params.turnNumber,
    turnNumber: params.turnNumber,
  };
}
