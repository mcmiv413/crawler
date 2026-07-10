import type { Position, EntityId, ItemRarity, StatusId } from './common.js';
import type { BiomeMembership } from './enemy.js';

export interface ObjectTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly description: string;
  readonly ascii: string;
  readonly color: string;
  readonly spriteName?: string;
  /** Effect on player health when interacted with. Negative = damage, positive = heal, 0 = no effect */
  readonly healthDelta: number;
  /** Percentage-based health change (e.g. 20 = heal 20% of max health, -50 = damage 50% of max health). Overrides healthDelta if set */
  readonly healthDeltaPercent?: number;
  /** If true, object is removed from the map after one interaction */
  readonly consumable: boolean;
  /** If true, the player cannot walk through this object */
  readonly blocksMovement: boolean;
  /** If true, this object is a hazard that triggers automatically (traps, lava, etc.) */
  readonly isHazard?: boolean;
  /** If set, object dispenses loot on interaction (like a chest) */
  readonly lootTableId?: string;
  /** Which biomes this object can spawn in. Undefined = all biomes */
  readonly biomes?: ReadonlyArray<BiomeMembership>;
  /** For traps: rarity determines damage scaling (percentage of max health) */
  readonly rarity?: ItemRarity;
  /** Object category for pool distribution: trap, chest, healing, or misc */
  readonly objectCategory: 'trap' | 'chest' | 'healing' | 'misc';
  /** Gold range for gold object (consumable coins). Actual amount: random(min, max) * depth / 2 */
  readonly goldDeltaMin?: number;
  readonly goldDeltaMax?: number;
  /** For traps: status effect applied when triggered */
  readonly statusEffect?: StatusId;
  /** For traps: type identifier for matching trap items to hazards (spike, fire, poison, etc.) */
  readonly hazardType?: 'spike' | 'fire' | 'poison' | 'frost' | 'lightning';
}

export interface ObjectInstance {
  readonly id: EntityId;
  readonly templateId: string;
  readonly position: Position;
  /** True after a consumable has been interacted with (pending removal) */
  readonly isExhausted: boolean;
  /** Runtime origin for lifecycle rules. Omitted values are treated as environment objects for save compatibility. */
  readonly origin?: 'environment' | 'player';
}
