# How to Add a New Dungeon Object

## Overview

Dungeon objects are interactive tiles like chests, fire pits, traps, and healing fountains. They can have effects, grant loot, damage enemies, or heal the player.

---

## Quick Start

1. Create `packages/content/src/objects/my-object.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Wire interaction logic if needed
4. Test and commit

**That's it!** No manual index registration needed.

---

## Step 1: Create the Template

Create `packages/content/src/objects/my-object.ts`:

```typescript
import type { ObjectTemplate } from '@dungeon/contracts';

export const myObject: ObjectTemplate = {
  templateId: 'my_object',
  name: 'Healing Fountain',
  description: 'Restores health when interacted with.',
  
  spawn: {
    weight: 1.0,                  // Relative spawn frequency
    floorRange: [1, 10],          // Floors it appears on
  },
  
  effect: 'heal_player',           // or 'damage_enemies', 'apply_status', etc.
  effectValue: 30,                 // Amount to heal/damage
  
  ascii: 'F',                      // Fallback ASCII
  color: '#4488ff',                // Fallback color
  spriteName: 'healing_fountain',  // DawnLike sprite name
  
  interactable: true,              // Can player interact?
  destructible: false,             // Can be destroyed?
};
```

### Common Effect Types

| Effect | What it does | Value |
|--------|-------------|-------|
| `heal_player` | Restore player HP | Amount to heal |
| `damage_enemies` | Damage all visible enemies | Damage amount |
| `apply_status` | Apply status to player/enemies | Status ID |
| `none` | Cosmetic object, no effect | — |

---

## Step 2: Wire Interaction Logic (if needed)

If you're using a custom effect type:

1. Add or extend interaction handling in `packages/game-core/src/engine/handlers/movement.ts`
2. Add event type in `packages/game-contracts/src/events/index.ts`
3. Add event formatter in `packages/presenter/src/event-formatter.ts`

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/objects/` (individual files) |
| Interaction logic | `packages/game-core/src/engine/handlers/movement.ts` |
| Spawning | `packages/game-core/src/generation/floor-populator.ts` |
| Tests | `packages/game-core/src/engine/handlers/movement.test.ts` |
