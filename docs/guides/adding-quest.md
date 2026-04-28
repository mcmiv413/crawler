# How to Add a New Quest

## Overview

Quests are tasks offered by NPCs in town. Players can complete quests to earn gold and disposition changes. Quest templates are randomly selected when NPCs offer quests.

---

## Quick Start

1. Create `packages/content/src/quests/my-quest.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Test and commit

**That's it!** No manual index registration needed.

---

## Step 1: Create the Quest Template

Create `packages/content/src/quests/my-quest.ts`:

```typescript
import type { QuestTemplate } from './types.js';

export const myQuest: QuestTemplate = {
  id: 'retrieve_rare_weapon',
  title: 'Retrieve the Lost Artifact',
  description: 'An ancient artifact was lost deep in the dungeon generations ago. Recover it for the council.',
  objectiveText: 'Recover the Frost Axe and bring it back to town.',
  objective: {
    type: 'collect_item',
    targetId: 'frost_axe',
    targetCount: 1,
    progress: 0,
  },
  reward: {
    type: 'gold',
    amount: 75,
  },
};
```

### Quest Target Types

Pick the objective type that matches the quest:

```typescript
// Hunt a dangerous enemy
{
  id: 'hunt_dangerous_enemy',
  title: 'Hunt the Shadow Lurker',
  description: 'A dangerous creature has been terrorizing our people. Defeat it and return.',
  objectiveText: 'Defeat the Shadow Lurker and end its attacks.',
  objective: {
    type: 'defeat_enemy',
    targetId: 'shadow_lurker',
    targetCount: 1,
    progress: 0,
  },
  reward: { type: 'gold', amount: 100 },
}

// Retrieve an item
{
  id: 'find_enchanted_armor',
  title: 'Seek the Warden\'s Cloak',
  description: 'Find enchanted armor hidden in the depths.',
  objectiveText: 'Recover the Plate Armor and return it to the council.',
  objective: {
    type: 'collect_item',
    targetId: 'plate_armor', // Valid item ID — check ITEM_BY_ID
    targetCount: 1,
    progress: 0,
  },
  reward: { type: 'gold', amount: 85 },
}

// Reach a depth
{
  id: 'rescue_expedition',
  title: 'Find the Lost Expedition',
  description: 'Find survivors of an expedition that disappeared months ago.',
  objectiveText: 'Reach floor 7 and search for the lost expedition or their research notes.',
  objective: {
    type: 'reach_floor',
    targetCount: 7,
    progress: 0,
  },
  reward: { type: 'gold', amount: 120 },
}
```

---

## Step 2: Quest Completion Logic

When a player meets a quest objective, they can return to the NPC to complete it:

Quest completion logic is handled in **game-core** systems:
- `packages/game-core/src/systems/npc.ts` — NPC quest assignment and tracking
- `packages/game-core/src/systems/loot.ts` — Item drop tracking
- `packages/game-core/src/engine/command-handler.ts` — Command routing

The system checks:
- Player has the required item (tracked in inventory)
- Player defeated the required enemy (tracked in metrics)
- Player reached the required floor depth (tracked in run state)

Upon completion:
- Player receives gold reward
- NPC disposition updated
- Quest marked as complete

---

## Randomization

Quests are selected randomly when NPCs offer them:

```typescript
// In quest system
const randomTemplate = selectRandomQuestTemplate(rng);
```

To ensure fair distribution, keep reward values balanced across quest difficulty.

---

## Validation Checklist

Before committing a new quest, verify:

- [ ] **Target ID exists**: If using `objective.targetId` for an item quest, confirm it exists in `ITEM_BY_ID`
- [ ] **Enemy ID exists**: If using `objective.targetId` for an enemy quest, confirm it exists in `ENEMY_TEMPLATES`
- [ ] **Objective type is correct**: Every quest must use one of `collect_item`, `defeat_enemy`, or `reach_floor`
- [ ] **Objective text is specific**: `objectiveText` should say exactly what the player must do and should not duplicate the flavor description
- [ ] **Reward is positive**: `reward.amount` should be > 0
- [ ] **Description is clear**: The flavor text explains why the quest matters
- [ ] **Index is generated**: Run `pnpm generate:indexes` to update `packages/content/src/quests/index.ts`
- [ ] **Contract test passes**: Run `pnpm test` to verify cross-references are valid

**Common mistakes:**
- Using non-existent item IDs (especially typos like `leather_armor` instead of `plate_armor`)
- Using non-existent enemy template IDs
- Forgetting to run `pnpm generate:indexes` after creating a new quest file
- Not verifying that targets actually exist in the game

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Quest Templates | `packages/content/src/quests/` (individual files, auto-indexed) |
| NPC & Quest Logic | `packages/game-core/src/systems/npc.ts` |
| Item Tracking | `packages/content/src/items/index.ts` |
| Enemy Templates | `packages/content/src/enemies/index.ts` |
| UI display | `apps/web/src/components/QuestDetailModal.tsx` |
| Quest Types | `packages/game-contracts/src/types/index.ts` |
