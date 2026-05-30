import type {
  AnyItemTemplate,
  ArmorTemplate,
  GameState,
  WeaponTemplate,
  WeaponType,
} from '@dungeon/contracts';
import { ENCHANTMENT_BY_ID, getRarityColor } from '@dungeon/content';
import type { EnchantmentView, EquippedItemView } from '../game-view.js';

const ARMOR_SLOTS = [
  'chest',
  'head',
  'gloves',
  'boots',
  'ring1',
  'ring2',
] as const satisfies readonly (keyof GameState['player']['equipment'])[];

function isWeaponTemplate(
  item: AnyItemTemplate | null | undefined,
): item is WeaponTemplate {
  return item?.itemClass === 'weapon' && 'weapon' in item;
}

function isArmorTemplate(
  item: AnyItemTemplate | null | undefined,
): item is ArmorTemplate {
  return item?.itemClass === 'armor' && 'armor' in item;
}

function buildEnchantmentViews(armor: ArmorTemplate): EnchantmentView[] {
  return (armor.armor.enchantments ?? [])
    .map(enchantmentId => {
      if (!enchantmentId) {
        return null;
      }

      const definition = ENCHANTMENT_BY_ID.get(enchantmentId);
      return definition
        ? ({
            id: enchantmentId,
            name: definition.name,
            description: definition.description,
            tier: definition.tier,
          } satisfies EnchantmentView)
        : null;
    })
    .filter((enchantment): enchantment is EnchantmentView => enchantment !== null);
}

export function getEquippedWeaponType(state: GameState): WeaponType | null {
  const weaponId = state.player.equipment.weapon;
  if (weaponId === null) {
    return null;
  }

  const weaponItem = state.itemRegistry.items.get(weaponId);
  return isWeaponTemplate(weaponItem) ? weaponItem.weapon.weaponType : null;
}

export function buildEquippedItems(state: GameState): EquippedItemView[] {
  const { equipment } = state.player;
  const mutableEquippedItems: EquippedItemView[] = [];

  if (equipment.weapon !== null) {
    const weapon = state.itemRegistry.items.get(equipment.weapon);
    if (isWeaponTemplate(weapon)) {
      mutableEquippedItems.push({
        slot: 'weapon',
        itemId: equipment.weapon as string,
        name: weapon.name,
        rarity: weapon.rarity,
        rarityColor: getRarityColor(weapon.rarity),
        baseBonus: weapon.weapon.damage,
        enchantments: [],
        spriteName: weapon.spriteName,
      });
    }
  }

  for (const slot of ARMOR_SLOTS) {
    const itemId = equipment[slot];
    if (itemId === null) {
      continue;
    }

    const armor = state.itemRegistry.items.get(itemId);
    if (!isArmorTemplate(armor)) {
      continue;
    }

    mutableEquippedItems.push({
      slot,
      itemId: itemId as string,
      name: armor.name,
      rarity: armor.rarity,
      rarityColor: getRarityColor(armor.rarity),
      baseBonus: armor.armor.defense,
      enchantments: buildEnchantmentViews(armor),
      spriteName: armor.spriteName,
    });
  }

  return mutableEquippedItems;
}
