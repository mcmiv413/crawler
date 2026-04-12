import type { EntityId } from './common.js';

export type QuestStatus = 'active' | 'complete' | 'failed';

export interface Quest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: QuestStatus;
  readonly targetItemId?: string;
  readonly targetEnemyTemplateId?: string;
  readonly targetFloorDepth?: number;
  readonly giverNpcId: string;
  readonly rewardGold: number;
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

export interface FactionState {
  readonly id: string;
  readonly name: string;
  readonly power: number;     // 0-100
  readonly disposition: number; // -100 to 100 toward player
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
