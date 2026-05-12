import type { ItemClass, ItemRarity, DamageType, StatusId, WeaponType, ArmorSlot } from './common.js';

export interface ItemTemplate {
  readonly itemId: string;
  readonly name: string;
  readonly description: string;
  readonly itemClass: ItemClass;
  readonly rarity: ItemRarity;
  readonly value: number;
  readonly stackable: boolean;
  readonly maxStack: number;
  readonly spriteName?: string;
}

export interface WeaponData {
  readonly damage: number;
  readonly damageType: DamageType;
  readonly accuracy: number;
  readonly speed: number;
  readonly slot: 'weapon';
  readonly weaponRange: number;  // 1 = melee, >1 = ranged
  readonly minRange?: number;    // D1: minimum range for ranged weapons (e.g., 2 for bows)
  readonly weaponType: WeaponType;
  readonly onHitStatus?: StatusId;
  readonly onHitChance?: number;
}

export interface EnchantmentEffect {
  readonly type: 'stat_bonus' | 'regen' | 'thorns' | 'resist' | 'exp_bonus' | 'life_steal' | 'blink' | 'grant_ability';
  readonly stat?: 'defense' | 'evasion' | 'speed';
  readonly value?: number;
  readonly damageType?: DamageType;
  readonly abilityId?: string;
}

export interface EnchantmentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: 1 | 2 | 3 | 'unique';
  readonly effect: EnchantmentEffect;
  readonly resistAll?: readonly DamageType[];
}

export interface ArmorData {
  readonly defense: number;
  readonly evasionPenalty: number;
  readonly slot: ArmorSlot;
  readonly enchantmentSlots: number;
  readonly enchantments: readonly (string | null)[];
  readonly resistance?: Partial<Record<DamageType, number>>;
}

export interface ConsumableData {
  readonly effect: 'heal' | 'cure' | 'buff' | 'damage' | 'mana';
  readonly magnitude: number;
  readonly duration?: number;
  readonly targetStatus?: StatusId;
}

export interface WeaponTemplate extends ItemTemplate {
  readonly itemClass: 'weapon';
  readonly weapon: WeaponData;
}

export interface ArmorTemplate extends ItemTemplate {
  readonly itemClass: 'armor';
  readonly armor: ArmorData;
}

export interface ConsumableTemplate extends ItemTemplate {
  readonly itemClass: 'consumable';
  readonly consumable: ConsumableData;
}

export interface TrapItemTemplate extends ItemTemplate {
  readonly itemClass: 'trap';
  readonly trapTemplateId: string;
}

export type AnyItemTemplate = WeaponTemplate | ArmorTemplate | ConsumableTemplate | TrapItemTemplate | ItemTemplate;
