import type { EntityId, Position, ThreatTier, DamageType } from './common.js';
import type { StatusEffect } from './player.js';
import type { AmbientState } from './ambient-behavior.js';

export interface EnemyStats {
  readonly maxHealth: number;
  readonly health: number;
  readonly attack: number;
  readonly defense: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly speed: number;
}

export interface EnemyWeapon {
  readonly damageMultiplier: number;
  readonly damageType: DamageType;
  readonly range: number;
  readonly onHitStatus?: string;
  readonly onHitChance?: number;
}

export interface EnemyEquipment {
  readonly weapon: EnemyWeapon;
}

export interface TargetScoringRule {
  readonly factor: 'proximity' | 'maxHealth' | 'currentHealth' | 'playerAlert' | 'playerInCone';
  readonly weight: number;
  readonly direction: 'maximize' | 'minimize';
}

export interface PositioningRule {
  readonly factor: 'rangeToPlayer' | 'wallProximity' | 'groupCohesion';
  readonly targetDistance: number;
  readonly weight: number;
}

export interface ActionScoringRule {
  readonly condition?: string;
  readonly actions: readonly ('move' | 'attack' | 'ability' | 'wait')[];
  readonly weight: number;
}

export interface PanicThreshold {
  readonly hpPercent: number;
  readonly behavior: 'enrage' | 'retreat' | 'hold';
}

export interface AbilityPreference {
  readonly abilityId: string;
  readonly weight: number;
  readonly usageHp?: 'anytime' | 'critical' | 'healthy';
}

export interface ArchetypeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly targetSelection: readonly TargetScoringRule[];
  readonly positioning: readonly PositioningRule[];
  readonly actionSelection: readonly ActionScoringRule[];
  readonly panicThresholds?: readonly PanicThreshold[];
  readonly abilityPreferences?: readonly AbilityPreference[];
}

export interface EnemySpawn {
  readonly floorRange: readonly [number, number];
  readonly weight: number;
}

export interface BiomeMembership {
  readonly biomeId: string;
}

export interface FactionMembership {
  readonly factionId: string;
  readonly weight: number;
}

export interface EnemyTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly archetype: string;
  readonly tier: ThreatTier;
  readonly stats: EnemyStats;
  readonly equipment: EnemyEquipment;
  readonly affinities: Partial<Record<DamageType, number>>;
  readonly spawn: EnemySpawn;
  readonly lootTableId: string;
  readonly experienceValue: number;
  readonly description: string;
  readonly ascii: string;
  readonly color?: string;
  readonly movementBehaviorId?: string;
  readonly abilities?: readonly string[];
  readonly spriteName?: string;
  readonly biomes?: ReadonlyArray<BiomeMembership>;
  readonly factions?: ReadonlyArray<FactionMembership>;
  readonly ambientBehaviorProfile?: string; // profile ID or undefined = no ambient behavior
}

export interface EnemyInstance extends EnemyTemplate {
  readonly id: EntityId;
  readonly position: Position;
  readonly statuses: readonly StatusEffect[];
  readonly isAlerted: boolean;
  readonly lastKnownPlayerPos: Position | null;
  readonly nemesisId?: EntityId;
  readonly abilityCooldowns?: Record<string, number>;
  readonly ambientState?: AmbientState; // current state in state machine
  readonly ambientStateAge?: number; // turns in current state, for triggering transitions
  readonly anchorPosition?: Position; // spawn position, for guarding/patrolling
  readonly instanceColor?: string; // hex color for visual disambiguation when 2+ of same type visible
}
