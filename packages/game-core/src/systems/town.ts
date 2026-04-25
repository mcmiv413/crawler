import type { GameState, TownActionType, EntityId, EquipSlot, ArmorTemplate } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { ECONOMY, ITEM_BY_ID, ENCHANTMENT_BY_ID, getEnchantmentCost, isRarityBuyable } from '@dungeon/content';
import type { SeededRNG } from '../utils/rng.js';
import { addItemToInventory, removeItemFromInventory } from './inventory.js';
import { calculateEquippedStats } from './equipment.js';
import { processTalkNpc } from './npc.js';

/** Process enchanting an equipped armor piece */
export function processEnchantArmor(
  state: GameState,
  equipSlot: EquipSlot,
  enchantmentId: string,
): { state: GameState; events: DomainEvent[] } {
  // Guard: enchantment must be unlocked
  if (!state.world.unlockedBlueprints.includes(enchantmentId)) {
    return { state, events: [] };
  }

  const enchDef = ENCHANTMENT_BY_ID.get(enchantmentId);
  if (enchDef === undefined) return { state, events: [] };

  const cost = getEnchantmentCost(enchantmentId);

  // Guard: sufficient gold
  if (state.player.gold < cost) {
    return { state, events: [] };
  }

  // Guard: item in slot
  const itemId = state.player.equipment[equipSlot];
  if (itemId === null) return { state, events: [] };

  const template = state.itemRegistry.items.get(itemId);
  if (template === undefined || template.itemClass !== 'armor') return { state, events: [] };

  const armorTemplate = template as ArmorTemplate;
  const armor = armorTemplate.armor;

  // Guard: has slots
  if (armor.enchantmentSlots <= 0) return { state, events: [] };

  // Guard: slot available
  const firstNull = armor.enchantments.indexOf(null);
  if (firstNull === -1) return { state, events: [] };

  // Guard: not duplicate
  if (armor.enchantments.includes(enchantmentId)) return { state, events: [] };

  // Apply: new enchantments array
  const newEnchantments = [...armor.enchantments] as (string | null)[];
  newEnchantments[firstNull] = enchantmentId;

  const updatedTemplate: ArmorTemplate = {
    ...armorTemplate,
    armor: { ...armor, enchantments: newEnchantments },
  };

  const newRegistry = new Map(state.itemRegistry.items);
  newRegistry.set(itemId, updatedTemplate);

  const newGold = state.player.gold - cost;

  // Recalculate stats with updated item
  const newEquipment = state.player.equipment;
  const newStats = calculateEquippedStats(
    state.player.baseStats,
    state.player.stats.health,
    newEquipment,
    newRegistry,
  );

  const events: DomainEvent[] = [{
    type: 'ENCHANTMENT_APPLIED',
    playerId: state.player.id,
    itemId,
    itemName: armorTemplate.name,
    enchantmentId,
    enchantmentName: enchDef.name,
    slot: equipSlot,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  }];

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        gold: newGold,
        stats: newStats,
      },
      itemRegistry: { items: newRegistry },
    },
    events,
  };
}

/** Process a town action */
export function processTownAction(
  state: GameState,
  action: TownActionType,
  targetId?: EntityId,
  itemId?: string,
  rng?: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  switch (action) {
    case 'rest':
      return processRest(state);
    case 'shop_buy':
      return processShopBuy(state, itemId);
    case 'shop_sell':
      return processShopSell(state, targetId);
    case 'shop_undo':
      return processShopUndo(state);
    case 'enter_dungeon':
      return { state, events: [] }; // Handled separately by engine
    case 'talk_npc':
      return processTalkNpc(state, targetId, rng);
    case 'enchant_armor':
      return { state, events: [] }; // Handled by ENCHANT_ARMOR command directly
  }
}

function processRest(state: GameState): { state: GameState; events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  const missingHp = state.player.stats.maxHealth - state.player.stats.health;

  if (missingHp <= 0) return { state, events };

  const cost = missingHp * ECONOMY.healCostPerHp;
  if (state.player.gold < cost) {
    // Heal what they can afford
    const affordable = Math.floor(state.player.gold / ECONOMY.healCostPerHp);
    if (affordable <= 0) return { state, events };

    return {
      state: {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: state.player.stats.health + affordable },
          gold: state.player.gold - (affordable * ECONOMY.healCostPerHp),
        },
      },
      events,
    };
  }

  events = [...events, {
    type: 'GOLD_CHANGED',
    playerId: state.player.id,
    amount: -cost,
    newTotal: state.player.gold - cost,
    reason: 'Healing at town',
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  }];

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: state.player.stats.maxHealth },
        statuses: [],
        gold: state.player.gold - cost,
      },
    },
    events,
  };
}

function processShopBuy(
  state: GameState,
  itemId?: string,
): { state: GameState; events: DomainEvent[] } {
  if (itemId === undefined) return { state, events: [] };

  const shopItem = state.world.shop.items.find(i => i.itemId === itemId);
  if (shopItem === undefined || shopItem.stock <= 0) return { state, events: [] };

  const basePrice = shopItem.price;
  const shopkeeper = state.world.npcs.find(n => n.role === 'shopkeeper');
  const discountPct = shopkeeper !== undefined
    ? Math.min(25, Math.floor(shopkeeper.disposition / 10) * 5)
    : 0;
  const price = Math.max(1, Math.floor(basePrice * (1 - discountPct / 100)));

  if (state.player.gold < price) return { state, events: [] };

  const template = ITEM_BY_ID.get(itemId);
  if (template === undefined) return { state, events: [] };

  // Server-side rarity gate: enforce the same rules as the presenter filter
  if (isRarityBuyable(template.rarity, state.world.highestRarityFound) !== true) {
    return { state, events: [] };
  }

  // Save snapshot before mutation
  const oldGold = state.player.gold;
  const oldShopItems = state.world.shop.items;
  const oldInventoryIds = state.player.inventory;

  // Deduct gold, add item, reduce stock
  const newShopItems = state.world.shop.items.map(i =>
    i.itemId === itemId ? { ...i, stock: i.stock - 1 } : i,
  );

  let updatedState: GameState = {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - price,
    },
    world: {
      ...state.world,
      shop: { ...state.world.shop, items: newShopItems },
    },
  };

  const result = addItemToInventory(updatedState, template);

  // Record transaction for undo
  const newShop = {
    ...result.state.world.shop,
    lastTransaction: {
      type: 'buy' as const,
      itemId,
      quantity: 1,
      goldDelta: -price,
      snapshot: {
        playerGold: oldGold,
        shopItems: oldShopItems,
        playerInventoryIds: oldInventoryIds,
      },
    },
  };

  return {
    state: {
      ...result.state,
      world: { ...result.state.world, shop: newShop },
    },
    events: result.events,
  };
}

function processShopSell(
  state: GameState,
  itemEntityId?: EntityId,
): { state: GameState; events: DomainEvent[] } {
  if (itemEntityId === undefined) return { state, events: [] };

  const template = state.itemRegistry.items.get(itemEntityId);
  if (template === undefined) return { state, events: [] };

  const sellPrice = Math.floor(template.value * state.world.shop.buybackMultiplier);

  // Save snapshot before mutation
  const oldGold = state.player.gold;
  const oldShopItems = state.world.shop.items;
  const oldInventoryIds = state.player.inventory;

  const stateWithGold = { ...state, player: { ...state.player, gold: state.player.gold + sellPrice } };
  const resultState = removeItemFromInventory(stateWithGold, itemEntityId);

  // Record transaction for undo
  const newShop = {
    ...resultState.world.shop,
    lastTransaction: {
      type: 'sell' as const,
      itemId: itemEntityId,
      quantity: 1,
      goldDelta: sellPrice,
      snapshot: {
        playerGold: oldGold,
        shopItems: oldShopItems,
        playerInventoryIds: oldInventoryIds,
      },
    },
  };

  return {
    state: {
      ...resultState,
      world: { ...resultState.world, shop: newShop },
    },
    events: [],
  };
}

function processShopUndo(
  state: GameState,
): { state: GameState; events: DomainEvent[] } {
  const transaction = state.world.shop.lastTransaction;
  if (transaction === undefined) return { state, events: [] };

  const { snapshot } = transaction;

  // Restore player gold and inventory
  const stateWithGold = {
    ...state,
    player: {
      ...state.player,
      gold: snapshot.playerGold,
    },
  };

  // Restore inventory to match the snapshot
  const stateWithInventory = {
    ...stateWithGold,
    player: {
      ...stateWithGold.player,
      inventory: snapshot.playerInventoryIds,
    },
  };

  // Restore shop items and clear transaction
  const newShop = {
    ...state.world.shop,
    items: snapshot.shopItems,
    lastTransaction: undefined,
  };

  return {
    state: {
      ...stateWithInventory,
      world: {
        ...stateWithInventory.world,
        shop: newShop,
      },
    },
    events: [],
  };
}
