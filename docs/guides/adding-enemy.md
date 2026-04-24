# How to Add a New Enemy

## Overview

Enemies are defined as **templates** in the content package. Spawning, AI, and UI rendering happen automatically based on the template's properties.

---

## Quick Start

1. Create `packages/content/src/enemies/my-enemy.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Add sprite mapping in dawnlike-name-map.ts
4. Test and commit

**That's it!** No manual index registration needed.

---

## Files to Touch

| Step | File | What to do |
|------|------|-----------|
| 1. Define | `packages/content/src/enemies/my-enemy.ts` | Create `EnemyTemplate` |
| 2. Index | Run `pnpm generate:indexes` | Auto-registers in `packages/content/src/enemies/index.ts` |
| 3. Sprite map | `packages/content/src/sprites/dawnlike-name-map.ts` | Map `'enemy:my_enemy'` → atlas name |
| 4. (Optional) Abilities | `packages/game-core/src/systems/enemy-abilities.ts` | Add to `ENEMY_ABILITY_DEFINITIONS` |
| 5. Test | Write tests for any custom abilities |

---

## Step 1: Create the Template

Create `packages/content/src/enemies/my-enemy.ts`:

```typescript
import type { EnemyTemplate } from '@dungeon/contracts';

export const myEnemy = {
  templateId: 'my_enemy',
  name: 'My Enemy',
  archetype: 'aggressive_melee',   // AI behavior (see Archetypes below)
  tier: 2,                         // Difficulty tier (1-3+)
  stats: {
    maxHealth: 30,
    health: 30,
    attack: 8,
    defense: 4,
    accuracy: 70,
    evasion: 10,
    speed: 5,
  },
  equipment: {
    weapon: { baseDamage: 6, damageType: 'physical' },
  },
  affinities: {                    // Damage resistances/vulnerabilities
    fire: -0.3,                    // Negative = vulnerable (130% damage)
    frost: 0.2,                    // Positive = resistant (80% damage)
  },
  spawn: { weight: 1.0 },         // Relative spawn frequency
  lootTableId: 'standard',
  experienceValue: 15,
  description: 'A dangerous creature.',
  ascii: 'M',                     // Fallback ASCII character
  color: '#ff4444',               // Fallback color
  spriteName: 'my_enemy',         // References sprite-map entry
  biomes: [{ biomeId: 'stone_crypt' }],  // Which biomes it spawns in
  factions: [],                    // Optional faction membership
} satisfies EnemyTemplate;
```

---

## Step 2: Add Sprite Mapping

Update `packages/content/src/sprites/dawnlike-name-map.ts`:

```typescript
'enemy:my_enemy': 'skeleton',  // Use closest DawnLike atlas name
```

Search the atlas for available sprites:
```bash
grep "your term" packages/content/src/sprites/dawnlike-atlas-raw.ts
```

---

## Archetypes (AI Behavior)

Defined in `packages/content/src/archetypes/`:

| Archetype | Behavior |
|-----------|----------|
| `aggressive_melee` | Charges player, attacks in melee |
| `skittish_ranged` | Keeps distance, uses ranged attacks |
| `cautious_defensive` | Defensive, retreats when hurt |
| `ambusher` | Waits, strikes when player is close |
| `hazard_creator` | Places traps/hazards |

To add a new archetype: create file in `packages/content/src/archetypes/`, export `ArchetypeDefinition`.

---

## Enemy Abilities (Optional)

Add to `ENEMY_ABILITY_DEFINITIONS` in `packages/game-core/src/systems/enemy-abilities.ts`:

```typescript
'my_special_attack': {
  damageMultiplier: 1.5,
  damageType: 'fire',
  range: 1,
  cooldown: 3,
  statusId: 'burning',
  statusDuration: 2,
},
```

Then reference in the template's `abilities` field.

---

## What Happens Automatically

- **Spawning** — `floor-populator.ts` selects from biome pool, applies tier gating by floor depth
- **AI decisions** — `enemy-ai.ts` uses archetype to score actions (attack, move, retreat, use ability)
- **Stat scaling** — `instantiateEnemy()` scales stats by dungeon depth
- **UI rendering** — `map-view-builder.ts` resolves sprite from template
- **Combat** — damage system uses stats, affinities, and equipment automatically

---

## Tier Gating by Floor

| Floors | Tiers allowed |
|--------|--------------|
| 1-2 | Tier 1 only |
| 3-4 | Tier 1-2 |
| 5+ | All tiers |

---

## Key Types

- `EnemyTemplate` — `packages/game-contracts/src/types/enemy.ts`
- `EnemyInstance` — Runtime instance with position, statuses, cooldowns
- `EnemyStats` — maxHealth, health, attack, defense, accuracy, evasion, speed
- `ArchetypeDefinition` — AI behavior rules
