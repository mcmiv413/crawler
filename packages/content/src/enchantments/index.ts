import type { EnchantmentDefinition } from '@dungeon/contracts';

const ENCHANTMENTS: readonly EnchantmentDefinition[] = [
  // T1
  { id: 'hp_regen', name: 'HP Regeneration', description: '+2 HP per turn', tier: 1,
    effect: { type: 'regen', value: 2 } },
  { id: 'thorns', name: 'Thorns', description: 'Reflects 3 damage to attacker', tier: 1,
    effect: { type: 'thorns', value: 3 } },
  { id: 'resist_fire', name: 'Fire Resistance', description: '30% fire damage reduction', tier: 1,
    effect: { type: 'resist', damageType: 'fire', value: 0.3 } },
  { id: 'resist_frost', name: 'Frost Resistance', description: '30% frost damage reduction', tier: 1,
    effect: { type: 'resist', damageType: 'frost', value: 0.3 } },
  { id: 'resist_poison', name: 'Poison Resistance', description: '30% poison damage reduction', tier: 1,
    effect: { type: 'resist', damageType: 'poison', value: 0.3 } },
  // T2
  { id: 'evasion_boost', name: 'Evasion Boost', description: '+10 evasion', tier: 2,
    effect: { type: 'stat_bonus', stat: 'evasion', value: 10 } },
  { id: 'defense_boost', name: 'Defense Boost', description: '+5 defense', tier: 2,
    effect: { type: 'stat_bonus', stat: 'defense', value: 5 } },
  { id: 'blight_ward', name: 'Blight Ward', description: '50% poison/corruption reduction', tier: 2,
    effect: { type: 'resist', value: 0.5 }, resistAll: ['poison', 'corruption'] as const },
  { id: 'spikes', name: 'Spikes', description: 'Reflects 6 damage to attacker', tier: 2,
    effect: { type: 'thorns', value: 6 } },
  { id: 'speed_boost', name: 'Speed Boost', description: '+15 speed', tier: 2,
    effect: { type: 'stat_bonus', stat: 'speed', value: 15 } },
  // T3
  { id: 'exp_bonus', name: 'Experience Bonus', description: '+25% XP gain', tier: 3,
    effect: { type: 'exp_bonus', value: 0.25 } },
  { id: 'life_steal', name: 'Life Steal', description: '+2 HP on kill', tier: 3,
    effect: { type: 'life_steal', value: 2 } },
  { id: 'arcane_ward', name: 'Arcane Ward', description: '40% fire/shock/frost resistance', tier: 3,
    effect: { type: 'resist', value: 0.4 }, resistAll: ['fire', 'shock', 'frost'] as const },
  // Unique
  { id: 'blink', name: 'Blink', description: '30% chance to teleport on hit (avoid damage)', tier: 'unique',
    effect: { type: 'blink', value: 0.3 } },
];

export { ENCHANTMENTS };

export const ENCHANTMENT_BY_ID: ReadonlyMap<string, EnchantmentDefinition> =
  new Map(ENCHANTMENTS.map(e => [e.id, e]));

export const ENCHANTMENT_COSTS: Record<1 | 2 | 3 | 'unique', number> = {
  1: 40,
  2: 100,
  3: 200,
  'unique': 150,
};

export function getEnchantmentCost(enchantmentId: string): number {
  const def = ENCHANTMENT_BY_ID.get(enchantmentId);
  if (!def) return 0;
  return ENCHANTMENT_COSTS[def.tier];
}

export function getImpliedBlueprints(enchantmentId: string): string[] {
  const def = ENCHANTMENT_BY_ID.get(enchantmentId);
  if (!def) return [];
  return [enchantmentId];
}
