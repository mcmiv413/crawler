/** View models consumed by the frontend — safe to send over the wire */

export interface RunSummaryStats {
  readonly floorsCleared: number;
  readonly enemiesKilled: number;
  readonly goldEarned: number;
  readonly prosperityDelta: number;
  readonly fearDelta: number;
  readonly corruptionDelta: number;
  readonly nemesisPromoted: boolean;
  readonly equipmentLost: readonly string[];
}

export interface DeathSummary {
  readonly killerName: string | null;
  readonly floor: number;
  readonly turnsSurvived: number;
  readonly damageDealt: number;
  readonly damageTaken: number;
}

export interface QuestView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'active' | 'complete' | 'failed';
  readonly rewardGold: number;
  readonly giverNpcId: string;
}

export interface NemesisInfo {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly rarity: string;
  readonly defeats: number;
  readonly promotionStage: number;
  readonly lastSeenFloor: number | null;
  readonly nextPossibleFloor: number;
}

export interface FactionStanding {
  readonly factionId: string;
  readonly name: string;
  readonly alignment: string;
  readonly standing: number;
  readonly maxStanding: number;
}

export interface GameView {
  readonly gameId: string;
  readonly phase: 'town' | 'dungeon' | 'combat' | 'game_over';
  readonly player: PlayerHudView;
  readonly map: MapView | null;
  readonly combatLog: readonly CombatLogEntry[];
  readonly availableActions: readonly AvailableAction[];
  readonly town: TownView | null;
  readonly inventory: InventoryView;
  readonly activeQuests: readonly QuestView[];
  readonly runResult: 'victory' | 'death' | 'permadeath' | null;
  readonly deathStashFloor: number | null;
  readonly deathSummary: DeathSummary | null;
  readonly inspectableEntities: readonly InspectableEntityView[];
  readonly debugMode: boolean;
}

export interface AbilityView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ready: boolean;
  readonly cooldownRemaining: number;
}

export interface WeaponMasteryView {
  readonly blade: number;
  readonly bludgeon: number;
  readonly axe: number;
  readonly ranged: number;
}

export interface MasteryTierInfo {
  readonly weaponType: string;
  readonly uses: number;
  readonly tier: number;
}

export interface StatBonusSource {
  readonly source: string;
  readonly amount: number;
}

export interface StatBreakdown {
  readonly stat: string;
  readonly base: number;
  readonly bonuses: readonly StatBonusSource[];
  readonly total: number;
}

export interface EnchantmentView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: 1 | 2 | 3 | 'unique';
}

export interface EquippedItemView {
  readonly slot: string;
  readonly itemId: string;
  readonly name: string;
  readonly rarity: string;
  readonly baseBonus: number;
  readonly enchantments: readonly EnchantmentView[];
}

export interface PlayerHudView {
  readonly name: string;
  readonly level: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly attack: number;
  readonly defense: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly speed: number;
  readonly resistances: Record<string, number>;
  readonly gold: number;
  readonly floor: number;
  readonly experience: number;
  readonly experienceForNextLevel: number;
  readonly biomeId: string | null;
  readonly statuses: readonly StatusView[];
  readonly abilities: readonly AbilityView[];
  readonly weaponMastery: WeaponMasteryView | null;
  readonly equippedItems: readonly EquippedItemView[];
  readonly statBreakdowns: Record<string, StatBreakdown>;
  readonly activeQuests: readonly QuestView[];
  readonly nemesisInfo: NemesisInfo | null;
  readonly factionStandings: readonly FactionStanding[];
}

export interface StatusView {
  readonly id: string;
  readonly name: string;
  readonly turnsRemaining: number;
  readonly beneficial: boolean;
}

export interface MapView {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly MapCellView[];
  readonly entities: readonly EntityView[];
  readonly playerPosition: { readonly x: number; readonly y: number };
  readonly biomeId: string;
  readonly dangerLevel: 'safe' | 'moderate' | 'dangerous' | 'deadly';
}

export interface MapCellView {
  readonly x: number;
  readonly y: number;
  readonly ascii: string;
  readonly color: string;
  readonly bgColor: string;
  readonly visibility: 'hidden' | 'remembered' | 'visible';
  readonly walkable: boolean;
  readonly tileType: import('@dungeon/contracts').TileType;
}

export interface EntityView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly ascii: string;
  readonly color: string;
  readonly name: string;
  readonly type: 'player' | 'enemy' | 'item' | 'object';
  readonly health?: number;
  readonly maxHealth?: number;
  readonly templateId: string | null;  // templateId for enemies, itemId for items, null for player
  readonly isNemesis?: boolean;
  readonly nemesisName?: string;
}

export interface InspectableEntityView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ascii: string;
  readonly color: string;
  readonly entityType: 'enemy' | 'item' | 'object';
  readonly templateId?: string; // For looking up sprites
  // Enemy-only fields (undefined for items)
  readonly health?: number;
  readonly maxHealth?: number;
  readonly attack?: number;
  readonly defense?: number;
  readonly speed?: number;
  readonly tier?: number;
  readonly archetype?: string;
  readonly isFasterThanPlayer?: boolean;
  readonly affinities?: Readonly<Record<string, number>>;
  readonly statuses?: readonly string[];
}

export interface CombatLogEntry {
  readonly text: string;
  readonly type: 'attack' | 'damage' | 'death' | 'status' | 'loot' | 'info' | 'move';
  readonly timestamp: number;
}

export interface AvailableAction {
  readonly id: string;
  readonly label: string;
  readonly type: 'move' | 'attack' | 'item' | 'interact' | 'retreat' | 'wait' | 'town' | 'ascend' | 'ability';
  readonly enabled: boolean;
  readonly targetId?: string;
  readonly targetPosition?: { readonly x: number; readonly y: number };
  readonly description?: string;  // For tooltips
}

export interface FactionView {
  readonly id: string;
  readonly name: string;
  readonly power: number;
  readonly disposition: number;
  readonly trend: 'rising' | 'falling' | 'stable';
}

export interface NemesisView {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly tier: number;
  readonly rank: number;
  readonly floorOfAscension: number;
  readonly killCount: number;
  readonly killedByWeaponType: string | null;
  readonly isActive: boolean;
  readonly weaknesses: readonly string[];
}

export interface EnchantmentSlotView {
  readonly index: number;
  readonly enchantmentId: string | null;
  readonly enchantmentName: string | null;
}

export interface TownView {
  readonly prosperity: number;
  readonly fear: number;
  readonly corruption: number;
  readonly npcs: readonly NpcView[];
  readonly shop: ShopView;
  readonly rumors: readonly string[];
  readonly lastRunSummary: string | null;
  readonly nemeses: readonly NemesisView[];
  readonly slainNemeses: readonly NemesisView[];  // Recently defeated nemeses (for screen display)
  readonly factions: readonly FactionView[];
  readonly atmosphereDescription: string;
  readonly unlockedBlueprints: readonly string[];
  readonly runSummaryStats: RunSummaryStats | null;
  readonly prepAdvice: readonly string[];
  readonly lastRetreatFloor?: number;  // Floor player last retreated from (for continue button)
}

export interface NpcView {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly available: boolean;
}

export interface ShopView {
  readonly items: readonly ShopItemView[];
  readonly canUndo: boolean;
}

export interface ShopItemView {
  readonly itemId: string;
  readonly name: string;
  readonly description: string;
  readonly rarity: string;
  readonly price: number;
  readonly effectivePrice: number;  // after shopkeeper disposition discount
  readonly stock: number;
  readonly itemClass: string;  // weapon | armor | consumable
}

export interface InventoryView {
  readonly items: readonly InventoryItemView[];
  readonly equipped: {
    readonly weapon: InventoryItemView | null;
    readonly chest: InventoryItemView | null;
    readonly head: InventoryItemView | null;
    readonly gloves: InventoryItemView | null;
    readonly boots: InventoryItemView | null;
    readonly ring1: InventoryItemView | null;
    readonly ring2: InventoryItemView | null;
    readonly secondaryWeapon: InventoryItemView | null;
  };
}

export interface InventoryItemView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly itemClass: string;
  readonly rarity: string;
  readonly value: number;
  readonly sellPrice: number;  // floor(value * buybackMultiplier)
  readonly isEquipped: boolean;
  readonly quantity: number;          // 1 for non-stackable, N for stacks
  readonly stackEntityIds: readonly string[];  // all EntityIds in this stack
  readonly templateId: string;        // itemId from template, for grouping
  readonly weaponStats?: { damage: number; damageType: string; accuracy: number; speed: number; weaponRange: number; minRange?: number };
  readonly armorStats?: { defense: number; evasionPenalty: number; slot: string; enchantmentSlots: number; enchantments: readonly (string | null)[] };
}
