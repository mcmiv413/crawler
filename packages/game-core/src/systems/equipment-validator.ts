import type { GameState, EntityId } from '@dungeon/contracts';
import type { ArmorTemplate } from '@dungeon/contracts';

export type EquipmentValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly rejectionCode: string;
      readonly message: string;
    };

/**
 * Central hub for equipment action validation.
 *
 * Validates complete equipment actions including:
 * 1. Item exists in player's inventory
 * 2. Item is equippable (not a consumable, trap, or other non-equippable type)
 * 3. Item class compatibility with slot constraints
 *
 * Rejection codes:
 * - ITEM_NOT_FOUND: Item doesn't exist or is not in player's inventory
 * - ITEM_NOT_EQUIPPABLE: Item type cannot be equipped (consumable, trap, etc.)
 * - EQUIPMENT_INCOMPATIBLE: Item class doesn't match equipment slot constraints
 * - ITEM_NOT_IN_INVENTORY: Player doesn't have the item to equip
 */
export function validateEquipmentAction(
  state: GameState,
  itemId: EntityId,
): EquipmentValidationResult {
  // 1. Check item exists in registry
  const template = state.itemRegistry.items.get(itemId);
  if (template === undefined) {
    return {
      valid: false,
      rejectionCode: 'ITEM_NOT_FOUND',
      message: `Item "${itemId}" not found in game content.`,
    };
  }

  // 2. Check item is equippable (not consumable, trap, or base ItemTemplate without class)
  if (template.itemClass !== 'weapon' && template.itemClass !== 'armor') {
    return {
      valid: false,
      rejectionCode: 'ITEM_NOT_EQUIPPABLE',
      message: `Item "${template.name}" cannot be equipped.`,
    };
  }

  // 3. Check player has the item in inventory
  const hasItem = state.player.inventory.some(id => id === itemId);
  if (hasItem === false) {
    return {
      valid: false,
      rejectionCode: 'ITEM_NOT_IN_INVENTORY',
      message: `You do not have "${template.name}" in your inventory.`,
    };
  }

  // 4. Check item class compatibility with slot constraints
  if (template.itemClass === 'armor') {
    const armor = (template as ArmorTemplate).armor;

    // Validate slot assignment exists
    if (isValidArmorSlot(armor.slot) === false) {
      return {
        valid: false,
        rejectionCode: 'EQUIPMENT_INCOMPATIBLE',
        message: `Armor slot "${armor.slot}" is not valid.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Helper to validate armor slot names against known equipment slots.
 */
function isValidArmorSlot(slot: string): boolean {
  const validSlots = new Set(['chest', 'head', 'gloves', 'boots', 'ring']);
  return validSlots.has(slot);
}
