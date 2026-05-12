import type { EntityId, Position, StatusId, DamageType } from './common.js';
import type { AnyItemTemplate } from './items.js';

export interface DeathStashItem {
  readonly slot: string;
  readonly item: AnyItemTemplate;
  readonly entityId: EntityId;
}

export interface DeathStash {
  readonly items: readonly DeathStashItem[];
  readonly floor: number;
  readonly position: Position;
}

export interface PlayerAbility {
  readonly id: string;
  readonly cooldownRemaining: number;
}

export interface PlayerStats {
  readonly maxHealth: number;
  readonly health: number;
  readonly attack: number;
  readonly defense: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly speed: number;
  readonly resistances?: Partial<Record<DamageType, number>>;
}

export interface StatusEffect {
  readonly id: StatusId;
  readonly turnsRemaining: number;
  readonly magnitude: number;
  readonly sourceId: EntityId | null;
}

export interface Equipment {
  readonly weapon: EntityId | null;
  readonly secondaryWeapon: EntityId | null;  // C5: secondary weapon slot for quick swap
  readonly chest: EntityId | null;
  readonly head: EntityId | null;
  readonly gloves: EntityId | null;
  readonly boots: EntityId | null;
  readonly ring1: EntityId | null;
  readonly ring2: EntityId | null;
}

export type RingMasteryState = Record<string, { readonly xp: number }>

export interface Player {
  readonly id: EntityId;
  readonly name: string;
  readonly level: number;
  readonly experience: number;
  readonly stats: PlayerStats;
  readonly baseStats: PlayerStats;
  readonly position: Position;
  readonly equipment: Equipment;
  readonly inventory: readonly EntityId[];
  readonly statuses: readonly StatusEffect[];
  readonly abilities: readonly PlayerAbility[];
  readonly gold: number;
  readonly floor: number;
  readonly totalKills: number;
  readonly totalDeaths: number;
  readonly totalRuns: number;
  readonly deathStash: DeathStash | null;
  readonly mana: number;
  readonly maxMana: number;
  readonly ringMastery: RingMasteryState;
  readonly learnedRingSpellIds: readonly string[];
}
