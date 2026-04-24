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
  description: 'An ancient artifact was lost deep in the dungeon. Retrieve any rare weapon and bring it back.',
  
  targetItemId: 'frost_axe',         // What item to bring back (if applicable)
  targetEnemyTemplateId: undefined,  // What enemy to defeat (if applicable)
  targetFloorDepth: undefined,       // What depth to reach (if applicable)
  
  rewardGold: 75,                    // Gold reward for completion
};
```

### Quest Target Types

You can combine multiple quest objectives:

```typescript
// Hunt a dangerous enemy
{
  id: 'hunt_dangerous_enemy',
  title: 'Eliminate the Shadowborn',
  description: 'A dangerous creature has been terrorizing our people. Defeat it and return.',
  targetEnemyTemplateId: 'shadow_lurker',
  rewardGold: 100,
}

// Retrieve an item
{
  id: 'find_enchanted_armor',
  title: 'Seek the Warden\'s Cloak',
  description: 'Find enchanted armor hidden in the depths.',
  targetItemId: 'leather_armor',
  rewardGold: 85,
}

// Reach a depth
{
  id: 'rescue_expedition',
  title: 'Find the Lost Expedition',
  description: 'Find survivors of an expedition that disappeared months ago.',
  targetFloorDepth: 7,
  rewardGold: 120,
}
```

---

## Step 2: Quest Completion Logic

When a player meets a quest objective, they can return to the NPC to complete it:

```typescript
// Quest completion checks in game-core/systems/quest-system.ts
- Player has the required item
- Player defeated the required enemy
- Player reached the required floor depth
```

Upon completion:
- Player receives gold reward
- NPC dialogue changes
- Disposition may shift (handled in quest reward system)

---

## Randomization

Quests are selected randomly when NPCs offer them:

```typescript
// In quest system
const randomTemplate = selectRandomQuestTemplate(rng);
```

To ensure fair distribution, keep reward values balanced across quest difficulty.

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/quests/` (individual files) |
| Completion logic | `packages/game-core/src/systems/quest-system.ts` |
| NPC integration | `packages/game-core/src/systems/npc-system.ts` |
| UI display | `apps/web/src/components/QuestDetailModal.tsx` |
| Types | `packages/game-contracts/src/types/index.ts` (Quest) |
