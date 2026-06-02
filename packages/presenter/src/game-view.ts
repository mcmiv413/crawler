/** View models consumed by the frontend — safe to send over the wire */

export interface RunSummaryStats {
  readonly floorsCleared: number;
  readonly enemiesKilled: number;
  readonly goldEarned: number;
  readonly prosperityDelta: number;
  readonly fearDelta: number;
  readonly corruptionDelta: number;
  readonly equipmentLost: readonly string[];
}

export interface DeathSummary {
  readonly killerName: string | null;
  readonly floor: number;
  readonly turnsSurvived: number;
  readonly damageDealt: number;
  readonly damageTaken: number;
}

export interface DeathContext {
  readonly killerName: string | null;
  readonly killerSpriteName: string | null;
  readonly floor: number;
  readonly equipmentLost: readonly { slot: string; itemName: string }[];
  readonly goldLost: number;
  readonly overkillDamage: number;
  readonly permadeathThreshold: number;
  readonly totalDeaths: number;
}

export interface QuestView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'active' | 'ready_to_turn_in' | 'rewarded' | 'failed';
  readonly objectiveText: string;
  readonly progress: number;
  readonly rewardGold: number;
  readonly giverNpcId: string;
}


export interface FactionLeaderView {
  readonly state: 'leaderless' | 'emerged' | 'slain';
  readonly name: string | null;
  readonly title: string | null;
  readonly templateId: string | null;
  readonly spriteName?: string;
  readonly emergedOnRun?: number;
  readonly emergedOnDepth?: number;
}

export interface FactionView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly lore: string;
  readonly power: number;
  readonly disposition: number;
  readonly status: FactionStatus;
  readonly powerBand: FactionPowerBand;
  readonly leader: FactionLeaderView;
  readonly membersKilledByPlayer: number;
  readonly leadersKilledByPlayer: number;
  readonly playerDeathsCaused: number;
  readonly worldEffectText: string;
  readonly townEffectText: string;
  readonly leaderStateText: string;
  readonly currentDungeonEnemies: readonly string[];
}

export interface OgreProgressView {
  readonly status: 'sealed' | 'emerged' | 'slain';
  readonly selectedSpawnDepth: number | null;
  readonly eligibleSpawnDepths: readonly number[];
  readonly brokenFactions: number;
  readonly totalFactions: number;
  readonly summaryText: string;
}

export interface DismissibleNotice {
  readonly id: string;
  readonly kind: string;
  readonly message: string;
  readonly title?: string;
  readonly detail?: string;
  readonly spriteName?: string;
}

export interface QuestAssignedNotice {
  readonly id: string;
  readonly kind: 'QUEST_ASSIGNED';
  readonly questId: string;
  readonly questTitle: string;
  readonly questDescription: string;
  readonly rewardGold: number;
  readonly giverNpcId: string;
}

export type GameNotice = DismissibleNotice | QuestAssignedNotice;

export interface GameView {
  readonly gameId: string;
  readonly phase: 'town' | 'dungeon' | 'combat' | 'game_over';
  readonly player: PlayerHudView;
  readonly map: MapView | null;
  readonly combatLog: readonly CombatLogEntry[];
  readonly animatedEvents: readonly import('./animation-sequence.js').AnimatedEvent[];
  readonly availableActions: readonly AvailableAction[];
  readonly town: TownView | null;
  readonly inventory: InventoryView;
  readonly activeQuests: readonly QuestView[];
  readonly runResult: 'victory' | 'death' | 'permadeath' | null;
  readonly deathStashFloor: number | null;
  readonly deathSummary: DeathSummary | null;
  readonly deathContext: DeathContext | null;
  readonly inspectableEntities: readonly InspectableEntityView[];
  readonly debugMode: boolean;
  readonly notice?: DismissibleNotice;
  readonly notices?: readonly GameNotice[];
}

export interface AbilityView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ready: boolean;
  readonly cooldown?: number;
  readonly cooldownRemaining: number;
  readonly manaCost?: number;
  readonly unlockLevel?: number;
  readonly requiresTarget: boolean;
  readonly requiresDirection?: boolean;
  readonly isRanged?: boolean;
  readonly tileTarget?: boolean;  // Indicates ability requires visible-tile selection
  readonly targetRange?: {
    readonly max: number;
    readonly min: number;
  };
  readonly weaponRequirement?: {
    readonly label: string;
    readonly met: boolean;
  };
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
  readonly listProgressLabel: string;
  readonly nextTier: {
    readonly tier: number;
    readonly progress: number;
    readonly requiredUses: number;
    readonly totalRequiredUses: number;
  } | null;
}

export interface StatBonusSource {
  readonly source: string;
  readonly amount: number;
  readonly spriteName?: string;  // Atlas sprite name for rendering
}

export interface StatBreakdown {
  readonly stat: string;
  readonly base: number;
  readonly bonuses: readonly StatBonusSource[];
  readonly total: number;
  readonly description?: string;
  readonly effect?: {
    readonly label: string;
    readonly value: string;
    readonly description: string;
  };
}

export interface EnchantmentView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: 1 | 2 | 3 | 'unique';
}

export interface EnchantmentBlueprintView extends EnchantmentView {
  readonly cost: number;
}

export interface EquippedItemView {
  readonly slot: string;
  readonly itemId: string;
  readonly name: string;
  readonly rarity: string;
  readonly rarityColor: string;  // Canonical color from @dungeon/content
  readonly baseBonus: number;
  readonly enchantments: readonly EnchantmentView[];
  readonly spriteName?: string;  // Atlas sprite name for rendering
}

export interface PlayerHudView {
  readonly name: string;
  readonly level: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly mana?: number;
  readonly maxMana?: number;
  readonly magicExperience?: number;
  readonly magicLevel?: number;
  readonly magicExperienceForNextLevel?: number | null;
  readonly spellPower?: number;
  readonly attack: number;
  readonly defense: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly speed: number;
  readonly totalDamageMin: number;  // Min damage with equipped weapon
  readonly totalDamageMax: number;  // Max damage with equipped weapon
  readonly resistances: Record<string, number>;
  readonly gold: number;
  readonly floor: number;
  readonly experience: number;
  readonly experienceForNextLevel: number;
  readonly biomeId: string | null;
  readonly biomeColor: string;  // Ambient color from biome definition
  readonly statuses: readonly StatusView[];
  readonly abilities: readonly AbilityView[];
  readonly weaponMastery: WeaponMasteryView | null;
  readonly weaponMasteryTiers?: readonly MasteryTierInfo[];
  readonly equippedItems: readonly EquippedItemView[];
  readonly statBreakdowns: Record<string, StatBreakdown>;
  readonly activeQuests: readonly QuestView[];
  readonly factionProgress: readonly FactionView[];
  readonly ogreProgress: OgreProgressView;
  readonly ringSchoolMasteries: readonly RingSchoolMasteryView[];
  readonly learnedSpells: readonly LearnedSpellView[];
  readonly studyableSpells: readonly RingSpellView[];
}

export interface StatusView {
  readonly id: string;
  readonly name: string;
  readonly turnsRemaining: number;
  readonly beneficial: boolean;
  readonly presentation?: StatusPresentationView;
}

export interface StatusPresentationView {
  readonly entityScale?: number;
  /** Catalog-driven status animation module ID, when the status definition declares one. */
  readonly animationId?: string;
  readonly ring?: {
    readonly colorRgb: string;
    readonly alphaBase: number;
    readonly alphaAmplitude: number;
    readonly pulsePeriodMs: number;
    readonly lineWidth: number;
    readonly paddingPx: number;
  };
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
  readonly spriteName?: string;  // Atlas sprite name for tile
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
  readonly spriteName?: string;  // Atlas sprite name for rendering
  readonly instanceColor?: string;  // hex color for visual disambiguation when 2+ of same type visible
  // Semantic flags for objects (objects only, undefined for other entity types)
  readonly objectCategory?: 'trap' | 'chest' | 'healing' | 'misc';
  readonly isDisarmableTrap?: boolean;  // True if this is a trap that can be disarmed
  readonly hazardType?: 'spike' | 'fire' | 'poison' | 'frost' | 'lightning';  // Type of trap hazard
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
  readonly threatRating?: 'Low' | 'Moderate' | 'High' | 'Deadly'; // Enemy threat assessment
  readonly instanceColor?: string; // Hex color for disambiguating multiple enemies of same type
  readonly playerHitChance?: number; // Hit % when player attacks this enemy (0-100)
  readonly enemyHitChance?: number; // Hit % when enemy attacks player (0-100)
}

export interface CombatLogEntry {
  readonly text: string;
  readonly type: 'attack' | 'damage' | 'death' | 'status' | 'loot' | 'info' | 'move';
  readonly timestamp: number;
}

export interface CombatIndicatorEntry {
  readonly text: string;
  readonly type: 'damage' | 'heal' | 'status' | 'gold';
  readonly x: number;
  readonly y: number;
}

export interface BumpAnimationEntry {
  readonly attackerId: import('@dungeon/contracts').EntityId;
  readonly defenderId: import('@dungeon/contracts').EntityId;
  readonly attackerPos: { readonly x: number; readonly y: number };
  readonly defenderPos: { readonly x: number; readonly y: number };
  readonly durationMs: number;
  readonly impactFrameMs: number;
}

export interface ConsumableAnimationEntry {
  /** Which consumable effect triggered this animation. */
  readonly effect: 'heal' | 'buff' | 'cure' | 'damage';
  /** Player's grid position at the moment of use. */
  readonly playerPos: { readonly x: number; readonly y: number };
  /**
   * Tiles to show fire-burst sprites on for the damage (bomb) effect.
   * Order matches the directions array: c, n, ne, e, se, s, sw, w, nw.
   * Empty for non-damage effects.
   */
  readonly blastPositions: readonly { readonly x: number; readonly y: number }[];
  /** Total wall-clock duration of this animation in milliseconds. */
  readonly durationMs: number;
  /** Rendering metadata resolved by the presenter for the web canvas. */
  readonly presentation: ConsumableAnimationPresentationView;
  /** Catalog-driven animation module ID, when the consumable definition declares one. */
  readonly animationId?: string;
}


export interface AbilityAnimationEntry {
  readonly abilityId: string;
  readonly animationId: string;
  readonly playerPos: { readonly x: number; readonly y: number };
  readonly targetPos?: { readonly x: number; readonly y: number };
  readonly blastPositions: readonly { readonly x: number; readonly y: number }[];
  readonly targetHpFraction?: number;
  readonly durationMs: number;
  readonly impactFrameMs: number;
  readonly suppressActorBump: boolean;
}

export interface ConsumableAnimationPresentationView {
  readonly kind: 'heal_hearts' | 'buff_rings' | 'cure_sparkles' | 'bomb_blast';
  readonly durationMs: number;
  readonly detonateAtProgress?: number;
  readonly armSpriteName?: string;
  readonly blastOffsets?: readonly { readonly x: number; readonly y: number }[];
  readonly blastSpriteNames?: readonly string[];
}

export interface AvailableAction {
  readonly id: string;
  readonly label: string;
  readonly type: 'move' | 'attack' | 'item' | 'interact' | 'retreat' | 'wait' | 'town' | 'ascend' | 'ability' | 'swap';
  readonly enabled: boolean;
  readonly targetId?: string;
  readonly targetPosition?: { readonly x: number; readonly y: number };
  readonly tileTarget?: boolean;  // Indicates ability requires tile selection instead of dropdown
  readonly description?: string;  // For tooltips
}

export interface EnchantmentSlotView {
  readonly index: number;
  readonly enchantmentId: string | null;
  readonly enchantmentName: string | null;
  readonly enchantmentDescription?: string;
  readonly enchantmentTier?: 1 | 2 | 3 | 'unique';
}

export interface TownView {
  readonly prosperity: number;
  readonly fear: number;
  readonly corruption: number;
  readonly npcs: readonly NpcView[];
  readonly shop: ShopView;
  readonly rumors: readonly string[];
  readonly lastRunSummary: string | null;
  readonly factions: readonly FactionView[];
  readonly factionPressureSummary: string;
  readonly ogreProgress: OgreProgressView;
  readonly atmosphereDescription: string;
  readonly unlockedBlueprints: readonly string[];
  readonly unlockedEnchantmentBlueprints?: readonly EnchantmentBlueprintView[];
  readonly runSummaryStats: RunSummaryStats | null;
  readonly prepAdvice: readonly string[];
  readonly studyableSpells: readonly TownStudyableSpellView[];
  readonly lastRetreatFloor?: number;  // Floor player last retreated from (for continue button)
}



export interface LearnedSpellView {
  readonly spellId: string;
  readonly name: string;
  readonly description: string;
  readonly schools: readonly string[];
  readonly cooldown: number;
  readonly manaCost: number;
  readonly xpGainOnCast: number;
  readonly learned: true;
  readonly unlocked: boolean;
}

export interface RingSchoolMasteryView {
  readonly school: string;
  readonly xp: number;
  readonly displayLevel: number;
  readonly nextDisplayLevelXp: number;
}

export interface SchoolGateView {
  readonly school: string;
  readonly currentXp: number;
  readonly requiredXp: number;
  readonly met: boolean;
}

export interface RingSpellView {
  readonly spellId: string;
  readonly name: string;
  readonly description: string;
  readonly schools: readonly string[];
  readonly cooldown: number;
  readonly manaCost: number;
  readonly xpGainOnCast: number;
  readonly baseDamage: number;
  readonly range: number;
  readonly unlockLevel: number;
  readonly learned: boolean;
  readonly unlocked: boolean;
  readonly affordable: boolean;
  readonly canStudy: boolean;
  readonly schoolGates: readonly SchoolGateView[];
  readonly goldCost: number;
}

export interface TownStudyableSpellView extends RingSpellView {
  readonly currentSchoolLevel: number;
  readonly nextSchoolLevelXp: number;
  readonly schoolMasteries: readonly RingSchoolMasteryView[];
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
  readonly rarityColor: string;  // Canonical color from @dungeon/content
  readonly price: number;
  readonly effectivePrice: number;  // after shopkeeper disposition discount
  readonly stock: number;
  readonly itemClass: string;  // weapon | armor | consumable | trap
  readonly spriteName?: string;  // Atlas sprite name for rendering
  readonly weaponData?: { readonly damage: number; readonly damageMin: number; readonly damageMax: number; readonly damageType: string; readonly accuracy: number; readonly speed: number; readonly weaponRange: number; readonly minRange?: number };
  readonly armorData?: { readonly defense: number; readonly evasionPenalty: number; readonly slot: string; readonly enchantmentSlots: number };
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
  readonly rarityColor: string;  // Canonical color from @dungeon/content
  readonly value: number;
  readonly sellPrice: number;  // floor(value * buybackMultiplier)
  readonly isEquipped: boolean;
  readonly quantity: number;          // 1 for non-stackable, N for stacks
  readonly stackEntityIds: readonly string[];  // all EntityIds in this stack
  readonly templateId: string;        // itemId from template, for grouping
  readonly spriteName?: string;       // Atlas sprite name for rendering
  readonly weaponStats?: { damage: number; damageMin: number; damageMax: number; damageType: string; accuracy: number; speed: number; weaponRange: number; minRange?: number; onHitStatus?: string; onHitChance?: number };
  readonly armorStats?: { defense: number; evasionPenalty: number; slot: string; enchantmentSlots: number; enchantments: readonly (string | null)[]; enchantmentDetails?: readonly EnchantmentSlotView[] };
}

// ── Movement animation types ──────────────────────────────────────────────

/**
 * Visual style of a movement animation.
 * Presenter-owned metadata. Step is the shared baseline today, and the extra enemy
 * variants remain available for an explicit future override.
 */
export type MoveAnimStyle =
  | 'step'    // Shared walk baseline
  | 'slide'   // Reserved future enemy override
  | 'dart'    // wall_stalker — ease-in cubic, explosive start
  | 'drift'   // rearline_anchor — ease-in-out quintic, floaty
  | 'stomp'   // chokepoint_holder — back ease-out, overshoots then settles
  | 'lurch';  // ambush_idle — frozen for 25% then rushes

export interface MoveAnimationEntry {
  readonly entityId:   import('@dungeon/contracts').EntityId;
  readonly fromPos:    { readonly x: number; readonly y: number };
  readonly toPos:      { readonly x: number; readonly y: number };
  readonly style:      MoveAnimStyle;
  readonly durationMs: number;
}
import type { FactionPowerBand, FactionStatus } from '@dungeon/contracts';
