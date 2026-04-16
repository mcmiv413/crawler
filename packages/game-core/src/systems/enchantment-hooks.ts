import type { GameState, EnemyInstance, ArmorTemplate } from '@dungeon/contracts';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';

const ARMOR_SLOTS = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const;

/** Collect all active enchantment IDs from all equipped armor slots */
function getEquippedEnchantments(state: GameState): string[] {
  let ids: string[] = [];
  for (const slot of ARMOR_SLOTS) {
    const itemId = state.player.equipment[slot];
    if (itemId === null) continue;
    const template = state.itemRegistry.items.get(itemId);
    if (template === undefined || template.itemClass !== 'armor') continue;
    for (const enc of (template as ArmorTemplate).armor.enchantments) {
      if (enc !== null) ids = [...ids, enc];
    }
  }
  return ids;
}

/** Sum effect values for a specific enchantment type from all equipped armor */
function sumEnchantmentEffect(state: GameState, effectType: string): number {
  let total = 0;
  for (const encId of getEquippedEnchantments(state)) {
    const def = ENCHANTMENT_BY_ID.get(encId);
    if (def?.effect.type === effectType && def.effect.value !== undefined) {
      total += def.effect.value;
    }
  }
  return total;
}

/** Sum total thorns/spikes reflect damage from all equipped armor */
export const getTotalThornsReflect = (state: GameState) => sumEnchantmentEffect(state, 'thorns');

/** Get HP regen bonus per turn from enchantments */
export const getEnchantmentRegenBonus = (state: GameState) => sumEnchantmentEffect(state, 'regen');

/** Get XP multiplier from exp_bonus enchantments (stacks additively) */
export function getExpBonusMultiplier(state: GameState): number {
  return 1.0 + sumEnchantmentEffect(state, 'exp_bonus');
}

/**
 * Apply thorns/spikes reflect damage to an attacker.
 * Returns the new enemy health and how much was reflected.
 */
export function applyThornsToAttacker(
  _state: GameState,
  enemy: EnemyInstance,
  thornsAmount: number,
): { newEnemyHealth: number; thornsApplied: number } {
  if (thornsAmount <= 0) {
    return { newEnemyHealth: enemy.stats.health, thornsApplied: 0 };
  }
  const newHealth = Math.max(0, enemy.stats.health - thornsAmount);
  return { newEnemyHealth: newHealth, thornsApplied: thornsAmount };
}

/**
 * Check if blink triggers when player is hit.
 * Returns true if the hit is blocked (teleport dodged it).
 * @param rngNext — returns a float in [0,1)
 */
export function applyBlinkOnHit(state: GameState, rngNext: () => number): boolean {
  const enchantments = getEquippedEnchantments(state);
  if (!enchantments.includes('blink')) return false;
  const roll = rngNext();
  return roll < 0.3;
}

/**
 * Get HP healed on kill from life_steal enchantments.
 */
export const applyLifeStealOnKill = (state: GameState) => sumEnchantmentEffect(state, 'life_steal');
