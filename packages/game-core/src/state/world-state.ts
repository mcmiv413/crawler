import type { WorldState, TownState, NpcState, ShopInventory } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { ECONOMY, CONSUMABLES, WEAPONS, ARMOR, INITIAL_FACTIONS, rustySword, ironMace, shortBow,
  handAxe, flameDagger, venomBlade, warBow, stoneHammer, frostAxe, ironSword, leatherVest,
  leatherCap, leatherGloves, leatherBoots, copperRing, chainShirt, ironHelm, chainGauntlets } from '@dungeon/content';
import type { SeededRNG } from '../utils/rng.js';

/** Create initial world state for a new game */
export function createInitialWorldState(rng: SeededRNG): WorldState {
  return {
    town: createInitialTownState(),
    npcs: createInitialNpcs(),
    shop: createInitialShop(rng),
    eventHistory: [],
    totalRuns: 0,
    deepestFloor: 0,
    nemeses: [],
    factions: [...INITIAL_FACTIONS],
    unlockedBlueprints: [],
    highestRarityFound: 'common',
  };
}

function createInitialTownState(): TownState {
  return {
    prosperity: 50,
    fear: 10,
    corruption: 0,
    rumors: [],
    lastRunSummary: null,
  };
}

function createInitialNpcs(): NpcState[] {
  return [
    {
      id: entityId('npc_shopkeeper'),
      name: 'Torben',
      role: 'shopkeeper',
      disposition: 50,
      available: true,
      dialogueKey: 'shopkeeper',
    },
    {
      id: entityId('npc_healer'),
      name: 'Miriam',
      role: 'healer',
      disposition: 60,
      available: true,
      dialogueKey: 'healer',
    },
    {
      id: entityId('npc_informant'),
      name: 'Scratch',
      role: 'informant',
      disposition: 30,
      available: true,
      dialogueKey: 'informant',
    },
    {
      id: entityId('npc_blacksmith'),
      name: 'Hilda',
      role: 'blacksmith',
      disposition: 40,
      available: true,
      dialogueKey: 'blacksmith',
    },
    {
      id: entityId('npc_elder'),
      name: 'Elder Orin',
      role: 'elder',
      disposition: 70,
      available: true,
      dialogueKey: 'elder',
    },
    {
      id: entityId('npc_enchanter'),
      name: 'Seraphel',
      role: 'enchanter',
      disposition: 50,
      available: true,
      dialogueKey: 'enchanter',
    },
  ];
}

// Curated shop IDs covering all equipment slots with all rarities.
// Rarity gating is applied at display/buy time, not at stock time.
const SHOP_WEAPON_IDS = [rustySword, ironMace, shortBow, handAxe,
  flameDagger, venomBlade, warBow, stoneHammer,
  frostAxe, ironSword].map(w => w.itemId);
const SHOP_ARMOR_IDS = [leatherVest, leatherCap, leatherGloves, leatherBoots, copperRing,
  chainShirt, ironHelm, chainGauntlets].map(a => a.itemId);

function createInitialShop(rng: SeededRNG): ShopInventory {
  const allItems = [...WEAPONS, ...ARMOR];

  // Randomize weapon selection: pick 3-4 random weapons from the curated list
  const shuffledWeapons = rng.shuffle(SHOP_WEAPON_IDS);
  const selectedWeaponCount = 3 + rng.int(0, 1); // 3 or 4
  const selectedWeaponIds = shuffledWeapons.slice(0, selectedWeaponCount);

  const weaponItems = selectedWeaponIds
    .map(id => allItems.find(i => i.itemId === id))
    .filter((i): i is NonNullable<typeof i> => i != null)
    .map(w => ({ itemId: w.itemId, price: Math.round(w.value * ECONOMY.shopMarkup), stock: 1 }));

  // Randomize armor selection: pick 2-3 random armor pieces from the curated list
  const shuffledArmor = rng.shuffle(SHOP_ARMOR_IDS);
  const selectedArmorCount = 2 + rng.int(0, 1); // 2 or 3
  const selectedArmorIds = shuffledArmor.slice(0, selectedArmorCount);

  const armorItems = selectedArmorIds
    .map(id => allItems.find(i => i.itemId === id))
    .filter((i): i is NonNullable<typeof i> => i != null)
    .map(a => ({ itemId: a.itemId, price: Math.round(a.value * ECONOMY.shopMarkup), stock: 1 }));

  // Always include all consumables (potions are the basic requirement)
  const consumableItems = CONSUMABLES.map(c => ({
    itemId: c.itemId,
    price: Math.round(c.value * ECONOMY.shopMarkup),
    stock: 15,
  }));

  return {
    items: [...consumableItems, ...weaponItems, ...armorItems],
    buybackMultiplier: ECONOMY.buybackRate,
  };
}

/** Randomize full shop inventory (weapons, armor, consumables) */
export function randomizeShop(rng: SeededRNG): ShopInventory {
  const allItems = [...WEAPONS, ...ARMOR];

  // Randomize weapon selection: pick 3-4 random weapons from the curated list
  const shuffledWeapons = rng.shuffle(SHOP_WEAPON_IDS);
  const selectedWeaponCount = 3 + rng.int(0, 1); // 3 or 4
  const selectedWeaponIds = shuffledWeapons.slice(0, selectedWeaponCount);

  const weaponItems = selectedWeaponIds
    .map(id => allItems.find(i => i.itemId === id))
    .filter((i): i is NonNullable<typeof i> => i != null)
    .map(w => ({ itemId: w.itemId, price: Math.round(w.value * ECONOMY.shopMarkup), stock: 1 }));

  // Randomize armor selection: pick 2-3 random armor pieces from the curated list
  const shuffledArmor = rng.shuffle(SHOP_ARMOR_IDS);
  const selectedArmorCount = 2 + rng.int(0, 1); // 2 or 3
  const selectedArmorIds = shuffledArmor.slice(0, selectedArmorCount);

  const armorItems = selectedArmorIds
    .map(id => allItems.find(i => i.itemId === id))
    .filter((i): i is NonNullable<typeof i> => i != null)
    .map(a => ({ itemId: a.itemId, price: Math.round(a.value * ECONOMY.shopMarkup), stock: 1 }));

  // Always include all consumables (potions are the basic requirement)
  const consumableItems = CONSUMABLES.map(c => ({
    itemId: c.itemId,
    price: Math.round(c.value * ECONOMY.shopMarkup),
    stock: 15,
  }));

  return {
    items: [...consumableItems, ...weaponItems, ...armorItems],
    buybackMultiplier: ECONOMY.buybackRate,
  };
}
