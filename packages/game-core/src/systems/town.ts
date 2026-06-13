import type { GameState, TownActionType, EntityId, EquipSlot, ArmorTemplate } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { ECONOMY, ITEM_BY_ID, ENCHANTMENT_BY_ID, getEnchantmentCost, isRarityBuyable, getStudySpell } from '@dungeon/content';
import { redeemQuest } from './quest-progress.js';
import type { SeededRNG } from '../utils/rng.js';
import { addItemToInventory, removeItemFromInventory } from './inventory.js';
import { calculateEquippedStats } from './equipment.js';
import { processTalkNpc } from './npc.js';
import { learnRingSpell } from './magic-xp.js';
import { syncEquipmentGrantedAbilities } from './equipment.js';
import { evaluateRingSpellStudy, getEquippedRingItemIds } from './ring-spell-availability.js';
import { validateTownTransaction } from './town-validator.js';
import { buildEnchantmentAppliedEvent, buildGoldChangedEvent, buildSpellUnlockedEvent } from '../abilities/runtime/emit-events.js';

function buildTownActionRejectedEvent(
  state: GameState,
  actionId: string,
  rejectionCode: string,
  message: string,
): DomainEvent {
  return {
    type: 'PLAYER_ACTION_REJECTED',
    actionType: 'TOWN_ACTION',
    actionId,
    reasonCode: rejectionCode,
    message,
    playerId: state.player.id,
    timestamp: state.turnNumber,
    turnNumber: state.turnNumber,
  };
}

/** Process enchanting an equipped armor piece */
export function processEnchantArmor(
  state: GameState,
  equipSlot: EquipSlot,
  enchantmentId: string,
): { state: GameState; events: DomainEvent[] } {
  const validation = validateTownTransaction(state, 'ENCHANT_ARMOR', { equipSlot, enchantmentId });
  if (validation.valid === false) {
    return {
      state,
      events: [buildTownActionRejectedEvent(state, enchantmentId, validation.rejectionCode, validation.message)],
    };
  }

  const enchDef = ENCHANTMENT_BY_ID.get(enchantmentId);
  if (enchDef === undefined) {
    return {
      state,
      events: [buildTownActionRejectedEvent(state, enchantmentId, 'ENCHANTMENT_NOT_FOUND', `Enchantment "${enchantmentId}" not found in game content.`)],
    };
  }

  const cost = getEnchantmentCost(enchantmentId);

  const itemId = state.player.equipment[equipSlot];
  if (itemId === null) {
    return {
      state,
      events: [buildTownActionRejectedEvent(state, enchantmentId, 'NO_ENCHANTMENT_SLOT', 'No item is equipped in that slot.')],
    };
  }

  const template = state.itemRegistry.items.get(itemId);
  if (template === undefined || template.itemClass !== 'armor') {
    return {
      state,
      events: [buildTownActionRejectedEvent(state, enchantmentId, 'NO_ENCHANTMENT_SLOT', 'Only armor can be enchanted.')],
    };
  }

  const armorTemplate = template as ArmorTemplate;
  const armor = armorTemplate.armor;

  const firstNull = armor.enchantments.indexOf(null);
  if (armor.enchantmentSlots <= 0 || firstNull === -1) {
    return {
      state,
      events: [buildTownActionRejectedEvent(state, enchantmentId, 'NO_ENCHANTMENT_SLOT', `${template.name} has no open enchantment slot.`)],
    };
  }

  if (armor.enchantments.includes(enchantmentId)) {
    return {
      state,
      events: [buildTownActionRejectedEvent(state, enchantmentId, 'DUPLICATE_ENCHANTMENT', `${template.name} already has ${enchDef.name}.`)],
    };
  }

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

  const events: DomainEvent[] = [buildEnchantmentAppliedEvent({
    playerId: state.player.id,
    itemId,
    itemName: armorTemplate.name,
    enchantmentId,
    enchantmentName: enchDef.name,
    slot: equipSlot,
    turnNumber: state.turnNumber,
  })];

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

function processStudySpell(
  state: GameState,
  spellId?: string,
): { state: GameState; events: DomainEvent[] } {
  // Validate via central validator
  const validation = validateTownTransaction(state, 'STUDY_SPELL', { spellId });
  if (validation.valid === false) {
    return {
      state,
      events: [{
        type: 'PLAYER_ACTION_REJECTED',
        actionType: 'TOWN_ACTION',
        actionId: spellId ?? '',
        reasonCode: validation.rejectionCode,
        message: validation.message,
        playerId: state.player.id,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }],
    };
  }

  const spell = getStudySpell(spellId!);
  if (spell === undefined) {
    // Should not reach here due to validation, but defensive
    return { state, events: [] };
  }

  const equippedItemIds = getEquippedRingItemIds(state.player.equipment, state.itemRegistry.items);
  const evalResult = evaluateRingSpellStudy(state.player, equippedItemIds, spell);

  if (evalResult.canStudy === false) {
    // Should not reach here due to validation, but defensive
    return { state, events: [] };
  }

  const learnedPlayer = learnRingSpell(
    { ...state.player, gold: state.player.gold - evalResult.goldCost },
    spellId!,
  );
  const updatedPlayer = syncEquipmentGrantedAbilities(learnedPlayer, state.itemRegistry.items);

  return {
    state: {
      ...state,
      player: updatedPlayer,
    },
    events: [buildGoldChangedEvent({
      playerId: state.player.id,
      amount: -evalResult.goldCost,
      newTotal: updatedPlayer.gold,
      reason: `Studied ${spell.name}`,
      turnNumber: state.turnNumber,
    }), buildSpellUnlockedEvent({
      playerId: state.player.id,
      spellId: spellId!,
      spellName: spell.name,
      turnNumber: state.turnNumber,
    })],
  };
}

export function processTownAction(
  state: GameState,
  action: TownActionType,
  targetId?: EntityId,
  itemId?: string,
  rng?: SeededRNG,
  spellId?: string,
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
      return { state, events: [] };
    case 'talk_npc':
      return processTalkNpc(state, targetId, rng);
    case 'enchant_armor':
      return { state, events: [] };
    case 'turn_in_quest':
      return processTurnInQuest(state, targetId);
    case 'study_spell':
      return processStudySpell(state, spellId ?? itemId);
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

    const goldDelta = -(affordable * ECONOMY.healCostPerHp);
    return {
      state: {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: state.player.stats.health + affordable },
          statuses: [],
          gold: state.player.gold + goldDelta,
        },
      },
      events: [buildGoldChangedEvent({
        playerId: state.player.id,
        amount: goldDelta,
        newTotal: state.player.gold + goldDelta,
        reason: 'Healing at town',
        turnNumber: state.turnNumber,
      })],
    };
  }

  events = [...events, buildGoldChangedEvent({
    playerId: state.player.id,
    amount: -cost,
    newTotal: state.player.gold - cost,
    reason: 'Healing at town',
    turnNumber: state.turnNumber,
  })];

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
  // Validate via central validator
  const validation = validateTownTransaction(state, 'BUY_ITEM', { itemId });
  if (validation.valid === false) {
    return {
      state,
      events: [{
        type: 'PLAYER_ACTION_REJECTED',
        actionType: 'TOWN_ACTION',
        actionId: itemId ?? '',
        reasonCode: validation.rejectionCode,
        message: validation.message,
        playerId: state.player.id,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }],
    };
  }

  const shopItem = state.world.shop.items.find(i => i.itemId === itemId);
  if (shopItem === undefined || shopItem.stock <= 0) return { state, events: [] }; // Should not reach due to validation

  const basePrice = shopItem.price;
  const shopkeeper = state.world.npcs.find(n => n.role === 'shopkeeper');
  const discountPct = shopkeeper !== undefined
    ? Math.min(25, Math.floor(shopkeeper.disposition / 10) * 5)
    : 0;
  const price = Math.max(1, Math.floor(basePrice * (1 - discountPct / 100)));

  const template = ITEM_BY_ID.get(itemId!);
  if (template === undefined) return { state, events: [] }; // Should not reach due to validation

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
      itemId: itemId!,
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
    events: [buildGoldChangedEvent({
      playerId: state.player.id,
      amount: -price,
      newTotal: result.state.player.gold,
      reason: `Purchased ${template.name}`,
      turnNumber: state.turnNumber,
    }), ...result.events],
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
    events: [buildGoldChangedEvent({
      playerId: state.player.id,
      amount: sellPrice,
      newTotal: resultState.player.gold,
      reason: `Sold ${template.name}`,
      turnNumber: state.turnNumber,
    })],
  };
}

function processShopUndo(
  state: GameState,
): { state: GameState; events: DomainEvent[] } {
  const transaction = state.world.shop.lastTransaction;
  if (transaction === undefined) return { state, events: [] };

  const { snapshot } = transaction;
  const goldDelta = snapshot.playerGold - state.player.gold;

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
    events: goldDelta === 0 ? [] : [buildGoldChangedEvent({
      playerId: state.player.id,
      amount: goldDelta,
      newTotal: snapshot.playerGold,
      reason: 'Undid shop transaction',
      turnNumber: state.turnNumber,
    })],
  };
}


function processTurnInQuest(
  state: GameState,
  questId?: EntityId,
): { state: GameState; events: DomainEvent[] } {
  // Validate via central validator
  const validation = validateTownTransaction(state, 'TURN_IN_QUEST', { questId });
  if (validation.valid === false) {
    return {
      state,
      events: [{
        type: 'PLAYER_ACTION_REJECTED',
        actionType: 'TOWN_ACTION',
        actionId: questId ?? '',
        reasonCode: validation.rejectionCode,
        message: validation.message,
        playerId: state.player.id,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }],
    };
  }

  const quest = state.activeQuests.find(q => q.id === questId);
  if (quest === undefined) return { state, events: [] }; // Should not reach due to validation

  const result = redeemQuest(state, quest);
  return {
    state: result.state,
    events: [result.event],
  };
}
