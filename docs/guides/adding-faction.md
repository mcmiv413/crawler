# How to Add a New Faction

## Overview

Factions are groups of enemies in the dungeon with shared goals and lore. Players can improve or damage faction disposition through combat and quests.

---

## Quick Start

1. Create `packages/content/src/factions/my-faction.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Assign enemies to the faction
4. Test and commit

**That's it!** No manual index registration needed.

---

## Step 1: Create the Definition

Create `packages/content/src/factions/my-faction.ts`:

```typescript
import type { FactionDefinition } from './types.js';

export const myFaction: FactionDefinition = {
  id: 'goblin_warband',
  name: 'Goblin Warband',
  description: 'Disorganized raiders motivated by greed and chaos.',
  lore: 'Once a loose rabble of cave-dwellers, these goblins have grown emboldened by the dungeon\'s depths. They hoard treasures and lay crude traps in the warrens they inhabit.',
  
  initialPower: 40,              // Starting power level
  initialDisposition: -30,       // Starting attitude toward player (-100 = hostile, +100 = friendly)
};
```

### Configuration Fields

| Field | Purpose |
|-------|---------|
| `initialPower` | How powerful the faction is (affects enemy stats slightly) |
| `initialDisposition` | Starting attitude toward player; changes via quest rewards/combat |

---

## Step 2: Assign Enemies to the Faction

In each enemy template, add the faction membership:

```typescript
// packages/content/src/enemies/goblin-archer.ts
export const goblinArcher: EnemyTemplate = {
  templateId: 'goblin_archer',
  // ... other properties ...
  factions: [
    { factionId: 'goblin_warband', weight: 1.0 }  // weight = affiliation strength
  ],
};
```

You can assign an enemy to multiple factions with different weights.

---

## Step 3: Wire Disposition Changes (Optional)

When the player defeats enemies or completes quests, faction disposition changes:

```typescript
// In quest rewards or combat handlers
game.state.factions[factionId].disposition += change;
```

The UI automatically tracks this and shows faction status on the HUD.

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/factions/` (individual files) |
| Enemy assignment | `packages/content/src/enemies/*.ts` |
| State tracking | `packages/game-contracts/src/types/index.ts` (FactionState) |
| Disposition logic | `packages/game-core/src/systems/faction-system.ts` |
| UI display | `apps/web/src/components/FactionDetailModal.tsx` |
