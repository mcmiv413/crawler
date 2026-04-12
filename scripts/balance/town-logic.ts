/**
 * town-logic.ts — Smart town-phase decision-making (shopping, enchanting, equipment)
 */

import type { GameCommand } from '@dungeon/contracts';
import type { GameView, InventoryItemView, AvailableAction } from '@dungeon/presenter';
import { actionToCommand } from './simulation.js';

const GOLD_RESERVE = 10; // Never spend below this

/**
 * Try to buy the best item from the shop given the current view.
 * Returns a TOWN_ACTION command or null if nothing worth buying.
 */
export function tryShopBuy(view: GameView): GameCommand | null {
  if (!view.town?.shop) return null;
  const shopItems = view.town.shop.items;
  const gold = view.player.gold;
  const inv = view.inventory;

  const canAfford = (price: number) => gold - price >= GOLD_RESERVE;

  // Helpers to check equipped slots
  const hasWeapon = inv.equipped.weapon !== null;
  const hasChest = inv.equipped.chest !== null;
  const hasHead = inv.equipped.head !== null;

  // Count potions in inventory
  const potionCount = inv.items.filter(i =>
    i.itemClass === 'consumable' &&
    (i.name.toLowerCase().includes('health potion') || i.name.toLowerCase().includes('potion of health')),
  ).length;
  const hasElixir = inv.items.some(i =>
    i.itemClass === 'consumable' && i.name.toLowerCase().includes('elixir'),
  );

  // Priority 1: weapon if none equipped (prefer blade for mastery focus)
  if (!hasWeapon) {
    const weapons = shopItems.filter(si => {
      return si.name.toLowerCase().includes('sword') ||
        si.name.toLowerCase().includes('dagger') ||
        si.name.toLowerCase().includes('blade') ||
        si.name.toLowerCase().includes('rapier');
    });
    // If no blade, accept any weapon
    const anyWeapons = shopItems.filter(si =>
      si.name.toLowerCase().includes('sword') ||
      si.name.toLowerCase().includes('dagger') ||
      si.name.toLowerCase().includes('mace') ||
      si.name.toLowerCase().includes('axe') ||
      si.name.toLowerCase().includes('bow') ||
      si.name.toLowerCase().includes('staff') ||
      si.name.toLowerCase().includes('blade') ||
      si.name.toLowerCase().includes('club'),
    );
    const candidates = weapons.length > 0 ? weapons : anyWeapons;
    const affordable = candidates.filter(si => canAfford(si.effectivePrice));
    if (affordable.length > 0) {
      const cheapest = affordable.reduce((a, b) => a.effectivePrice < b.effectivePrice ? a : b);
      return { type: 'TOWN_ACTION', action: 'shop_buy', itemId: cheapest.itemId };
    }
  }

  // Priority 2: chest armor if none
  if (!hasChest) {
    const chestArmor = shopItems.filter(si =>
      si.name.toLowerCase().includes('chest') ||
      si.name.toLowerCase().includes('mail') ||
      si.name.toLowerCase().includes('plate') ||
      si.name.toLowerCase().includes('leather armor') ||
      si.name.toLowerCase().includes('robe'),
    );
    const affordable = chestArmor.filter(si => canAfford(si.effectivePrice));
    if (affordable.length > 0) {
      const cheapest = affordable.reduce((a, b) => a.effectivePrice < b.effectivePrice ? a : b);
      return { type: 'TOWN_ACTION', action: 'shop_buy', itemId: cheapest.itemId };
    }
  }

  // Priority 3: head armor if none
  if (!hasHead) {
    const headArmor = shopItems.filter(si =>
      si.name.toLowerCase().includes('cap') ||
      si.name.toLowerCase().includes('helm') ||
      si.name.toLowerCase().includes('hood') ||
      si.name.toLowerCase().includes('hat'),
    );
    const affordable = headArmor.filter(si => canAfford(si.effectivePrice));
    if (affordable.length > 0) {
      const cheapest = affordable.reduce((a, b) => a.effectivePrice < b.effectivePrice ? a : b);
      return { type: 'TOWN_ACTION', action: 'shop_buy', itemId: cheapest.itemId };
    }
  }

  // Priority 4: health potions (up to 4 — real players carry more healing)
  if (potionCount < 4) {
    const potions = shopItems.filter(si =>
      si.name.toLowerCase().includes('health potion') ||
      si.name.toLowerCase().includes('potion of health'),
    );
    const affordable = potions.filter(si => canAfford(si.effectivePrice));
    if (affordable.length > 0) {
      const cheapest = affordable.reduce((a, b) => a.effectivePrice < b.effectivePrice ? a : b);
      return { type: 'TOWN_ACTION', action: 'shop_buy', itemId: cheapest.itemId };
    }
  }

  // Priority 5: strength elixir (1 if none)
  if (!hasElixir) {
    const elixirs = shopItems.filter(si =>
      si.name.toLowerCase().includes('strength') ||
      si.name.toLowerCase().includes('elixir'),
    );
    const affordable = elixirs.filter(si => canAfford(si.effectivePrice));
    if (affordable.length > 0) {
      const cheapest = affordable.reduce((a, b) => a.effectivePrice < b.effectivePrice ? a : b);
      return { type: 'TOWN_ACTION', action: 'shop_buy', itemId: cheapest.itemId };
    }
  }

  return null;
}

/**
 * Try to enchant armor in town phase.
 * Preference order: hp_regen > defense_boost > thorns > speed_boost
 */
export function tryEnchant(view: GameView): GameCommand | null {
  const inv = view.inventory;
  const GOLD_RESERVE_ENCHANT = 20; // keep a small buffer
  const gold = view.player.gold;
  const unlockedBlueprints = view.town?.unlockedBlueprints ?? [];

  // Enchantment preference order (by ID)
  const preferredEnchants = ['hp_regen', 'defense_boost', 'thorns', 'speed_boost'];

  // Collect all equipped armor slots with empty enchantment slots
  const armorWithEmptySlots: Array<{ slot: 'head' | 'chest'; maxSlots: number; filledSlots: number }> = [];

  if (inv.equipped.head) {
    const maxSlots = inv.equipped.head.enchantmentSlots ?? 0;
    const filledSlots = (inv.equipped.head.enchantments ?? []).length;
    if (maxSlots > filledSlots) {
      armorWithEmptySlots.push({ slot: 'head', maxSlots, filledSlots });
    }
  }

  if (inv.equipped.chest) {
    const maxSlots = inv.equipped.chest.enchantmentSlots ?? 0;
    const filledSlots = (inv.equipped.chest.enchantments ?? []).length;
    if (maxSlots > filledSlots) {
      armorWithEmptySlots.push({ slot: 'chest', maxSlots, filledSlots });
    }
  }

  if (armorWithEmptySlots.length === 0) return null;

  // Find affordable, unlocked enchantments in preferred order
  for (const enchantId of preferredEnchants) {
    if (!unlockedBlueprints.includes(enchantId)) continue;

    // Get cost of this enchantment
    const cost = { hp_regen: 40, defense_boost: 100, thorns: 40, speed_boost: 100 }[enchantId] ?? 0;
    if (cost === 0 || gold - cost < GOLD_RESERVE_ENCHANT) continue;

    // Pick the first armor slot with an empty slot
    const targetArmor = armorWithEmptySlots[0]!;
    return {
      type: 'ENCHANT_ARMOR',
      equipSlot: targetArmor.slot,
      enchantmentId: enchantId,
    } as GameCommand;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Smart equipment scoring
// ---------------------------------------------------------------------------

export function scoreWeapon(item: InventoryItemView): number {
  if (!item.weaponStats) return 0;
  return item.weaponStats.damage + (item.weaponStats.accuracy / 10) + (item.weaponStats.speed / 10);
}

export function scoreArmor(item: InventoryItemView): number {
  if (!item.armorStats) return 0;
  return item.armorStats.defense - (item.armorStats.evasionPenalty / 2);
}

/**
 * Returns the best equip command from currently unequipped items, or null if nothing is an upgrade.
 * masteryHits: total hits for primary weapon type; committedType: weapon type if committed (10+ hits).
 */
export function trySmartEquip(
  view: GameView,
  masteryHits: number,
  committedType: string | null,
): GameCommand | null {
  const inv = view.inventory;

  // Check unequipped weapons for upgrade
  const unequippedWeapons = inv.items.filter(item =>
    item.itemClass === 'weapon' && !item.isEquipped,
  );

  if (unequippedWeapons.length > 0) {
    const currentWeapon = inv.equipped.weapon;
    for (const item of unequippedWeapons) {
      const newScore = scoreWeapon(item);
      if (!currentWeapon) {
        // No weapon equipped, equip first available
        return { type: 'EQUIP', itemId: item.id };
      }
      const currentScore = scoreWeapon(currentWeapon);
      // Mastery penalty: if committed to a type and switching, penalize new weapon
      const newType = item.weaponStats?.damageType;
      const penalty = committedType && masteryHits >= 10 && newType !== committedType ? 3 : 0;
      if (newScore > currentScore + penalty) {
        return { type: 'EQUIP', itemId: item.id };
      }
    }
  }

  // Check unequipped armor for upgrades
  const unequippedArmor = inv.items.filter(item =>
    item.itemClass === 'armor' && !item.isEquipped && item.armorStats,
  );

  for (const item of unequippedArmor) {
    const slot = item.armorStats!.slot as 'chest' | 'head' | 'gloves' | 'boots' | 'ring';
    const currentSlotItem = slot === 'chest' ? inv.equipped.chest
      : slot === 'head' ? inv.equipped.head
      : slot === 'gloves' ? inv.equipped.gloves
      : slot === 'boots' ? inv.equipped.boots
      : null; // rings handled separately
    if (!currentSlotItem) {
      // Slot is empty, equip it
      return { type: 'EQUIP', itemId: item.id };
    }
    if (scoreArmor(item) > scoreArmor(currentSlotItem)) {
      return { type: 'EQUIP', itemId: item.id };
    }
  }

  return null;
}

/**
 * Try to sell inferior unequipped items to free up inventory space.
 * Returns the first junk item found, or null if nothing to sell.
 */
export function trySellJunk(view: GameView): GameCommand | null {
  if (!view.town?.shop) return null;
  const inv = view.inventory;

  // Sell inferior unequipped weapons (worse than what's equipped)
  const equippedWeapon = inv.equipped.weapon;
  for (const item of inv.items) {
    if (item.itemClass !== 'weapon' || item.isEquipped) continue;
    if (equippedWeapon && scoreWeapon(item) < scoreWeapon(equippedWeapon)) {
      return { type: 'TOWN_ACTION', action: 'shop_sell', targetId: item.id };
    }
  }

  // Sell inferior unequipped armor (worse than or equal to equipped slot)
  for (const item of inv.items) {
    if (item.itemClass !== 'armor' || item.isEquipped || !item.armorStats) continue;
    const slot = item.armorStats.slot as 'chest' | 'head' | 'gloves' | 'boots' | 'ring';
    const equippedInSlot = slot === 'chest' ? inv.equipped.chest
      : slot === 'head' ? inv.equipped.head
      : slot === 'gloves' ? inv.equipped.gloves
      : slot === 'boots' ? inv.equipped.boots
      : null;
    if (equippedInSlot && scoreArmor(item) <= scoreArmor(equippedInSlot)) {
      return { type: 'TOWN_ACTION', action: 'shop_sell', targetId: item.id };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Smart consumable usage
// ---------------------------------------------------------------------------

export function trySmartConsumable(view: GameView, inDungeon: boolean): GameCommand | null {
  if (!inDungeon) return null;
  const enabled = view.availableActions.filter(a => a.enabled && a.id.startsWith('use_') && !a.id.startsWith('use_ability_') && a.targetId);
  if (enabled.length === 0) return null;

  const hp = view.player.health;
  const maxHp = view.player.maxHealth;
  const hpPct = hp / maxHp;
  const hasEnemiesVisible = view.availableActions.some(a => a.type === 'attack' && a.enabled);
  const isPoisoned = view.player.statuses.some(s => s.id === 'poisoned' || s.name.toLowerCase().includes('poison'));
  const isBurning = view.player.statuses.some(s => s.name.toLowerCase().includes('burn'));
  const hasStrengthBuff = view.player.statuses.some(s => s.beneficial && (s.name.toLowerCase().includes('strength') || s.name.toLowerCase().includes('attack')));

  const inv = view.inventory;

  const findItem = (pred: (i: InventoryItemView) => boolean) =>
    enabled.find(a => {
      const item = inv.items.find(i => i.id === a.targetId);
      return item && pred(item);
    });

  const useItem = (action: AvailableAction | undefined): GameCommand | null =>
    action ? actionToCommand(action) : null;

  const isAntidote = (i: InventoryItemView) =>
    i.name.toLowerCase().includes('antidote') || i.name.toLowerCase().includes('cure');
  const isElixir = (i: InventoryItemView) =>
    i.name.toLowerCase().includes('strength') || i.name.toLowerCase().includes('elixir');
  const isBomb = (i: InventoryItemView) =>
    i.name.toLowerCase().includes('bomb') || i.name.toLowerCase().includes('grenade');
  const isGreaterPotion = (i: InventoryItemView) =>
    i.name.toLowerCase().includes('greater') && i.name.toLowerCase().includes('health');
  const isHealthPotion = (i: InventoryItemView) =>
    i.name.toLowerCase().includes('health') && i.itemClass === 'consumable' && !isGreaterPotion(i);

  // 1. Antidote only if poisoned AND low HP (poison is a real threat)
  if (isPoisoned && hpPct < 0.5) {
    const antidote = findItem(isAntidote);
    if (antidote) return useItem(antidote);
  }

  // 1.5. Potion urgently if burning (burning damage stacks) — use below 50% HP
  if (isBurning && hpPct < 0.5) {
    const greater = findItem(isGreaterPotion);
    if (greater) return useItem(greater);
    const potion = findItem(isHealthPotion);
    if (potion) return useItem(potion);
  }

  // 2. Bomb offensively if 2+ enemies visible (AoE is rare and valuable)
  if (hasEnemiesVisible) {
    const visibleEnemyCount = view.map?.entities?.filter(e => e.type === 'enemy').length ?? 0;
    if (visibleEnemyCount >= 2) {
      const bomb = findItem(isBomb);
      if (bomb) return useItem(bomb);
    }
  }

  // 3. Strength elixir only on harder floors (floor >= 3) or if 2+ enemies visible
  const currentFloor = view.player.floor ?? 1;
  if (hasEnemiesVisible && !hasStrengthBuff && (currentFloor >= 3 || (view.map?.entities?.filter(e => e.type === 'enemy').length ?? 0) >= 2)) {
    const elixir = findItem(isElixir);
    if (elixir) return useItem(elixir);
  }

  // 4. Greater Health Potion at < 20% HP
  if (hpPct < 0.2) {
    const greater = findItem(isGreaterPotion);
    if (greater) return useItem(greater);
  }

  // 5. Health potion at < 30% HP (more conservative than before)
  if (hpPct < 0.3) {
    const potion = findItem(isHealthPotion);
    if (potion) return useItem(potion);
  }

  // 6. Bomb as fallback if 1 enemy visible and HP < 40%
  if (hasEnemiesVisible && hpPct < 0.4) {
    const bomb = findItem(isBomb);
    if (bomb) return useItem(bomb);
  }

  return null;
}
