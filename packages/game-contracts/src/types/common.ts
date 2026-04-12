/** Unique identifier for entities */
export type EntityId = string & { readonly __brand: 'EntityId' };

/** Position on a 2D grid */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/** Sprite rectangle from sprite sheet */
export interface SpriteRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Cardinal + diagonal directions */
export type Direction = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

/** Damage types in the game */
export type DamageType = 'physical' | 'fire' | 'frost' | 'poison' | 'shock' | 'corruption' | 'arcane' | 'shadow';

/** Status effect identifiers */
export type StatusId = 'poison' | 'burn' | 'slow' | 'stun' | 'bleed' | 'weaken' | 'vulnerability' | 'regeneration' | 'strength';

/** Tile types on a dungeon map */
export type TileType = 'floor' | 'wall' | 'door' | 'obstacle' | 'hazard' | 'chest' | 'stairs_down' | 'stairs_up' | 'event' | 'interactable';

/** Visibility states for fog of war */
export type Visibility = 'hidden' | 'remembered' | 'visible';

/** Threat tiers for enemies */
export type ThreatTier = 1 | 2 | 3 | 4 | 5;

/** Enemy archetype behaviors */
export type EnemyArchetype = 'melee_bruiser' | 'fast_skirmisher' | 'ranged_attacker' | 'support_buffer' | 'ambusher' | 'hazard_creator' | 'elite' | 'boss';

/** Weapon category for mastery tracking */
export type WeaponType = 'blade' | 'bludgeon' | 'axe' | 'ranged';

/** Per-run hit counts by weapon type */
export interface WeaponMastery {
  readonly blade: number;
  readonly bludgeon: number;
  readonly axe: number;
  readonly ranged: number;
}

export const EMPTY_WEAPON_MASTERY: WeaponMastery = { blade: 0, bludgeon: 0, axe: 0, ranged: 0 };

/** Item rarity */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Item class */
export type ItemClass = 'weapon' | 'armor' | 'consumable' | 'relic' | 'quest' | 'tool';

/** Armor slot (used for routing equip) */
export type ArmorSlot = 'chest' | 'head' | 'gloves' | 'boots' | 'ring';

/** Equipment slots */
export type EquipSlot = 'weapon' | 'chest' | 'head' | 'gloves' | 'boots' | 'ring1' | 'ring2';

/** Game phase */
export type GamePhase = 'town' | 'dungeon' | 'combat' | 'game_over';

/** Town action types */
export type TownActionType = 'shop_buy' | 'shop_sell' | 'shop_undo' | 'rest' | 'talk_npc' | 'prepare' | 'enter_dungeon' | 'enchant_armor';

/** Create a branded EntityId from a string */
export function entityId(id: string): EntityId {
  return id as EntityId;
}

/** Run telemetry metrics */
export interface RunMetrics {
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly turnsElapsed: number;
  readonly enemiesKilled: number;
  readonly itemsUsed: number;
  readonly goldEarned: number;
  readonly floorsCleared: number;
  readonly causeOfEnd: 'death' | 'retreat' | 'victory' | null;
  readonly consecutiveMisses: number;  // Count of consecutive misses for streak detection
}

export const EMPTY_RUN_METRICS: RunMetrics = {
  damageDealt: 0,
  damageTaken: 0,
  turnsElapsed: 0,
  enemiesKilled: 0,
  itemsUsed: 0,
  goldEarned: 0,
  floorsCleared: 0,
  causeOfEnd: null,
  consecutiveMisses: 0,
};

/** Direction vectors for movement */
export const DIRECTION_VECTORS: Record<Direction, Position> = {
  N:  { x: 0,  y: -1 },
  S:  { x: 0,  y: 1 },
  E:  { x: 1,  y: 0 },
  W:  { x: -1, y: 0 },
  NE: { x: 1,  y: -1 },
  NW: { x: -1, y: -1 },
  SE: { x: 1,  y: 1 },
  SW: { x: -1, y: 1 },
} as const;
