import type { EntityId, GamePhase, RunMetrics, Position, WeaponMastery } from './common.js';
import type { Player } from './player.js';
import type { EnemyInstance } from './enemy.js';
import type { ObjectInstance } from './objects.js';
import type { DungeonFloor } from './map.js';
import type { TownState, NpcState, ShopInventory, FactionState, Quest } from './town.js';
import type { AnyItemTemplate } from './items.js';
import type { DomainEvent } from '../events/index.js';
import type { NemesisRecord } from './nemesis.js';

export interface StoredFloor {
  readonly floor: DungeonFloor;
  readonly enemies: ReadonlyMap<string, EnemyInstance>;
  readonly objects: ReadonlyMap<string, ObjectInstance>;
  readonly playerPosition: Position;
  // Persistence metadata for respawn simulation
  readonly originalEnemyCount?: number;
  readonly lastSimulatedTurn?: number;
}

export interface RunState {
  readonly runId: EntityId;
  readonly floor: DungeonFloor;
  readonly enemies: ReadonlyMap<string, EnemyInstance>;
  readonly objects: ReadonlyMap<string, ObjectInstance>;  // position key -> object instance
  readonly turnCount: number;
  readonly isActive: boolean;
  readonly runMetrics?: RunMetrics;
  readonly floorHistory: readonly StoredFloor[];
  readonly floorCache?: ReadonlyMap<number, StoredFloor>;  // cleared floors by depth
  readonly speedAccumulators: Readonly<Record<EntityId, number>>;  // fractional movement accumulation for speed-based kiting
}

export interface WorldState {
  readonly town: TownState;
  readonly npcs: readonly NpcState[];
  readonly shop: ShopInventory;
  readonly eventHistory: readonly DomainEvent[];
  readonly totalRuns: number;
  readonly deepestFloor: number;
  readonly nemeses: readonly NemesisRecord[];
  readonly factions: readonly FactionState[];
  readonly unlockedBlueprints: readonly string[];
  readonly highestRarityFound: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface ItemRegistry {
  readonly items: ReadonlyMap<EntityId, AnyItemTemplate>;
}

export interface GameState {
  readonly gameId: EntityId;
  readonly phase: GamePhase;
  readonly player: Player;
  readonly run: RunState | null;
  readonly world: WorldState;
  readonly itemRegistry: ItemRegistry;
  readonly seed: number;
  readonly turnNumber: number;
  readonly version: number;
  readonly activeQuests: readonly Quest[];
  readonly persistedFloorCache?: ReadonlyMap<number, StoredFloor>;  // Floors persisted across runs
  readonly lastRetreatFloor?: number;  // Track which floor player last retreated from
  readonly lastRunMetrics?: RunMetrics;  // Metrics from the most recent run (for town summary display)
  readonly weaponMastery: WeaponMastery;  // Weapon mastery hit counts persist across deaths
  readonly debugMode?: boolean;  // Show debug information in UI
}
