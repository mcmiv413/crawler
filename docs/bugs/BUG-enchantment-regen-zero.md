# BUG: getEnchantmentRegenBonus always returns 0

**Status:** Fixed
**Severity:** Medium (HP regen enchantment had no effect in-game)
**File:** `packages/game-core/src/systems/enchantment-hooks.ts`

## Description

`getEnchantmentRegenBonus()` called `sumEnchantmentEffect(state, hpRegen.id)`, passing `'hp_regen'` as the effect type to match. But `sumEnchantmentEffect` compares against `def.effect.type`, which for hp_regen is `'regen'` (not `'hp_regen'`). The mismatch caused the function to always return 0.

## Root Cause

The `hpRegen` enchantment is the only one where `id !== effect.type`:
- thorns: id='thorns', effect.type='thorns' ✓
- exp_bonus: id='exp_bonus', effect.type='exp_bonus' ✓
- hp_regen: id='hp_regen', effect.type='regen' ✗

The code assumed id === effect.type, which was true for all other enchantments.

## Fix

Changed all three lookup functions to use `enchantment.effect.type` instead of `enchantment.id`:
- `getTotalThornsReflect` → `thorns.effect.type`
- `getEnchantmentRegenBonus` → `hpRegen.effect.type`
- `getExpBonusMultiplier` → `expBonus.effect.type`

## Impact

- Players with HP regen enchantments gained no HP per turn
- The "Regen Vest" and "Blessed Ring" items were effectively broken
