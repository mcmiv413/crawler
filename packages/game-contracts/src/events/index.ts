import type { EntityId, Position, DamageType, StatusId, GamePhase, WeaponType } from '../types/common.js';
import type { AmbientState } from '../types/ambient-behavior.js';

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
  readonly position: Position; // Defender's position at time of attack (needed for damage indicators when entity dies)
  readonly reason?: string;
  readonly missReason?: 'accuracy' | 'evasion';  // reason for miss if hit=false
}

export interface EntityDiedEvent extends BaseEvent {
  readonly type: 'ENTITY_DIED';
  readonly entityId: EntityId;
  readonly killerId: EntityId | null;
  readonly entityName: string;
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

export interface NemesisEncounteredEvent extends BaseEvent {
  readonly type: 'NEMESIS_ENCOUNTERED';
  readonly nemesisId: EntityId;
  readonly nemesisName: string;
  readonly floor: number;
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

export interface NemesisPromotedEvent extends BaseEvent {
  readonly type: 'NEMESIS_PROMOTED';
  readonly nemesisId: EntityId;
  readonly nemesisName: string;
  readonly sourceTemplateId: string;
  readonly floor: number;
}

export interface NemesisSlainEvent extends BaseEvent {
  readonly type: 'NEMESIS_SLAIN';
  readonly nemesisId: EntityId;
  readonly nemesisName: string;
  readonly blueprintUnlocked: string | null;
  readonly lootItemName: string | null;
  readonly floor: number;
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

export interface QuestCompletedEvent extends BaseEvent {
  readonly type: 'QUEST_COMPLETED';
  readonly questId: string;
  readonly questTitle: string;
  readonly rewardGold: number;
}

export interface AbilityUsedEvent extends BaseEvent {
  readonly type: 'ABILITY_USED';
  readonly playerId: EntityId;
  readonly abilityId: string;
  readonly abilityName: string;
  readonly targetId?: EntityId;
  readonly targetName?: string;
  readonly damage?: number;
  readonly healAmount?: number;
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
}

export interface ThornsReflectedEvent extends BaseEvent {
  readonly type: 'THORNS_REFLECTED';
  readonly targetId: EntityId;
  readonly targetName: string;
  readonly damageAmount: number;
  readonly byPlayerId: EntityId;
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

export type DomainEvent =
  | PlayerMovedEvent
  | EnemyMovedEvent
  | AttackPerformedEvent
  | EntityDiedEvent
  | StatusAppliedEvent
  | StatusExpiredEvent
  | LootAcquiredEvent
  | GoldChangedEvent
  | FloorEnteredEvent
  | PlayerDiedEvent
  | RunStartedEvent
  | RunEndedEvent
  | PhaseChangedEvent
  | TownStateChangedEvent
  | ItemUsedEvent
  | EquipBlockedEvent
  | EnemyAlertedEvent
  | EnemyAmbientStateChangedEvent
  | LevelUpEvent
  | NemesisEncounteredEvent
  | NemesisPromotedEvent
  | NemesisSlainEvent
  | LootDroppedEvent
  | QuestAssignedEvent
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
  | DebugDamageCalcEvent;

export type EventType = DomainEvent['type'];
