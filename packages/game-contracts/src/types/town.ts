import type { EntityId } from './common.js';

export type QuestStatus = 'active' | 'ready_to_turn_in' | 'rewarded' | 'failed';
export type FactionStatus = 'leaderless' | 'led' | 'broken';
export type FactionPowerBand = 'broken' | 'weak' | 'stable' | 'strong' | 'dominant';
export type FactionPowerChangeReason =
  | 'member_killed'
  | 'player_death'
  | 'player_death_with_leader'
  | 'leader_killed'
  | 'new_deepest_floor';

export interface QuestObjective {
  readonly type: 'collect_item' | 'defeat_enemy' | 'reach_floor';
  readonly targetId?: string;
  readonly targetCount?: number;
  readonly progress: number;
}

export interface QuestReward {
  readonly type: 'gold';
  readonly amount: number;
}

export interface Quest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly objectiveText?: string;
  readonly status: QuestStatus;
  readonly objective: QuestObjective;
  readonly reward: QuestReward;
  readonly giverNpcId: string;
  // Legacy fields for backward compatibility during deserialization
  readonly targetItemId?: string;
  readonly targetEnemyTemplateId?: string;
  readonly targetFloorDepth?: number;
  readonly rewardGold?: number;
}

export interface TownState {
  readonly prosperity: number;   // 0-100
  readonly fear: number;         // 0-100
  readonly corruption: number;   // 0-100
  readonly rumors: readonly string[];
  readonly lastRunSummary: string | null;
}

export interface NpcState {
  readonly id: EntityId;
  readonly name: string;
  readonly role: 'shopkeeper' | 'healer' | 'informant' | 'blacksmith' | 'elder' | 'enchanter';
  readonly disposition: number; // -100 to 100
  readonly available: boolean;
  readonly dialogueKey: string;
}

export interface FactionLeaderState {
  readonly id: EntityId;
  readonly factionId: string;
  readonly name: string;
  readonly title: string;
  readonly templateId: string;
  readonly isActive: boolean;
  readonly isSlain: boolean;
  readonly emergedOnRun: number;
  readonly emergedOnDepth: number;
}

export interface DungeonOgreState {
  readonly id: 'dungeon_ogre';
  readonly status: 'sealed' | 'emerged' | 'slain';
  readonly emergedAfterRun?: number;
  readonly emergedAtDepth?: number;
  readonly eligibleSpawnDepths?: readonly number[];
  readonly selectedSpawnDepth?: number;
}

export interface FactionState {
  readonly id: string;
  readonly name: string;
  readonly power: number; // 0-100
  readonly disposition: number; // -100 to 100 toward player
  readonly status: FactionStatus;
  readonly activeLeaderId?: EntityId;
  readonly leader: FactionLeaderState | null;
  readonly leaderSlain: boolean;
  readonly membersKilledByPlayer: number;
  readonly leadersKilledByPlayer: number;
  readonly playerDeathsCaused: number;
  readonly lastPowerDelta?: number;
  readonly lastPowerChangeReason?: FactionPowerChangeReason;
}

export interface ShopItem {
  readonly itemId: string;
  readonly price: number;
  readonly stock: number;
}

export interface ShopTransaction {
  readonly type: 'buy' | 'sell';
  readonly itemId: string;
  readonly quantity: number;
  readonly goldDelta: number;  // positive for money gained, negative for money spent
  readonly snapshot: {
    readonly playerGold: number;
    readonly shopItems: readonly ShopItem[];
    readonly playerInventoryIds: readonly EntityId[];
  };
}

export interface ShopInventory {
  readonly items: readonly ShopItem[];
  readonly buybackMultiplier: number;
  readonly lastTransaction?: ShopTransaction;
}
