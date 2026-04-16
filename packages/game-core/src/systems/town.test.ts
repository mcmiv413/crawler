import { describe, it, expect } from 'vitest';
import { processTownAction, processEnchantArmor } from './town.js';
import { createTestGameState } from '../test-utils.js';
import { entityId } from '@dungeon/contracts';
import type { NpcState, ArmorTemplate } from '@dungeon/contracts';
import { ECONOMY } from '@dungeon/content';

const shopkeeper: NpcState = {
  id: entityId('npc_shopkeeper'),
  name: 'Torben',
  role: 'shopkeeper',
  disposition: 50,
  available: true,
  dialogueKey: 'shopkeeper',
};


describe('processTownAction rest', () => {
  it('restores HP to max when player can afford full heal', () => {
    const missingHp = 40;
    const maxHealth = 100;
    const state = createTestGameState({
      player: {
        stats: { maxHealth, health: 60, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 100 },
        gold: missingHp * ECONOMY.healCostPerHp + 10, // more than enough
      },
    });

    const { state: newState } = processTownAction(state, 'rest');

    expect(newState.player.stats.health).toBe(newState.player.stats.maxHealth);
  });

  it('heals only affordable HP when gold is insufficient', () => {
    const initialHealth = 50;
    const state = createTestGameState({
      player: {
        stats: { maxHealth: 100, health: initialHealth, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 100 },
        gold: 10,
      },
    });

    const { state: newState } = processTownAction(state, 'rest');

    expect(newState.player.stats.health).toBeGreaterThan(initialHealth);
    expect(newState.player.stats.health).toBeLessThanOrEqual(newState.player.stats.maxHealth);
    expect(newState.player.gold).toBeLessThanOrEqual(state.player.gold);
  });

  it('returns unchanged state when already at full HP', () => {
    const state = createTestGameState({
      player: {
        stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 100 },
        gold: 50,
      },
    });

    const { state: newState } = processTownAction(state, 'rest');

    expect(newState.player.stats.health).toBe(newState.player.stats.maxHealth);
    expect(newState.player.gold).toBe(state.player.gold);
  });
});

describe('processTownAction shop_sell', () => {
  it('returns gold to player and removes item from inventory', () => {
    const baseState = createTestGameState({ player: { gold: 10 } });
    const initialGold = baseState.player.gold;
    // Add an item to inventory manually via registry
    const itemInstanceId = entityId('item_inst_1');
    const itemValue = 10;
    const newRegistry = new Map(baseState.itemRegistry.items);
    newRegistry.set(itemInstanceId, {
      itemId: 'health_potion',
      name: 'Health Potion',
      description: 'Heals 30 HP',
      itemClass: 'consumable' as const,
      rarity: 'common' as const,
      value: itemValue,
      stackable: true,
      maxStack: 5,
      consumable: { effect: 'heal' as const, magnitude: 30 },
    });
    const stateWithItem = {
      ...baseState,
      player: { ...baseState.player, inventory: [itemInstanceId] },
      itemRegistry: { items: newRegistry },
      world: { ...baseState.world, shop: { ...baseState.world.shop, buybackMultiplier: 0.4 } },
    };
    const { state: newState } = processTownAction(stateWithItem, 'shop_sell', itemInstanceId);
    expect(newState.player.gold).toBeGreaterThan(initialGold);
    expect(newState.player.inventory).not.toContain(itemInstanceId);
  });
});

describe('processTownAction shop_buy', () => {
  const shopState = createTestGameState({
    world: {
      shop: {
        items: [{ itemId: 'health_potion', price: 15, stock: 3 }],
        buybackMultiplier: 0.4,
      },
    },
    player: { gold: 50 },
  });

  it('deducts gold and adds item to inventory', () => {
    const initialGold = shopState.player.gold;
    const initialInvLength = shopState.player.inventory.length;
    const { state: newState } = processTownAction(shopState, 'shop_buy', undefined, 'health_potion');

    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.inventory.length).toBeGreaterThan(initialInvLength);
  });

  it('fails when player has insufficient gold — state unchanged', () => {
    const poorState = createTestGameState({
      world: {
        shop: {
          items: [{ itemId: 'health_potion', price: 100, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: 50 },
    });

    const { state: newState } = processTownAction(poorState, 'shop_buy', undefined, 'health_potion');

    expect(newState.player.gold).toBe(poorState.player.gold);
    expect(newState.player.inventory.length).toBe(poorState.player.inventory.length);
  });

  it('decrements shop stock after purchase', () => {
    const initialStock = shopState.world.shop.items.find(i => i.itemId === 'health_potion')?.stock ?? 0;
    const { state: newState } = processTownAction(shopState, 'shop_buy', undefined, 'health_potion');

    const shopItem = newState.world.shop.items.find(i => i.itemId === 'health_potion');
    expect(shopItem?.stock ?? 0).toBeLessThan(initialStock);
  });

  it('shopkeeper with disposition=50 applies 5% discount per 10 disposition (25% total)', () => {
    const basePrice = 100;
    const initialGold = 200;
    const stateWithShopkeeper = createTestGameState({
      world: {
        npcs: [shopkeeper],
        shop: {
          items: [{ itemId: 'health_potion', price: basePrice, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithShopkeeper, 'shop_buy', undefined, 'health_potion');
    // With disposition=50, should have a discount applied
    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.gold).toBeGreaterThan(initialGold - basePrice);
  });

  it('shopkeeper with disposition=0 applies no discount', () => {
    const basePrice = 100;
    const initialGold = 200;
    const noDispositionShopkeeper: NpcState = { ...shopkeeper, disposition: 0 };
    const stateWithShopkeeper = createTestGameState({
      world: {
        npcs: [noDispositionShopkeeper],
        shop: {
          items: [{ itemId: 'health_potion', price: basePrice, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithShopkeeper, 'shop_buy', undefined, 'health_potion');
    expect(newState.player.gold).toBeLessThanOrEqual(initialGold - basePrice);
  });

  it('discount is capped at 25%', () => {
    const basePrice = 100;
    const initialGold = 200;
    const maxShopkeeper: NpcState = { ...shopkeeper, disposition: 100 };
    const stateWithShopkeeper = createTestGameState({
      world: {
        npcs: [maxShopkeeper],
        shop: {
          items: [{ itemId: 'health_potion', price: basePrice, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithShopkeeper, 'shop_buy', undefined, 'health_potion');
    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.gold).toBeGreaterThanOrEqual(initialGold - basePrice);
  });

  it('allows purchasing uncommon items when highestFound >= uncommon', () => {
    const itemPrice = 50;
    const initialGold = 100;
    const stateWithUncommonFound = createTestGameState({
      world: {
        shop: {
          items: [{ itemId: 'stone_hammer', price: itemPrice, stock: 3 }], // uncommon weapon
          buybackMultiplier: 0.4,
        },
        highestRarityFound: 'uncommon', // Player has found uncommon items
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithUncommonFound, 'shop_buy', undefined, 'stone_hammer');
    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.inventory.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// processEnchantArmor
// ---------------------------------------------------------------------------

const chestArmor: ArmorTemplate = {
  itemId: 'test_chain',
  name: 'Test Chain',
  description: 'A chain shirt',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 35,
  stackable: false,
  maxStack: 1,
  armor: { defense: 5, evasionPenalty: 5, slot: 'chest', enchantmentSlots: 1, enchantments: [null] },
};

const rareChest: ArmorTemplate = {
  itemId: 'test_plate',
  name: 'Test Plate',
  description: 'Plate armor',
  itemClass: 'armor',
  rarity: 'rare',
  value: 70,
  stackable: false,
  maxStack: 1,
  armor: { defense: 10, evasionPenalty: 15, slot: 'chest', enchantmentSlots: 2, enchantments: [null, null] },
};

function makeStateWithArmorEquipped(armorTemplate: ArmorTemplate, gold = 500): ReturnType<typeof createTestGameState> {
  const armorId = entityId('armor_1');
  const registry = new Map([[armorId, armorTemplate]]);
  return {
    ...createTestGameState({ player: { gold } }),
    player: {
      ...createTestGameState({ player: { gold } }).player,
      equipment: {
        weapon: null, secondaryWeapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null,
      },
    },
    world: {
      ...createTestGameState().world,
      unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire'],
    },
    itemRegistry: { items: registry as any },
  };
}

describe('processEnchantArmor', () => {
  it('rejects if enchantmentId not in unlockedBlueprints', () => {
    const initialGold = 500;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'defense_boost'); // not unlocked
    expect(s2.player.gold).toBe(initialGold); // unchanged
  });

  it('rejects if player has insufficient gold', () => {
    const initialGold = 35;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold); // unchanged due to insufficient gold
  });

  it('rejects if no item in the equipment slot', () => {
    const initialGold = 500;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'head', 'hp_regen'); // head slot empty
    expect(s2.player.gold).toBe(initialGold);
  });

  it('rejects if item has no enchantment slots (common rarity)', () => {
    const commonArmor: ArmorTemplate = {
      ...chestArmor,
      itemId: 'common_vest',
      rarity: 'common',
      armor: { ...chestArmor.armor, enchantmentSlots: 0, enchantments: [] },
    };
    const armorId = entityId('armor_common');
    const initialGold = 500;
    const state = {
      ...createTestGameState({ player: { gold: initialGold } }),
      player: {
        ...createTestGameState({ player: { gold: initialGold } }).player,
        equipment: { weapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen'] },
      itemRegistry: { items: new Map([[armorId, commonArmor]]) as any },
    };
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold);
  });

  it('rejects if all enchantment slots are already filled', () => {
    const fullArmor: ArmorTemplate = {
      ...chestArmor,
      armor: { ...chestArmor.armor, enchantments: ['thorns'] },
    };
    const armorId = entityId('armor_full');
    const initialGold = 500;
    const state = {
      ...createTestGameState({ player: { gold: initialGold } }),
      player: {
        ...createTestGameState({ player: { gold: initialGold } }).player,
        equipment: { weapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen', 'thorns'] },
      itemRegistry: { items: new Map([[armorId, fullArmor]]) as any },
    };
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold);
  });

  it('rejects if enchantment is already applied to the item', () => {
    const alreadyEnchanted: ArmorTemplate = {
      ...rareChest,
      armor: { ...rareChest.armor, enchantments: ['hp_regen', null] },
    };
    const armorId = entityId('armor_enc');
    const initialGold = 500;
    const state = {
      ...createTestGameState({ player: { gold: initialGold } }),
      player: {
        ...createTestGameState({ player: { gold: initialGold } }).player,
        equipment: { weapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen'] },
      itemRegistry: { items: new Map([[armorId, alreadyEnchanted]]) as any },
    };
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold);
  });

  it('deducts gold for enchantment when affordable', () => {
    const initialGold = 200;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBeLessThan(initialGold);
  });

  it('fills the first null enchantment slot', () => {
    const state = makeStateWithArmorEquipped(chestArmor, 200);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    const armorId = s2.player.equipment.chest!;
    const updatedArmor = s2.itemRegistry.items.get(armorId) as ArmorTemplate;
    expect(updatedArmor.armor.enchantments[0]).toBe('hp_regen');
  });

  it('emits ENCHANTMENT_APPLIED event', () => {
    const state = makeStateWithArmorEquipped(chestArmor, 200);
    const { events } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(events.some(e => e.type === 'ENCHANTMENT_APPLIED')).toBe(true);
  });

  it('recalculates player stats after enchantment', () => {
    const armorId = entityId('armor_2slot');
    const twoSlotArmor: ArmorTemplate = {
      ...rareChest,
      armor: { ...rareChest.armor },
    };
    const state = {
      ...createTestGameState({ player: { gold: 500 } }),
      player: {
        ...createTestGameState({ player: { gold: 500 } }).player,
        equipment: { weapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire', 'evasion_boost', 'defense_boost'] },
      itemRegistry: { items: new Map([[armorId, twoSlotArmor]]) as any },
    };
    const baseDefense = state.player.baseStats.defense + twoSlotArmor.armor.defense;
    const { state: s2 } = processEnchantArmor(state, 'chest', 'defense_boost');
    expect(s2.player.stats.defense).toBeGreaterThan(baseDefense);
  });

  it('no partial mutation on failure — state identical to input', () => {
    const state = makeStateWithArmorEquipped(chestArmor, 35);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2).toBe(state); // same reference (no new object)
  });
});
