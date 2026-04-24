# How to Add a New Archetype (AI Behavior)

## Overview

Archetypes define how enemies behave in combat. They determine targeting strategy, ability usage, and tactical decisions. Each archetype has different decision trees for attack vs. defense.

---

## Quick Start

1. Create `packages/content/src/archetypes/my-archetype.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Assign archetype to enemies
4. Test and commit

**That's it!** No manual index registration needed.

---

## Step 1: Create the Archetype Definition

Create `packages/content/src/archetypes/my-archetype.ts`:

```typescript
import type { ArchetypeDefinition } from '@dungeon/contracts';

export const myArchetype: ArchetypeDefinition = {
  id: 'aggressive_melee',
  name: 'Aggressive Melee Fighter',
  description: 'Charges directly at enemies, using heavy attacks.',
  
  // Decision priorities (evaluated in order)
  decisionTree: {
    // High health: offensive
    conditions: [
      {
        name: 'high_hp',
        eval: (state, self) => self.health > self.maxHealth * 0.7,
        decisions: ['attack_main_target', 'use_ability'],
      },
      // Low health: defensive/flee
      {
        name: 'low_hp',
        eval: (state, self) => self.health < self.maxHealth * 0.3,
        decisions: ['move_away', 'use_defensive_ability'],
      },
    ],
    default: ['attack_main_target'],
  },
  
  targetingStrategy: 'highest_damage',  // Focus on most dangerous player
  fleeThreshold: 0.2,                   // Flee when below 20% HP
};
```

### Available Strategies

| Strategy | Behavior |
|----------|----------|
| `highest_damage` | Attack the enemy dealing most damage |
| `closest` | Attack the nearest target |
| `random` | Random target selection |
| `support_allies` | Heal/buff nearby allies |

---

## Step 2: Assign Archetype to Enemies

In enemy templates, reference the archetype:

```typescript
// packages/content/src/enemies/goblin-archer.ts
export const goblinArcher: EnemyTemplate = {
  templateId: 'goblin_archer',
  archetype: 'ranged_supportive',  // References the archetype ID
  // ... other properties ...
};
```

---

## Step 3: Wire Custom Behaviors (Optional)

For complex decision logic:

1. Add decision evaluator in `packages/game-core/src/systems/ai-decision.ts`
2. Add ability selection logic in `packages/game-core/src/systems/enemy-abilities.ts`
3. Add tactical modifiers (preferred targets, group behavior, etc.)

---

## Common Archetypes

| Archetype | Strategy | Use Case |
|-----------|----------|----------|
| Aggressive Melee | Charge and attack | Strong physical fighters |
| Cautious Ranged | Keep distance, attack from afar | Archers, casters |
| Skittish | Flee, summoning | Weak/support enemies |
| Hazard Creator | Summon traps/objects | Environmental threats |

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/archetypes/` (individual files) |
| AI decision logic | `packages/game-core/src/systems/ai-decision.ts` |
| Ability selection | `packages/game-core/src/systems/enemy-abilities.ts` |
| Enemy assignment | `packages/content/src/enemies/*.ts` |
| Tests | `packages/game-core/src/systems/ai-decision.test.ts` |
