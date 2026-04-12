import type {
  EntityId, GameState, Player, AnyItemTemplate,
  WeaponTemplate, ArmorTemplate,
  Equipment, PlayerStats, DamageType,
} from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { ENCHANTMENT_BY_ID, getImpliedBlueprints } from '@dungeon/content';

const ARMOR_EQUIP_SLOTS: readonly (keyof Equipment)[] = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'];

/**
 * Find which slot (if any) contains the given itemId in equipment.
 * Returns the slot name ('weapon', 'chest', 'head', etc.) or null if not found.
 */
function findEquipmentSlot(equipment: Equipment, itemId: EntityId): keyof Equipment | null {
  if (equipment.weapon === itemId) return 'weapon';
  if (equipment.chest === itemId) return 'chest';
  if (equipment.head === itemId) return 'head';
  if (equipment.gloves === itemId) return 'gloves';
  if (equipment.boots === itemId) return 'boots';
  if (equipment.ring1 === itemId) return 'ring1';
  if (equipment.ring2 === itemId) return 'ring2';
  if (equipment.secondaryWeapon === itemId) return 'secondaryWeapon';
  return null;
}

/**
 * Helper to recalculate stats and return updated player + state.
 * Common pattern used in equipItem, unequipItem, swapWeaponSets.
 */
function withRecalculatedStats(
  state: GameState,
  newEquipment: Equipment,
): Player {
  const newStats = calculateEquippedStats(
    state.player.baseStats,
    state.player.stats.health,
    newEquipment,
    state.itemRegistry.items,
  );
  return {
    ...state.player,
    equipment: newEquipment,
    stats: newStats,
  };
}

/**
 * Recalculate effective stats from base stats + equipped items (all 7 slots).
 * Accumulates defense/evasion/enchantment bonuses and builds resistances map.
 */
export function calculateEquippedStats(
  baseStats: PlayerStats,
  currentHealth: number,
  equipment: Equipment,
  registry: ReadonlyMap<EntityId, AnyItemTemplate>,
): PlayerStats {
  let attack = baseStats.attack;
  let defense = baseStats.defense;
  let accuracy = baseStats.accuracy;
  let evasion = baseStats.evasion;
  let speed = baseStats.speed;
  const resistances: Record<string, number> = { ...baseStats.resistances };

  if (equipment.weapon !== null) {
    const template = registry.get(equipment.weapon);
    if (template !== undefined && template.itemClass === 'weapon') {
      const weapon = (template as WeaponTemplate).weapon;
      attack += weapon.damage;
      accuracy += weapon.accuracy;
      speed += weapon.speed;
    }
  }

  for (const slot of ARMOR_EQUIP_SLOTS) {
    const itemId = equipment[slot];
    if (itemId === null) continue;
    const template = registry.get(itemId);
    if (template === undefined || template.itemClass !== 'armor') continue;
    const armor = (template as ArmorTemplate).armor;
    defense += armor.defense;
    evasion -= armor.evasionPenalty;

    // Apply item-level resistance (e.g. fire_ward_cloak)
    if (armor.resistance !== undefined) {
      for (const [dmgType, val] of Object.entries(armor.resistance)) {
        resistances[dmgType] = Math.min(0.75, (resistances[dmgType] ?? 0) + val);
      }
    }

    // Apply enchantment stat bonuses
    for (const enchId of armor.enchantments) {
      if (enchId === null) continue;
      const enchDef = ENCHANTMENT_BY_ID.get(enchId);
      if (enchDef === undefined) continue;
      const eff = enchDef.effect;
      if (eff.type === 'stat_bonus' && eff.stat !== undefined && eff.value !== undefined) {
        if (eff.stat === 'defense') defense += eff.value;
        else if (eff.stat === 'evasion') evasion += eff.value;
        else speed += eff.value;
      } else if (eff.type === 'resist' && eff.damageType !== undefined && eff.value !== undefined) {
        resistances[eff.damageType] = Math.min(0.75, (resistances[eff.damageType] ?? 0) + eff.value);
      }
      // Apply resistAll field for multi-element resistances
      if (enchDef.resistAll !== undefined && eff.value !== undefined) {
        for (const dt of enchDef.resistAll) {
          resistances[dt] = Math.min(0.75, (resistances[dt] ?? 0) + eff.value);
        }
      }
    }
  }

  const result: PlayerStats = {
    maxHealth: baseStats.maxHealth,
    health: currentHealth,
    attack,
    defense,
    accuracy,
    evasion,
    speed,
  };

  if (Object.keys(resistances).length > 0) {
    return { ...result, resistances: resistances as Partial<Record<DamageType, number>> };
  }
  return result;
}

/**
 * Unlock blueprint IDs in world state (deduplicated, immutable).
 */
function unlockBlueprints(
  state: GameState,
  blueprintIds: readonly string[],
): { state: GameState; events: DomainEvent[] } {
  const existing = new Set(state.world.unlockedBlueprints);
  const newIds = blueprintIds.filter(id => !existing.has(id));
  if (newIds.length === 0) return { state, events: [] };

  const newState: GameState = {
    ...state,
    world: {
      ...state.world,
      unlockedBlueprints: [...state.world.unlockedBlueprints, ...newIds],
    },
  };

  const events: DomainEvent[] = [{
    type: 'BLUEPRINT_UNLOCKED',
    playerId: state.player.id,
    blueprintIds: newIds,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  }];

  return { state: newState, events };
}

export function equipItem(
  state: GameState,
  itemId: EntityId,
): { state: GameState; events: DomainEvent[] } {
  const template = state.itemRegistry.items.get(itemId);
  if (template === undefined) return { state, events: [] };

  let newEquipment = { ...state.player.equipment };
  let events: DomainEvent[] = [];
  let updatedInventory = state.player.inventory.filter(id => id !== itemId); // Remove item from inventory

  if (template.itemClass === 'weapon') {
    // FIFO Weapon Policy: Similar to rings, weapons use a simple FIFO queue for dual-wield.
    // Slots: 'weapon' (primary/active) and 'secondaryWeapon' (off-hand/backup).
    //
    // WHY FIFO?
    // - Weapon stat calculations always use the primary weapon for damage, accuracy, speed.
    // - The swap command toggles primary ↔ secondary, so FIFO ensures predictable swapping.
    // - Player expectations: first weapon equipped should be primary, second becomes backup.
    //
    // BEHAVIOR:
    // - Empty primary? Equip to primary.
    // - primary full, empty secondary? Equip to secondary.
    // - Both full? Replace primary, return old primary to inventory.
    //
    // Example: Equip sword A, then axe B, then mace C:
    // 1. A → weapon (empty)
    // 2. B → secondaryWeapon (empty)
    // 3. C → weapon (both full, so A is bumped)
    //
    const oldPrimary = newEquipment.weapon;
    if (oldPrimary === null) {
      // Primary empty: fill primary
      newEquipment = { ...newEquipment, weapon: itemId };
    } else if (newEquipment.secondaryWeapon === null) {
      // Primary full, secondary empty: fill secondary
      newEquipment = { ...newEquipment, secondaryWeapon: itemId };
    } else {
      // Both full: replace primary, move old primary to inventory
      newEquipment = { ...newEquipment, weapon: itemId };
      updatedInventory = [...updatedInventory, oldPrimary];
    }
  } else if (template.itemClass === 'armor') {
    const armor = (template as ArmorTemplate).armor;
    if (armor.slot === 'ring') {
      // FIFO Ring Policy: Implement a simple first-in-first-out queue for rings.
      // Ring slots have a strict ordering: ring1 is the "oldest" (first equipped),
      // ring2 is the "newest" (second equipped).
      //
      // WHY FIFO?
      // - Rings provide small bonuses, so we want predictable behavior when at capacity.
      // - Player expectations: if I equip 3 rings, the oldest should leave, not a random one.
      // - Simplicity: no need for priority scoring or complex swap logic.
      //
      // BEHAVIOR:
      // - Empty ring1? Equip to ring1 (first slot).
      // - ring1 full, empty ring2? Equip to ring2 (second slot).
      // - Both full? Replace ring1 (oldest), return ring1 to inventory.
      //
      // Example: Equip ring A, then B, then C:
      // 1. A → ring1 (empty)
      // 2. B → ring2 (empty)
      // 3. C → ring1 (both full, so A is bumped)
      //
      if (newEquipment.ring1 === null) {
        newEquipment = { ...newEquipment, ring1: itemId };
      } else if (newEquipment.ring2 === null) {
        newEquipment = { ...newEquipment, ring2: itemId };
      } else {
        // Both full: replace ring1 and return old ring1 to inventory
        const oldRing1 = newEquipment.ring1;
        newEquipment = { ...newEquipment, ring1: itemId };
        updatedInventory = [...updatedInventory, oldRing1];
      }
    } else {
      // Route to named slot: chest / head / gloves / boots
      // Check if slot is already occupied and return the old item to inventory
      const slotKey = armor.slot as keyof Equipment;
      const oldItem = newEquipment[slotKey];
      if (oldItem !== null) {
        updatedInventory = [...updatedInventory, oldItem];
      }
      newEquipment = { ...newEquipment, [armor.slot]: itemId };
    }

    // Unlock blueprints if pre-enchanted
    const enchIds = armor.enchantments.filter((e): e is string => e !== null);
    if (enchIds.length > 0) {
      const allBlueprints = enchIds.flatMap(id => getImpliedBlueprints(id));
      const blueprintResult = unlockBlueprints({ ...state, player: { ...state.player, equipment: newEquipment } }, allBlueprints);
      const updatedState = blueprintResult.state;
      events = [...events, ...blueprintResult.events];

      const newPlayer = { ...withRecalculatedStats(updatedState, newEquipment), inventory: updatedInventory };
      return {
        state: { ...updatedState, player: newPlayer },
        events,
      };
    }
  }

  const newPlayer = { ...withRecalculatedStats(state, newEquipment), inventory: updatedInventory };

  return {
    state: { ...state, player: newPlayer },
    events,
  };
}

/**
 * Unequip an item from equipment and return it to inventory.
 * Recalculates stats after unequipping.
 */
export function unequipItem(
  state: GameState,
  itemId: EntityId,
): { state: GameState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const slot = findEquipmentSlot(state.player.equipment, itemId);

  // If item wasn't equipped, just return as-is
  if (slot === null) {
    return { state, events };
  }

  const newEquipment = { ...state.player.equipment, [slot]: null };
  const updatedInventory = [...state.player.inventory, itemId]; // Add item back to inventory
  const newPlayer = { ...withRecalculatedStats(state, newEquipment), inventory: updatedInventory };

  return {
    state: { ...state, player: newPlayer },
    events,
  };
}

/**
 * Swap primary and secondary weapon sets.
 * Recalculates stats based on the new primary weapon.
 */
export function swapWeaponSets(
  state: GameState,
): { state: GameState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const newEquipment = {
    ...state.player.equipment,
    weapon: state.player.equipment.secondaryWeapon,
    secondaryWeapon: state.player.equipment.weapon,
  };

  const newPlayer = withRecalculatedStats(state, newEquipment);

  return {
    state: { ...state, player: newPlayer },
    events,
  };
}
