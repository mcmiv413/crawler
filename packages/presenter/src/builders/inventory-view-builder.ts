import type { GameState, EntityId, WeaponTemplate, ArmorTemplate } from '@dungeon/contracts';
import { getRarityColor, getDamageBand, getWeaponDamageProfile } from '@dungeon/content';
import type { InventoryView, InventoryItemView } from '../game-view.js';

export function buildInventoryView(state: GameState): InventoryView {
  const buybackMultiplier = state.world.shop.buybackMultiplier;
  const eq = state.player.equipment;
  const equippedIds = new Set(
    [eq.weapon, eq.secondaryWeapon, eq.chest, eq.head, eq.gloves, eq.boots, eq.ring1, eq.ring2].filter(Boolean) as EntityId[],
  );

  const toView = (itemId: EntityId, isEquipped: boolean): InventoryItemView | null => {
    const template = state.itemRegistry.items.get(itemId);
    if (!template) return null;

    // C5: Distinguish primary from secondary weapon in name/description
    let name = template.name;
    let description = template.description;
    if (isEquipped && itemId === eq.secondaryWeapon && template.itemClass === 'weapon') {
      name = `${template.name} (Off-hand)`;
    }

    return {
      id: itemId,
      name,
      description,
      itemClass: template.itemClass,
      rarity: template.rarity,
      rarityColor: getRarityColor(template.rarity),
      value: template.value,
      sellPrice: Math.floor(template.value * buybackMultiplier),
      isEquipped,
      quantity: 1,
      stackEntityIds: [itemId],
      templateId: template.itemId,
      spriteName: template.spriteName,
      weaponStats: template.itemClass === 'weapon'
        ? (() => {
          const weapon = (template as WeaponTemplate).weapon;
          const profile = getWeaponDamageProfile(weapon.weaponType, weapon.weaponRange);
          const { min, max } = getDamageBand(weapon.damage, profile);
          return { damage: weapon.damage, damageMin: min, damageMax: max, damageType: weapon.damageType, accuracy: weapon.accuracy, speed: weapon.speed, weaponRange: weapon.weaponRange, minRange: weapon.minRange };
        })()
        : undefined,
      armorStats: template.itemClass === 'armor'
        ? { defense: (template as ArmorTemplate).armor.defense, evasionPenalty: (template as ArmorTemplate).armor.evasionPenalty, slot: (template as ArmorTemplate).armor.slot, enchantmentSlots: (template as ArmorTemplate).armor.enchantmentSlots, enchantments: (template as ArmorTemplate).armor.enchantments }
        : undefined,
    };
  };

  // Build individual views: items from inventory (checking if equipped) + equipped items not in inventory
  // Note: equipItem removes items from player.inventory, so inventory items are typically unequipped.
  // However, we check equippedIds for compatibility with states where items exist in both places.
  const inventoryItems = state.player.inventory
    .map(id => toView(id, equippedIds.has(id)))
    .filter((v): v is InventoryItemView => v !== null);

  // Equipped items that are NOT in inventory (because equipItem removed them)
  // These are the typical case in real gameplay
  const equippedOnlyItems = [...equippedIds]
    .filter(id => !state.player.inventory.includes(id))
    .map(id => toView(id, true))
    .filter((v): v is InventoryItemView => v !== null);

  const rawItems = [...equippedOnlyItems, ...inventoryItems];

  // Group stackable, unequipped items by templateId
  const stackGroups = new Map<string, InventoryItemView[]>();
  let unstakedItems: InventoryItemView[] = [];

  for (const item of rawItems) {
    const template = state.itemRegistry.items.get(item.id as EntityId);
    if (!item.isEquipped && template && 'stackable' in template && template.stackable) {
      const group = stackGroups.get(item.templateId);
      if (group) {
        stackGroups.set(item.templateId, [...group, item]);
      } else {
        stackGroups.set(item.templateId, [item]);
      }
    } else {
      unstakedItems = [...unstakedItems, item];
    }
  }

  // Merge each stack group into a single entry
  const stackedGroupItems = Array.from(stackGroups.values()).map(group => {
    const first = group[0]!;
    return {
      ...first,
      quantity: group.length,
      stackEntityIds: group.map(g => g.id),
    };
  });

  const stacked = [...stackedGroupItems, ...unstakedItems];

  // Sort: equipped first, preserve relative order within groups
  // mutableSorted exists to separate the mutation from the pure function logic
  // (the rule requires renaming variables with mutable operations to 'mutable' prefix)
  const mutableSorted = stacked.slice();
  mutableSorted.sort((a, b) => (b.isEquipped ? 1 : 0) - (a.isEquipped ? 1 : 0));
  const sorted = mutableSorted;

  const toEquipView = (id: EntityId | null) => id ? toView(id, true) : null;

  return {
    items: sorted,
    equipped: {
      weapon: toEquipView(eq.weapon),
      chest: toEquipView(eq.chest),
      head: toEquipView(eq.head),
      gloves: toEquipView(eq.gloves),
      boots: toEquipView(eq.boots),
      ring1: toEquipView(eq.ring1),
      ring2: toEquipView(eq.ring2),
      secondaryWeapon: toEquipView(eq.secondaryWeapon),
    },
  };
}
