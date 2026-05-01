import type { GameState, EnemyInstance } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { ECONOMY, ITEM_BY_ID, ALL_ITEMS, getDropWeights } from '@dungeon/content';
import type { SeededRNG } from '../utils/rng.js';
import { addItemToInventory } from './inventory.js';

/** Pick a rarity based on weighted [common, uncommon, rare, epic] */
function weightedPickRarity(weights: [number, number, number, number], rng: SeededRNG): string {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.float(0, total);
  const rarities = ['common', 'uncommon', 'rare', 'epic'] as const;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return rarities[i]!;
  }
  return 'common';
}

/** Roll for item loot from a chest at the given depth */
export function rollChestLoot(depth: number, rng: SeededRNG): string | null {
  const weights = getDropWeights(depth);
  const rarity = weightedPickRarity(weights, rng);
  const eligible = ALL_ITEMS.filter(item => item.rarity === rarity && item.itemClass !== 'trap');
  if (eligible.length === 0) {
    // Fallback to any item if no eligible at this rarity
    const fallback = ALL_ITEMS.filter(item => item.rarity === 'common' && item.itemClass !== 'trap');
    if (fallback.length === 0) return null;
    const weighted = fallback.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
    return rng.pick(weighted).itemId;
  }
  const weighted = eligible.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
  return rng.pick(weighted).itemId;
}

/** Roll for rare or better loot (used by special objects like arcane altar) */
export function rollRareLoot(rng: SeededRNG): string | null {
  const eligible = ALL_ITEMS.filter(item =>
    (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary') &&
    item.itemClass !== 'trap'
  );
  if (eligible.length === 0) return null;
  const weighted = eligible.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
  return rng.pick(weighted).itemId;
}

/** Generate gold drop for a killed enemy */
export function rollGoldDrop(enemy: EnemyInstance, rng: SeededRNG): number {
  const tierGold = ECONOMY.goldPerTier[enemy.tier];
  const variance = rng.float(0.7, 1.3);
  return Math.round(tierGold * variance);
}

/** Roll for item drop from enemy */
export function rollItemDrop(
  _enemy: EnemyInstance,
  rng: SeededRNG,
  depth: number = 1,
): string | null {
  if (!rng.chance(30)) return null;

  const weights = getDropWeights(depth);
  const rarity = weightedPickRarity(weights, rng);
  const eligible = ALL_ITEMS.filter(item => item.rarity === rarity && item.itemClass !== 'trap');
  if (eligible.length === 0) {
    const fallback = ALL_ITEMS.filter(item => item.rarity === 'common' && item.itemClass !== 'trap');
    if (fallback.length === 0) return null;
    const weighted = fallback.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
    return rng.pick(weighted).itemId;
  }
  const weighted = eligible.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
  return rng.pick(weighted).itemId;
}

/** Process loot from a killed enemy */
export function processEnemyLoot(
  state: GameState,
  enemy: EnemyInstance,
  rng: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let currentState = state;

  // Gold drop
  const gold = rollGoldDrop(enemy, rng);
  if (gold > 0) {
    currentState = {
      ...currentState,
      player: {
        ...currentState.player,
        gold: currentState.player.gold + gold,
      },
    };
    events = [...events, {
      type: 'GOLD_CHANGED',
      playerId: currentState.player.id,
      amount: gold,
      newTotal: currentState.player.gold,
      reason: `Looted from ${enemy.name}`,
      timestamp: currentState.turnNumber,
      turnNumber: currentState.turnNumber,
    }];
  }

  // Item drop
  const depth = state.run?.floor.depth ?? 1;
  const itemId = rollItemDrop(enemy, rng, depth);
  if (itemId !== null) {
    const template = ITEM_BY_ID.get(itemId);
    if (template !== undefined) {
      // C1: Unlimited inventory — always add items
      const result = addItemToInventory(currentState, template);
      currentState = result.state;
      events = [...events, ...result.events];
    }
  }

  return { state: currentState, events };
}
