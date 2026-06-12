import type { EntityId, Position, Direction, DamageType, StatusId, GamePhase, WeaponType } from '../types/common.js';
import type { AmbientState } from '../types/ambient-behavior.js';
import type { FactionPowerBand, FactionPowerChangeReason, FactionStatus } from '../types/town.js';

export type CombatCauseType =
  | 'attack'
  | 'ability'
  | 'status'
  | 'trap'
  | 'thorns'
  | 'consumable'
  | 'environment'
  | 'unknown';

interface BaseEvent {
  readonly timestamp: number;
  readonly turnNumber: number;
}

export interface PlayerMovedEvent extends BaseEvent {
  readonly type: 'PLAYER_MOVED';
  readonly from: Position;
  readonly to: Position;
}

export interface EnemyMovedEvent extends BaseEvent {
  readonly type: 'ENEMY_MOVED';
  readonly enemyId: EntityId;
  readonly from: Position;
  readonly to: Position;
}

export interface AttackPerformedEvent extends BaseEvent {
  readonly type: 'ATTACK_PERFORMED';
  readonly attackerId: EntityId;
  readonly defenderId: EntityId;
  readonly attackerName: string;
  readonly defenderName: string;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly hit: boolean;
  readonly critical: boolean;
  readonly position: Position;
  readonly reason?: string;
  readonly missReason?: 'accuracy' | 'evasion';
  readonly attackerPosition?: Position;
  readonly defenderPosition?: Position;
  readonly preHealth?: number;
  readonly postHealth?: number;
  readonly maxHealth?: number;
  readonly killed?: boolean;
  readonly causeId?: string;
  readonly causeType?: CombatCauseType;
}

export interface EntityDiedEvent extends BaseEvent {
  readonly type: 'ENTITY_DIED';
  readonly entityId: EntityId;
  readonly killerId: EntityId | null;
  readonly entityName: string;
  readonly entityPosition?: Position;
  readonly entityMapKey?: string;
  readonly killerName?: string | null;
  readonly causeId?: string;
  readonly causeType?: CombatCauseType;
  readonly sourceEventType?: string;
}

export interface StatusAppliedEvent extends BaseEvent {
  readonly type: 'STATUS_APPLIED';
  readonly targetId: EntityId;
  readonly statusId: StatusId;
  readonly duration: number;
  readonly sourceId: EntityId | null;
}

export interface StatusExpiredEvent extends BaseEvent {
  readonly type: 'STATUS_EXPIRED';
  readonly targetId: EntityId;
  readonly statusId: StatusId;
}

export interface StatusDamageTickEvent extends BaseEvent {
  readonly type: 'STATUS_DAMAGE_TICK';
  readonly targetId: EntityId;
  readonly targetName: string;
  readonly statusId: StatusId;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly position: Position;
  readonly targetPosition?: Position;
  readonly preHealth?: number;
  readonly postHealth?: number;
  readonly maxHealth?: number;
  readonly killed?: boolean;
  readonly causeId?: string;
  readonly causeType?: CombatCauseType;
}

export interface LootAcquiredEvent extends BaseEvent {
  readonly type: 'LOOT_ACQUIRED';
  readonly itemId: EntityId;
  readonly itemName: string;
  readonly playerId: EntityId;
}

export interface GoldChangedEvent extends BaseEvent {
  readonly type: 'GOLD_CHANGED';
  readonly playerId: EntityId;
  readonly amount: number;
  readonly newTotal: number;
  readonly reason: string;
}

export interface ManaChangedEvent extends BaseEvent {
  readonly type: 'MANA_CHANGED';
  readonly playerId: EntityId;
  readonly amount: number;
  readonly newTotal: number;
  readonly reason: string;
}

export interface SpellUnlockedEvent extends BaseEvent {
  readonly type: 'SPELL_UNLOCKED';
  readonly playerId: EntityId;
  readonly spellId: string;
  readonly spellName: string;
}

export interface FloorEnteredEvent extends BaseEvent {
  readonly type: 'FLOOR_ENTERED';
  readonly depth: number;
  readonly biomeId: string;
}

export interface PlayerDiedEvent extends BaseEvent {
  readonly type: 'PLAYER_DIED';
  readonly killerId: EntityId | null;
  readonly killerName: string | null;
  readonly killerSpriteName: string | null;
  readonly floor: number;
  readonly cause: string;
  readonly goldLost: number;
  readonly overkillDamage: number;
}

export interface RunStartedEvent extends BaseEvent {
  readonly type: 'RUN_STARTED';
  readonly runId: EntityId;
}

export interface RunEndedEvent extends BaseEvent {
  readonly type: 'RUN_ENDED';
  readonly runId: EntityId;
  readonly reason: 'death' | 'retreat' | 'victory' | 'permadeath';
  readonly floorsCleared: number;
}

export interface PhaseChangedEvent extends BaseEvent {
  readonly type: 'PHASE_CHANGED';
  readonly from: GamePhase;
  readonly to: GamePhase;
}

export interface TownStateChangedEvent extends BaseEvent {
  readonly type: 'TOWN_STATE_CHANGED';
  readonly field: string;
  readonly oldValue: number;
  readonly newValue: number;
}

export interface FactionPowerChangedEvent extends BaseEvent {
  readonly type: 'FACTION_POWER_CHANGED';
  readonly factionId: string;
  readonly factionName: string;
  readonly reason: FactionPowerChangeReason;
  readonly oldPower: number;
  readonly newPower: number;
  readonly delta: number;
  readonly oldBand: FactionPowerBand;
  readonly newBand: FactionPowerBand;
  readonly status: FactionStatus;
}

export interface FactionLeaderEmergedEvent extends BaseEvent {
  readonly type: 'FACTION_LEADER_EMERGED';
  readonly factionId: string;
  readonly factionName: string;
  readonly leaderId: EntityId;
  readonly leaderName: string;
  readonly leaderTitle: string;
  readonly leaderTemplateId: string;
  readonly emergedOnRun: number;
  readonly emergedOnDepth: number;
}

export interface FactionLeaderSlainEvent extends BaseEvent {
  readonly type: 'FACTION_LEADER_SLAIN';
  readonly factionId: string;
  readonly factionName: string;
  readonly leaderId: EntityId;
  readonly leaderName: string;
  readonly leaderTitle: string;
  readonly slainAtDepth: number;
}

export interface FactionBrokenEvent extends BaseEvent {
  readonly type: 'FACTION_BROKEN';
  readonly factionId: string;
  readonly factionName: string;
  readonly leaderId?: EntityId;
  readonly brokenAtDepth: number;
}

export interface DungeonOgreEmergedEvent extends BaseEvent {
  readonly type: 'DUNGEON_OGRE_EMERGED';
  readonly ogreId: 'dungeon_ogre';
  readonly emergedAfterRun: number;
  readonly emergedAtDepth: number;
  readonly eligibleSpawnDepths: readonly number[];
  readonly selectedSpawnDepth: number;
}

export interface DungeonOgreSlainEvent extends BaseEvent {
  readonly type: 'DUNGEON_OGRE_SLAIN';
  readonly ogreId: 'dungeon_ogre';
  readonly slainAtDepth: number;
}

export interface GameWonEvent extends BaseEvent {
  readonly type: 'GAME_WON';
  readonly victorySource: 'dungeon_ogre';
  readonly floor: number;
}

export interface ItemUsedEvent extends BaseEvent {
  readonly type: 'ITEM_USED';
  readonly itemId: EntityId;
  readonly itemName: string;
  readonly userId: EntityId;
  readonly effect: string;
}

export interface EquipBlockedEvent extends BaseEvent {
  readonly type: 'EQUIP_BLOCKED';
  readonly reason: string;
}

export interface EnemyAlertedEvent extends BaseEvent {
  readonly type: 'ENEMY_ALERTED';
  readonly enemyId: EntityId;
  readonly enemyName: string;
}

export interface EnemyAmbientStateChangedEvent extends BaseEvent {
  readonly type: 'ENEMY_AMBIENT_STATE_CHANGED';
  readonly enemyId: EntityId;
  readonly oldState: AmbientState;
  readonly newState: AmbientState;
  readonly reason: string;
}

export interface LevelUpEvent extends BaseEvent {
  readonly type: 'LEVEL_UP';
  readonly playerId: EntityId;
  readonly newLevel: number;
  readonly statGains: {
    readonly maxHealth: number;
    readonly attack: number;
    readonly defense: number;
    readonly accuracy: number;
    readonly evasion: number;
  };
}

export interface LootDroppedEvent extends BaseEvent {
  readonly type: 'LOOT_DROPPED';
  readonly itemId: string;
  readonly itemName: string;
  readonly enemyName: string;
  readonly reason: 'inventory_full';
}

export interface QuestAssignedEvent extends BaseEvent {
  readonly type: 'QUEST_ASSIGNED';
  readonly questId: string;
  readonly questTitle: string;
  readonly questDescription: string;
  readonly rewardGold: number;
  readonly giverNpcId: EntityId;
}

export interface QuestProgressEvent extends BaseEvent {
  readonly type: 'QUEST_PROGRESS';
  readonly questId: string;
  readonly questTitle: string;
  readonly progress: number;
  readonly message: string;
}

export interface QuestReadyEvent extends BaseEvent {
  readonly type: 'QUEST_READY';
  readonly questId: string;
  readonly questTitle: string;
  readonly giverNpcId: EntityId;
  readonly message: string;
}

export interface QuestTurnedInEvent extends BaseEvent {
  readonly type: 'QUEST_TURNED_IN';
  readonly questId: string;
  readonly questTitle: string;
  readonly rewardGold: number;
  readonly giverNpcId: EntityId;
}

export interface QuestCompletedEvent extends BaseEvent {
  readonly type: 'QUEST_COMPLETED';
  readonly questId: string;
  readonly questTitle: string;
  readonly rewardGold: number;
}

export interface AbilityTargetSnapshot {
  readonly targetId: EntityId;
  readonly position: { readonly x: number; readonly y: number };
}

export interface AbilityUsedEvent extends BaseEvent {
  readonly type: 'ABILITY_USED';
  readonly playerId: EntityId;
  readonly abilityId: string;
  readonly abilityName: string;
  readonly targetId?: EntityId;
  readonly targetName?: string;
  readonly hit: boolean;
  readonly damage?: number;
  readonly healAmount?: number;
  readonly damageByTarget?: ReadonlyMap<EntityId, number>;
  readonly affectedTargetIds?: readonly EntityId[];
  readonly targetSnapshots?: readonly AbilityTargetSnapshot[];
}

export interface MasteryUnlockedEvent extends BaseEvent {
  readonly type: 'MASTERY_UNLOCKED';
  readonly playerId: EntityId;
  readonly weaponType: WeaponType;
  readonly tier: 1 | 2;
  readonly abilityId: string;
  readonly abilityName: string;
}

export interface EnchantmentAppliedEvent extends BaseEvent {
  readonly type: 'ENCHANTMENT_APPLIED';
  readonly playerId: EntityId;
  readonly itemId: EntityId;
  readonly itemName: string;
  readonly enchantmentId: string;
  readonly enchantmentName: string;
  readonly slot: string;
}

export interface BlueprintUnlockedEvent extends BaseEvent {
  readonly type: 'BLUEPRINT_UNLOCKED';
  readonly playerId: EntityId;
  readonly blueprintIds: readonly string[];
}

export interface ShopTierUnlockedEvent extends BaseEvent {
  readonly type: 'SHOP_TIER_UNLOCKED';
  readonly unlockedTier: 'uncommon' | 'epic';
  readonly triggerRarity: 'epic' | 'legendary';
}

export interface EquipmentDroppedEvent extends BaseEvent {
  readonly type: 'EQUIPMENT_DROPPED';
  readonly items: readonly { slot: string; itemName: string }[];
  readonly floor: number;
}

export interface EquipmentRecoveredEvent extends BaseEvent {
  readonly type: 'EQUIPMENT_RECOVERED';
  readonly items: readonly { slot: string; itemName: string }[];
  readonly floor: number;
}

export interface PermadeathEvent extends BaseEvent {
  readonly type: 'PERMADEATH';
  readonly killerId: EntityId | null;
  readonly floor: number;
  readonly overkillDamage: number;
}

export interface EnemySpawnedEvent extends BaseEvent {
  readonly type: 'ENEMY_SPAWNED';
  readonly enemyId: EntityId;
  readonly enemyName: string;
  readonly position: { x: number; y: number };
  readonly reason: 'initial_population' | 'respawn';
}

export interface TreasureOpenedEvent extends BaseEvent {
  readonly type: 'TREASURE_OPENED';
  readonly position: Position;
  readonly itemCount: number;
}

export interface ObjectInteractedEvent extends BaseEvent {
  readonly type: 'OBJECT_INTERACTED';
  readonly objectId: EntityId;
  readonly objectName: string;
  readonly position: Position;
  readonly healthDelta: number;
  readonly gotLoot: boolean;
}

export interface TrapTriggeredEvent extends BaseEvent {
  readonly type: 'TRAP_TRIGGERED';
  readonly trapId: EntityId;
  readonly trapName: string;
  readonly position: Position;
  readonly damage: number;
  readonly rarity?: string;
  readonly hazardType?: string;
  readonly statusEffect?: StatusId;
  readonly targetId?: EntityId;
  readonly targetName?: string;
  readonly targetPosition?: Position;
  readonly preHealth?: number;
  readonly postHealth?: number;
  readonly maxHealth?: number;
  readonly killed?: boolean;
}

export interface ThornsReflectedEvent extends BaseEvent {
  readonly type: 'THORNS_REFLECTED';
  readonly targetId: EntityId;
  readonly targetName: string;
  readonly damageAmount: number;
  readonly byPlayerId: EntityId;
  readonly position: Position;
  readonly targetPosition?: Position;
  readonly preHealth?: number;
  readonly postHealth?: number;
  readonly maxHealth?: number;
  readonly killed?: boolean;
}

export interface BlinkDodgedEvent extends BaseEvent {
  readonly type: 'BLINK_DODGED';
  readonly defenderId: EntityId;
  readonly attackerId: EntityId;
  readonly attackerName: string;
}

export interface LifeStealEvent extends BaseEvent {
  readonly type: 'LIFE_STEAL';
  readonly playerId: EntityId;
  readonly enemyId: EntityId;
  readonly enemyName: string;
  readonly hpRestored: number;
}

export interface DebugMissStreakEvent extends BaseEvent {
  readonly type: 'DEBUG_MISS_STREAK';
  readonly playerAccuracy: number;
  readonly playerEvasion: number;
  readonly enemyAccuracy: number;
  readonly enemyEvasion: number;
  readonly rngSeed: number;
  readonly streakLength: number;
}

export interface DebugDamageCalcEvent extends BaseEvent {
  readonly type: 'DEBUG_DAMAGE_CALC';
  readonly targetName: string;
  readonly source: string;
  readonly rawDamage: number;
  readonly postDefense: number;
  readonly postResistance: number;
  readonly finalDamage: number;
  readonly defense: number;
  readonly resistance: number;
  readonly bypassDefense: boolean;
  readonly bypassResistance: boolean;
  readonly isCrit: boolean;
  readonly critMultiplier: number;
}

export interface PlayerActionRejectedEvent extends BaseEvent {
  readonly type: 'PLAYER_ACTION_REJECTED';
  readonly actionType: string;
  readonly actionId: string;
  readonly reasonCode: string;
  readonly message: string;
  readonly playerId: EntityId;
  readonly targetId?: EntityId;
  readonly targetPosition?: Position;
  readonly itemId?: string;
  readonly abilityId?: string;
  readonly source?: string;
}

/** Reason codes for blocked player movement (Phase 4A). */
export type MovementBlockedReasonCode =
  | 'INVALID_DIRECTION'
  | 'NOT_IN_DUNGEON'
  | 'OUT_OF_BOUNDS'
  | 'NOT_WALKABLE'
  | 'OCCUPIED_BY_OBJECT'
  | 'TARGET_NOT_FOUND';

export interface MovementBlockedEvent extends BaseEvent {
  readonly type: 'MOVEMENT_BLOCKED';
  readonly playerId: EntityId;
  readonly from: Position;
  readonly attemptedTo: Position;
  readonly direction: Direction;
  readonly reasonCode: MovementBlockedReasonCode;
  readonly message: string;
}

export interface TrapDisarmedEvent extends BaseEvent {
  readonly type: 'TRAP_DISARMED';
  readonly trapObjectId: EntityId;
  readonly trapName: string;
  readonly position: Position;
  readonly recoveredItemId: EntityId;
  readonly recoveredItemName: string;
  readonly playerId: EntityId;
}

export interface TrapPlacedEvent extends BaseEvent {
  readonly type: 'TRAP_PLACED';
  readonly trapObjectId: EntityId;
  readonly trapName: string;
  readonly trapTemplateId: string;
  readonly itemEntityId: EntityId;
  readonly position: Position;
  readonly playerId: EntityId;
}

export type DomainEvent =
  | PlayerMovedEvent
  | EnemyMovedEvent
  | AttackPerformedEvent
  | EntityDiedEvent
  | StatusAppliedEvent
  | StatusExpiredEvent
  | StatusDamageTickEvent
  | LootAcquiredEvent
  | GoldChangedEvent
  | ManaChangedEvent
  | SpellUnlockedEvent
  | FloorEnteredEvent
  | PlayerDiedEvent
  | RunStartedEvent
  | RunEndedEvent
  | PhaseChangedEvent
  | TownStateChangedEvent
  | FactionPowerChangedEvent
  | FactionLeaderEmergedEvent
  | FactionLeaderSlainEvent
  | FactionBrokenEvent
  | DungeonOgreEmergedEvent
  | DungeonOgreSlainEvent
  | GameWonEvent
  | ItemUsedEvent
  | EquipBlockedEvent
  | EnemyAlertedEvent
  | EnemyAmbientStateChangedEvent
  | LevelUpEvent
  | LootDroppedEvent
  | QuestAssignedEvent
  | QuestProgressEvent
  | QuestReadyEvent
  | QuestTurnedInEvent
  | QuestCompletedEvent
  | AbilityUsedEvent
  | MasteryUnlockedEvent
  | EnchantmentAppliedEvent
  | BlueprintUnlockedEvent
  | ShopTierUnlockedEvent
  | EquipmentDroppedEvent
  | EquipmentRecoveredEvent
  | PermadeathEvent
  | EnemySpawnedEvent
  | TreasureOpenedEvent
  | ObjectInteractedEvent
  | TrapTriggeredEvent
  | ThornsReflectedEvent
  | BlinkDodgedEvent
  | LifeStealEvent
  | DebugMissStreakEvent
  | DebugDamageCalcEvent
  | PlayerActionRejectedEvent
  | MovementBlockedEvent
  | TrapDisarmedEvent
  | TrapPlacedEvent;

export type EventType = DomainEvent['type'];
