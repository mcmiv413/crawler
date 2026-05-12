// Auto-generated — do not edit manually
import type { EnchantmentDefinition } from '@dungeon/contracts';
import { arcaneWard } from './arcane-ward.js';
import { blightWard } from './blight-ward.js';
import { blink } from './blink.js';
import { defenseBoost } from './defense-boost.js';
import { evasionBoost } from './evasion-boost.js';
import { expBonus } from './exp-bonus.js';
import { fireRingEmber } from './fire-ring-ember.js';
import { hpRegen } from './hp-regen.js';
import { lifeSteal } from './life-steal.js';
import { resistFire } from './resist-fire.js';
import { resistFrost } from './resist-frost.js';
import { resistPoison } from './resist-poison.js';
import { speedBoost } from './speed-boost.js';
import { spikes } from './spikes.js';
import { thorns } from './thorns.js';

export const ENCHANTMENTS: readonly EnchantmentDefinition[] = [
  arcaneWard,
  blightWard,
  blink,
  defenseBoost,
  evasionBoost,
  expBonus,
  fireRingEmber,
  hpRegen,
  lifeSteal,
  resistFire,
  resistFrost,
  resistPoison,
  speedBoost,
  spikes,
  thorns,
];

export const ENCHANTMENT_BY_ID: ReadonlyMap<string, EnchantmentDefinition> = new Map(
  ENCHANTMENTS.map(e => [e.id, e]),
);

export {
  arcaneWard, blightWard, blink, defenseBoost, evasionBoost, expBonus, fireRingEmber, hpRegen, lifeSteal, resistFire, resistFrost, resistPoison, speedBoost, spikes, thorns,
};

export * from './utilities.js';

// Add custom utilities below this line ↓
