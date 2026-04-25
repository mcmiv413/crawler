# How to Add a New Ability

## Overview

Abilities are **data-driven** — define the ability as a declarative structure and the runtime handles execution, events, and UI automatically.

---

## Quick Start (Content Abilities)

For abilities defined in the content package:

1. Create `packages/content/src/abilities/my-ability.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Reference in level progression or weapon mastery
4. Test and commit

**That's it!** No manual index registration needed.

---

## Two Paths: Content vs Game-Core

**Use `packages/content/src/abilities/`** for:
- Ability definitions you want to version control as data
- Abilities granted by level progression or weapon mastery
- Abilities referenced in content (enemies, loot, NPCs)

**Use `packages/game-core/src/abilities/definitions/`** for:
- Core engine abilities with complex logic
- Abilities needing tight integration with combat systems
- Internal/system abilities not meant for content iteration

This guide focuses on **content abilities** (the common path).

---

## Step 1: Create the Definition (Content Abilities)

Create a new file in `packages/content/src/abilities/`:

```typescript
import type { AbilityDefinition } from './types.js';

export const myAbility: AbilityDefinition = {
  id: 'my_ability',
  name: 'My Ability',
  description: 'Deals fire damage to a single target.',
  tier: 1,  // 1, 2, 3, or 'unique'
  
  // Define what this ability does
  // Implementation depends on your game mechanics
};
```

---

## Step 2: Run the Generator

After creating your ability file, run:

```bash
pnpm generate:indexes
```

This automatically updates `packages/content/src/abilities/index.ts` to include your ability. The index is **auto-generated** — do not edit it manually.

---

## Step 3: Grant the Ability

Decide how the player gets this ability:

### By Level Progression

In `packages/content/src/abilities/mastery.ts`:

```typescript
export const ABILITY_UNLOCK_BY_LEVEL: Readonly<Record<number, string>> = {
  2: powerStrike.id,
  4: secondWind.id,
  // Add your ability at a specific level
  6: myAbility.id,
};
```

### By Weapon Mastery

In `packages/content/src/abilities/mastery.ts`:

```typescript
export const MASTERY_ABILITIES: Record<WeaponType, Record<1 | 2, string>> = {
  blade:    { 1: bladeBleed.id,      2: bladeRiposte.id    },
  bludgeon: { 1: bludgeonStagger.id, 2: bludgeonShatter.id },
  axe:      { 1: axeCleave.id,       2: myAbility.id       },  // Tier 2
  // ...
};
```

---

## Key Files Reference

| Purpose | File |
|---------|------|\n| Content abilities | `packages/content/src/abilities/` |
| Ability granting | `packages/content/src/abilities/mastery.ts` |
| Type definitions | `packages/content/src/abilities/types.ts` |
| Auto-generated index | `packages/content/src/abilities/index.ts` |
| Game-core abilities | `packages/game-core/src/abilities/definitions/` |

---

## Game-Core Abilities (Advanced)

If you need to create an ability in `packages/game-core/src/abilities/definitions/`:

### Files to Touch

| Step | File | What to do |
|------|------|-----------|\n| 1. Define | `packages/game-core/src/abilities/definitions/my-ability.ts` | Create `AbilityDefinition` |
| 2. Register | `packages/game-core/src/abilities/definitions/index.ts` | Add to `ALL_ABILITY_DEFINITIONS` |
| 3. Test | `packages/game-core/src/abilities/definitions/my-ability.test.ts` | Unit test the definition |

### Step 1: Create the Definition

Create a new file in `packages/game-core/src/abilities/definitions/`:

```typescript
import type { AbilityDefinition } from '../types.js';

export const MY_ABILITY: AbilityDefinition = {
  id: 'my_ability',
  name: 'My Ability',
  description: 'Deals fire damage to a single target.',
  cooldown: 3,           // Turns between uses
  targeting: {
    type: 'single',      // 'single' | 'self' | 'aoe' | 'directional'
    range: 1,
  },
  requirements: [
    { type: 'weapon_type', weaponType: 'sword' },  // Optional: restrict by weapon
  ],
  effects: [
    {
      type: 'attack',
      target: 'selected',
      damageMultiplier: 1.5,
      damageType: 'fire',
    },
    {
      type: 'status',
      target: 'selected',
      statusId: 'burning',
      duration: 3,
      chance: 0.5,
    },
  ],
};
```

### Key Types (from `packages/game-core/src/abilities/types.ts`)

**Effect types:** `AttackEffect`, `HealEffect`, `StatusEffect`, `ModifyStatEffect`, `ConditionalEffect`
**Targeting types:** `single`, `self`, `aoe`, `directional`
**Requirement types:** `weapon_type`, `min_health_pct`, `has_status`

---

## Step 2: Register in Index (Game-Core)

Add to `packages/game-core/src/abilities/definitions/index.ts`:

```typescript
import { MY_ABILITY } from './my-ability.js';

export const ALL_ABILITY_DEFINITIONS: AbilityDefinition[] = [
  // ... existing abilities
  MY_ABILITY,
];
```

The `AbilityRegistry` (built via `buildRegistry()` in `packages/game-core/src/abilities/registry.ts`) automatically picks it up.

---

## What Happens Automatically

Once registered, the runtime handles:

1. **Command routing** — `USE_ABILITY` command → `command-handler.ts` → `handleUseAbility()`
2. **Execution pipeline** — `execute-ability.ts`: build context → validate → resolve targets → apply effects
3. **Event emission** — `AbilityUsedEvent` emitted with damage/heal amounts via `emit-events.ts`
4. **Event formatting** — `event-formatter.ts` formats to combat log text
5. **UI actions** — `actions-builder.ts` discovers from `state.player.abilities` and builds action buttons
6. **UI rendering** — `AbilityDropdown.tsx` shows ready abilities with target/direction selectors

---

## How Abilities Are Granted

- **By level** — `ABILITY_UNLOCK_BY_LEVEL` in `packages/content/src/abilities/mastery.ts`
- **By weapon mastery** — `MASTERY_ABILITIES` in same file
- **Programmatically** — `grantAbility(state, abilityId)` in `packages/game-core/src/systems/abilities.ts`

---

## Effect Handlers

Located in `packages/game-core/src/abilities/effects/`:

| Effect | Handler | What it does |
|--------|---------|---------|
| `attack` | `apply-attack.ts` | Damage with multiplier, damage type |
| `heal` | `apply-heal.ts` | Restore HP |
| `status` | `apply-status.ts` | Apply status effect with duration |
| `modify_stat` | `apply-stat-modifier.ts` | Temporary stat changes |
| `conditional` | `apply-conditional.ts` | If-then effect chains |

---

## Testing

```typescript
import { executeAbility } from '../runtime/execute-ability.js';
import { assertFeatureChain } from '@dungeon/presenter/testing';

it('my ability deals fire damage', () => {
  const state = createTestStateInCombat();
  const target = getFirstEnemy(state);
  const result = executeAbility(state, 'my_ability', rng, target.id);
  assertFeatureChain(result, state, { eventType: 'ABILITY_USED' });
});
```
