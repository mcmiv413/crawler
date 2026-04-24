# How to Add a New Enchantment

## Overview

Enchantments are stat/effect modifiers applied to armor. They're defined in the content package and integrated into combat via a hook system in game-core.

---

## Quick Start

1. Create `packages/content/src/enchantments/my-enchantment.ts`
2. Export the definition
3. Run `pnpm generate:indexes` — the index is auto-generated
4. Test and commit

**That's it!** No manual index registration needed.

---

## Files to Touch

| Step | File | What to do |
|------|------|-----------|
| 1. Define | `packages/content/src/enchantments/my-enchantment.ts` | Create new definition file |
| 2. Type (if new effect) | `packages/game-contracts/src/types/items.ts` | Extend `EnchantmentEffect.type` |
| 3. Hooks (if new effect) | `packages/game-core/src/systems/enchantment-hooks.ts` | Add trigger function |
| 4. Integration (if new effect) | `packages/game-core/src/engine/turn-scheduler.ts` or `equipment.ts` | Wire hook into game loop |
| 5. Events (if new effect) | `packages/game-contracts/src/events/index.ts` | Add event type |
| 6. Format (if new event) | `packages/presenter/src/event-formatter.ts` | Add formatter |
| 7. Test | Write unit + feature chain tests |

**Note:** For existing effect types (`stat_bonus`, `regen`, `thorns`, `resist`, `exp_bonus`, `life_steal`, `blink`), only Step 1 is needed — the rest is automatic.

---

## Step 1: Define the Enchantment

Create `packages/content/src/enchantments/my-enchantment.ts`:

```typescript
import type { EnchantmentDefinition } from '@dungeon/contracts';

export const myEnchantment: EnchantmentDefinition = {
  id: 'my_enchantment',
  name: 'Flame Ward',
  description: 'Reduces fire damage taken.',
  tier: 2,                           // 1, 2, 3, or 'unique'
  effect: {
    type: 'resist',                  // Existing effect type
    damageType: 'fire',
    value: 0.2,                      // 20% resistance
  },
};
```

### Existing Effect Types

| Type | What it does | Fields |
|------|-------------|--------|
| `stat_bonus` | Adds to defense/evasion/speed | `stat`, `value` |
| `regen` | HP regen per turn | `value` |
| `thorns` | Reflect damage when hit | `value` |
| `resist` | Reduce damage of a type | `damageType`, `value` |
| `exp_bonus` | XP multiplier bonus | `value` |
| `life_steal` | Heal on enemy kill | `value` |
| `blink` | 30% chance to dodge | — |

For multi-element resistance, use the `resistAll` field:
```typescript
export const arcaneWard: EnchantmentDefinition = {
  id: 'arcane_ward',
  name: 'Arcane Ward',
  tier: 3,
  effect: { type: 'resist', value: 0.4 },
  resistAll: ['fire', 'shock', 'frost'] as const,
};
```

---

## Adding a New Effect Type

If no existing type fits, you need to extend the system:

### 1. Type definition
`packages/game-contracts/src/types/items.ts` — add to `EnchantmentEffect.type` union

### 2. Hook function
`packages/game-core/src/systems/enchantment-hooks.ts`:
```typescript
export function getMyEnchantmentValue(state: GameState): number {
  return sumEnchantmentEffect(state, 'my_effect_type');
}
```

### 3. Integration point
Wire into the appropriate game loop stage:

| When to trigger | Where to wire |
|----------------|--------------|
| Start of player turn | `turn-scheduler.ts` (near regen logic) |
| When player takes damage | `turn-scheduler.ts` (near blink/thorns) |
| When calculating stats | `equipment.ts` → `calculateEquippedStats()` |
| When enemy dies | `handlers/combat.ts` (near life steal) |

### 4. Events
Add event type in `packages/game-contracts/src/events/index.ts`.
Add formatter in `packages/presenter/src/event-formatter.ts`.

---

## Stacking Rules

- **Stat bonuses** — Stack additively across all equipped armor
- **Resistances** — Stack additively, **capped at 0.75** (75% max per damage type)
- **Thorns** — Stack additively across all armor
- **XP bonus** — Stack additively (1.0 + sum of all bonuses)
- **Regen** — Stack additively per turn
- **Blink** — 30% chance per check (does not stack)

---

## What Happens Automatically

For existing effect types, once you add the definition:

- **Index registration** — `pnpm generate:indexes` auto-registers in `packages/content/src/enchantments/index.ts`
- **Equipment stat calc** — `calculateEquippedStats()` in `equipment.ts` applies stat bonuses and resistances
- **Combat hooks** — `turn-scheduler.ts` triggers regen, thorns, blink, life steal at correct points
- **UI display** — `EnchanterPanel.tsx` shows in town enchanting UI
- **Library** — `EnchantmentLibrary.tsx` shows on character screen
- **Item inspect** — `ItemInspectModal.tsx` shows on equipped items
- **Events** — `ENCHANTMENT_APPLIED` event formatted for combat log

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/enchantments/` (individual files) |
| Types | `packages/game-contracts/src/types/items.ts` |
| Hook system | `packages/game-core/src/systems/enchantment-hooks.ts` |
| Stat calculation | `packages/game-core/src/systems/equipment.ts` |
| Damage mitigation | `packages/game-core/src/systems/damage.ts` |
| Combat integration | `packages/game-core/src/engine/turn-scheduler.ts` |
| Tests | `packages/game-core/src/systems/enchantment-resistall.test.ts` |
