# How to Add a New Ability

## Overview

Abilities are **data-driven** — define the ability as a declarative structure and the runtime handles execution, events, and UI automatically.

---

## Files to Touch

| Step | File | What to do |
|------|------|-----------|
| 1. Define | `packages/game-core/src/abilities/definitions/my-ability.ts` | Create `AbilityDefinition` |
| 2. Register | `packages/game-core/src/abilities/definitions/index.ts` | Add to `ALL_ABILITY_DEFINITIONS` |
| 3. (Optional) Legacy | `packages/content/src/abilities/index.ts` | Add to `ABILITY_DEFINITIONS` for backward compat |
| 4. Test | `packages/game-core/src/abilities/definitions/my-ability.test.ts` | Unit test the definition |

---

## Step 1: Create the Definition

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

## Step 2: Register in Index

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

- **By level** — `ABILITY_UNLOCK_BY_LEVEL` in `packages/content/src/abilities/index.ts`
- **By weapon mastery** — `MASTERY_ABILITIES` in same file
- **Programmatically** — `grantAbility(state, abilityId)` in `packages/game-core/src/systems/abilities.ts`

---

## Effect Handlers

Located in `packages/game-core/src/abilities/effects/`:

| Effect | Handler | What it does |
|--------|---------|-------------|
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
