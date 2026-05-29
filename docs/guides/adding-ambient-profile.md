# How to Add a New Ambient Behavior Profile

## Overview

Ambient behavior profiles control how enemies move and interact when not in combat. They define idle movement patterns, grouping behavior, and animations.

---

## Quick Start

1. Create `packages/content/src/ambient-profiles/my-profile.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Assign to enemies
4. Test and commit

**That's it!** No manual index registration needed.

---

## Step 1: Create the Profile Definition

Create `packages/content/src/ambient-profiles/my-profile.ts`:

```typescript
import type { AmbientBehaviorProfile } from '@dungeon/contracts';

export const myProfile: AmbientBehaviorProfile = {
  id: 'wanderer',
  name: 'Wanderer',
  description: 'Slowly patrols an area.',
  
  movePattern: 'random_walk',        // 'random_walk', 'patrol', 'stationary', 'swarming'
  moveFrequency: 3,                  // Turns between moves (1 = every turn, 3 = every 3 turns)
  moveDistance: 2,                   // How far to move per action (tiles)
  
  groupBehavior: 'loose_pack',       // 'solitary', 'loose_pack', 'tight_pack', 'none'
  groupDistance: 5,                  // Distance to maintain from group (tiles)
  
  idleAnimation: 'sway',             // 'none', 'sway', 'pace', 'twitch'
  idleFrequency: 2,                  // Ticks per animation cycle
};
```

### Move Patterns

| Pattern | Behavior |
|---------|----------|
| `random_walk` | Wander randomly in all directions |
| `patrol` | Walk back and forth along a path |
| `stationary` | Stay in one place |
| `swarming` | Move toward group center |
| `fleeing` | Run away from player |

### Group Behaviors

| Behavior | Grouping |
|----------|----------|
| `solitary` | Enemies avoid each other |
| `loose_pack` | Small groups, 5-tile radius |
| `tight_pack` | Tightly grouped, 2-tile radius |
| `none` | No grouping behavior |

### Idle Animations

| Animation | Effect |
|-----------|--------|
| `none` | No animation, static |
| `sway` | Gentle side-to-side sway |
| `pace` | Walk in place |
| `twitch` | Random jerking movements |

---

## Step 2: Assign Profile to Enemies

In enemy templates, reference the profile:

```typescript
// packages/content/src/enemies/shadow-lurker.ts
export const shadowLurker: EnemyTemplate = {
  templateId: 'shadow_lurker',
  ambientBehaviorProfile: 'lurker',  // References the profile ID
  // ... other properties ...
};
```

---

## Common Profiles

| Profile | Pattern | Use Case |
|---------|---------|----------|
| Wanderer | Random walk | Typical dungeon creatures |
| Wall Lurker | Stationary + sway | Creatures that hide in walls |
| Swarmer | Swarming | Bees, spiders, coordinated groups |

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/ambient-profiles/` (individual files) |
| Movement logic | `packages/game-core/src/systems/ambient-behavior-engine.ts` |
| View projection | `packages/presenter/src/builders/map-view-builder.ts` |
| Enemy assignment | `packages/content/src/enemies/*.ts` |
