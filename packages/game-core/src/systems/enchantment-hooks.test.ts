import { describe, it, expect } from 'vitest';
import {
  applyThornsToAttacker,
  applyBlinkOnHit,
  applyLifeStealOnKill,
  getExpBonusMultiplier,
  getEnchantmentRegenBonus,
  getTotalThornsReflect,
} from './enchantment-hooks.js';
import type { ArmorTemplate, GameState } from '@dungeon/contracts';
import { createTestGameState, createTestEnemy } from '../test-utils.js';
import { entityId } from '@dungeon/contracts';

function makeStateWithEnchantedArmor(enchantments: (string | null)[], slot: 'chest' | 'head' = 'chest'): GameState {
  const armorId = entityId('enc_armor');
  const armor: ArmorTemplate = {
    itemId: 'enc_armor',
    name: 'Enchanted Armor',
    description: '',
    itemClass: 'armor',
    rarity: 'rare',
    value: 50,
    stackable: false,
    maxStack: 1,
    armor: { defense: 5, evasionPenalty: 0, slot, enchantmentSlots: enchantments.length, enchantments },
  };
  const registry = new Map([[armorId, armor]]);
  const equipment = slot === 'chest'
    ? { weapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null }
    : { weapon: null, chest: null, head: armorId, gloves: null, boots: null, ring1: null, ring2: null };
  return {
    ...createTestGameState(),
    player: { ...createTestGameState().player, equipment },
    itemRegistry: { items: registry as any },
  };
}

describe('getTotalThornsReflect', () => {
  it('returns 0 when no thorns/spikes enchantments', () => {
    const state = makeStateWithEnchantedArmor(['hp_regen']);
    expect(getTotalThornsReflect(state)).toBe(0);
  });

  it('returns 3 for thorns enchantment', () => {
    const state = makeStateWithEnchantedArmor(['thorns']);
    expect(getTotalThornsReflect(state)).toBe(3);
  });

  it('returns 6 for spikes enchantment', () => {
    const state = makeStateWithEnchantedArmor(['spikes']);
    expect(getTotalThornsReflect(state)).toBe(6);
  });

  it('stacks thorns + spikes from different slots', () => {
    const armorId1 = entityId('enc1');
    const armorId2 = entityId('enc2');
    const mkArmor = (id: string, enc: string): ArmorTemplate => ({
      itemId: id, name: id, description: '', itemClass: 'armor', rarity: 'rare',
      value: 50, stackable: false, maxStack: 1,
      armor: { defense: 5, evasionPenalty: 0, slot: 'chest', enchantmentSlots: 1, enchantments: [enc] },
    });
    const registry = new Map([[armorId1, mkArmor('enc1', 'thorns')], [armorId2, mkArmor('enc2', 'spikes')]]);
    const state = {
      ...createTestGameState(),
      player: {
        ...createTestGameState().player,
        equipment: { weapon: null, chest: armorId1, head: armorId2, gloves: null, boots: null, ring1: null, ring2: null },
      },
      itemRegistry: { items: registry as any },
    };
    expect(getTotalThornsReflect(state)).toBe(9); // 3 + 6
  });
});

describe('getEnchantmentRegenBonus', () => {
  it('returns 0 when no regen enchantment', () => {
    const state = createTestGameState();
    expect(getEnchantmentRegenBonus(state)).toBe(0);
  });

  it('returns 2 for hp_regen enchantment', () => {
    const state = makeStateWithEnchantedArmor(['hp_regen']);
    expect(getEnchantmentRegenBonus(state)).toBe(2);
  });
});

describe('getExpBonusMultiplier', () => {
  it('returns 1.0 when no exp_bonus enchantment', () => {
    const state = createTestGameState();
    expect(getExpBonusMultiplier(state)).toBe(1.0);
  });

  it('returns 1.25 for exp_bonus enchantment', () => {
    const state = makeStateWithEnchantedArmor(['exp_bonus']);
    expect(getExpBonusMultiplier(state)).toBe(1.25);
  });
});

describe('applyThornsToAttacker', () => {
  it('reflects thorns damage to enemy', () => {
    const state = makeStateWithEnchantedArmor(['thorns']);
    const enemy = createTestEnemy({ stats: { ...createTestEnemy().stats, health: 30 } });
    const result = applyThornsToAttacker(state, enemy, 3);
    expect(result.newEnemyHealth).toBe(27);
    expect(result.thornsApplied).toBe(3);
  });

  it('returns unmodified enemy health if no thorns', () => {
    const state = createTestGameState();
    const enemy = createTestEnemy({ stats: { ...createTestEnemy().stats, health: 30 } });
    const result = applyThornsToAttacker(state, enemy, 0);
    expect(result.newEnemyHealth).toBe(30);
    expect(result.thornsApplied).toBe(0);
  });
});

describe('applyBlinkOnHit', () => {
  it('returns blocked=false when no blink enchantment', () => {
    const state = createTestGameState();
    // rng always 0.1, blink would trigger at < 0.3, but no enchantment
    expect(applyBlinkOnHit(state, () => 0.1)).toBe(false);
  });

  it('returns blocked=true with blink when rng < 0.3', () => {
    const state = makeStateWithEnchantedArmor(['blink']);
    expect(applyBlinkOnHit(state, () => 0.1)).toBe(true);
  });

  it('returns blocked=false with blink when rng >= 0.3', () => {
    const state = makeStateWithEnchantedArmor(['blink']);
    expect(applyBlinkOnHit(state, () => 0.5)).toBe(false);
  });
});

describe('applyLifeStealOnKill', () => {
  it('returns 0 when no life_steal enchantment', () => {
    const state = createTestGameState();
    expect(applyLifeStealOnKill(state)).toBe(0);
  });

  it('returns 2 for life_steal enchantment', () => {
    const state = makeStateWithEnchantedArmor(['life_steal']);
    expect(applyLifeStealOnKill(state)).toBe(2);
  });
});
