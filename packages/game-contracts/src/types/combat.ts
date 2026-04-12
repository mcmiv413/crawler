import type { EntityId, DamageType, StatusId } from './common.js';

export interface AttackResult {
  readonly attackerId: EntityId;
  readonly defenderId: EntityId;
  readonly hit: boolean;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly mitigated: number;
  readonly statusesApplied: readonly StatusId[];
  readonly defenderDied: boolean;
  readonly criticalHit: boolean;
  readonly missReason?: 'accuracy' | 'evasion';  // reason for miss: low accuracy or evaded
  readonly hitRoll?: number;  // actual roll [0, 100) for telemetry on misses
}

export interface CombatContext {
  readonly attackerId: EntityId;
  readonly defenderId: EntityId;
  readonly attackerAttack: number;
  readonly attackerAccuracy: number;
  readonly defenderDefense: number;
  readonly defenderEvasion: number;
  readonly defenderHealth: number;
  readonly damageType: DamageType;
  readonly defenderResistance: number;
}
