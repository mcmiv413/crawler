export type EquipSlotRuleName =
  | 'weapon'
  | 'secondaryWeapon'
  | 'chest'
  | 'head'
  | 'gloves'
  | 'boots'
  | 'ring1'
  | 'ring2';

export type EquipSlotRule =
  | {
      readonly slot: EquipSlotRuleName;
      readonly itemClass: 'weapon';
    }
  | {
      readonly slot: EquipSlotRuleName;
      readonly itemClass: 'armor';
      readonly armorSlot: 'chest' | 'head' | 'gloves' | 'boots' | 'ring';
    };

export const EQUIP_SLOT_RULES = [
  { slot: 'weapon', itemClass: 'weapon' },
  { slot: 'secondaryWeapon', itemClass: 'weapon' },
  { slot: 'chest', itemClass: 'armor', armorSlot: 'chest' },
  { slot: 'head', itemClass: 'armor', armorSlot: 'head' },
  { slot: 'gloves', itemClass: 'armor', armorSlot: 'gloves' },
  { slot: 'boots', itemClass: 'armor', armorSlot: 'boots' },
  { slot: 'ring1', itemClass: 'armor', armorSlot: 'ring' },
  { slot: 'ring2', itemClass: 'armor', armorSlot: 'ring' },
] as const satisfies readonly EquipSlotRule[];

const EQUIP_SLOT_RULE_BY_SLOT = new Map<string, EquipSlotRule>(
  EQUIP_SLOT_RULES.map(rule => [rule.slot, rule]),
);

export function getEquipSlotRule(slot: string): EquipSlotRule | undefined {
  return EQUIP_SLOT_RULE_BY_SLOT.get(slot);
}
