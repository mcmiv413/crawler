# How to Add a New Item

## Overview

Items are equipment (weapons, armor) and consumables the player collects. Items are organized into categories: weapons, armor, consumables, and traps. Each category is auto-indexed separately but aggregated into a unified inventory.

---

## Quick Start

1. Add to the appropriate category file:
   - Weapons: `packages/content/src/items/weapons.ts`
   - Armor: `packages/content/src/items/armor.ts`
   - Consumables: `packages/content/src/items/consumables.ts`
   - Traps: `packages/content/src/items/traps.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Test and commit

**That's it!** No manual index registration needed.

---

## Step 1: Add to Your Category File

### Weapons (`packages/content/src/items/weapons.ts`)

```typescript
export const frostAxe: WeaponItem = {
  itemId: 'frost_axe',
  name: 'Frost Axe',
  description: 'A shimmering axe wreathed in icy fog.',
  rarity: 'rare',
  
  damageType: 'frost',
  baseDamage: 12,
  accuracy: 85,
  
  spriteId: 'axe_frost',
  weight: 1.0,
  
  enchantments: ['resist_frost'],  // Optional enchantment IDs
};
```

### Armor (`packages/content/src/items/armor.ts`)

```typescript
export const leatherArmor: ArmorItem = {
  itemId: 'leather_armor',
  name: 'Leather Armor',
  description: 'Well-worn but sturdy protective gear.',
  rarity: 'common',
  
  armorType: 'light',
  defense: 5,
  evasion: 8,
  
  spriteId: 'armor_leather',
  weight: 2.0,
  
  enchantments: [],
};
```

### Consumables (`packages/content/src/items/consumables.ts`)

```typescript
export const manaPotion: ConsumableItem = {
  itemId: 'mana_potion',
  name: 'Mana Potion',
  description: 'Restores magical energy.',
  rarity: 'common',
  
  effect: 'restore_mana',
  effectValue: 30,
  
  stackable: true,
  maxStack: 99,
  
  spriteId: 'potion_blue',
};
```

### Traps (`packages/content/src/items/traps.ts`)

```typescript
export const bearTrap: TrapItem = {
  itemId: 'bear_trap',
  name: 'Bear Trap',
  description: 'A brutal mechanical trap.',
  rarity: 'uncommon',
  
  damageType: 'physical',
  baseDamage: 8,
  armorPenetration: 0.3,
  
  trigger: 'on_walk',  // 'on_walk', 'on_attack', 'on_time'
  spriteId: 'trap_bear',
};
```

---

## Step 2: Define Item Types

All items follow a common structure:

```typescript
interface Item {
  itemId: string;           // Unique identifier
  name: string;            // Display name
  description: string;     // In-game tooltip
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  spriteId: string;        // DawnLike atlas ID
  weight?: number;         // 0-1 encumbrance factor
  enchantments?: string[]; // Optional enchantment IDs
}
```

---

## Item Rarities

| Rarity | Drop Chance | Color |
|--------|------------|-------|
| Common | 60% | Gray |
| Uncommon | 25% | Green |
| Rare | 12% | Blue |
| Legendary | 3% | Gold |

---

## Step 3: Wire Game Logic (if custom effect)

For standard effects (damage, defense, healing), the system handles them automatically.

For custom effects:
1. Add handler in `packages/game-core/src/systems/item-system.ts`
2. Add event type in `packages/game-contracts/src/events/index.ts`
3. Add UI formatter in `packages/presenter/src/event-formatter.ts`

---

## Loot Tables

Items are distributed via loot tables. Modify or create loot tables in:
- `packages/game-core/src/systems/loot.ts`

To make your item droppable, reference it in a loot table.

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Weapons | `packages/content/src/items/weapons.ts` |
| Armor | `packages/content/src/items/armor.ts` |
| Consumables | `packages/content/src/items/consumables.ts` |
| Traps | `packages/content/src/items/traps.ts` |
| Loot system | `packages/game-core/src/systems/loot.ts` |
| Equipment logic | `packages/game-core/src/systems/equipment.ts` |
| Types | `packages/game-contracts/src/types/items.ts` |
| UI display | `apps/web/src/components/ItemInspectModal.tsx` |
