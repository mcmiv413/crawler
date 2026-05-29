# How to Add a New Status Effect

## Overview

Status effects are temporary conditions like poison, burn, slow, and regeneration. They modify stats, deal damage over time, or provide buffs.

---

## Quick Start

1. Create `packages/content/src/statuses/my-status.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Add game logic if needed
4. Test and commit

**That's it!** No manual index registration needed.

If the status uses an overlay animation, define or update the referenced animation ref in `packages/content/src/animation-refs/` with `durationMs`, `impactFrameMs`, and `recoveryMs`, then run `pnpm generate:indexes`.

---

## Step 1: Create the Definition

Create `packages/content/src/statuses/my-status.ts`:

```typescript
import type { StatusDefinition } from './types.js';

export const myStatus: StatusDefinition = {
  id: 'poisoned',
  name: 'Poison',
  description: 'Takes damage each turn from toxins.',
  
  stackable: false,                // Can multiple instances stack?
  beneficial: false,               // Is this a buff or debuff?
  
  tickEffect: 'damage',            // 'damage', 'heal', or 'none'
  tickMagnitudeKey: 'poison.damagePerTurn',  // Config key for amount
  
  modifiesStat: null,              // Which stat does it affect? (null = none)
  statMultiplierKey: null,         // Config key for multiplier
};
```

### Status Configuration Fields

| Field | Purpose |
|-------|---------|
| `tickEffect` | What happens each turn: `'damage'`, `'heal'`, or `'none'` |
| `tickMagnitudeKey` | Points to balance table (e.g., `'poison.damagePerTurn'`) |
| `modifiesStat` | Which stat to modify: `'attack'`, `'defense'`, `'speed'`, or `null` |
| `statMultiplierKey` | Points to stat multiplier in balance table |
| `stackable` | Can you have multiple instances? |
| `beneficial` | Is this a buff (beneficial=true) or debuff (false)? |

### Common Status Effects

| Status | Tick Effect | Modifies Stat |
|--------|------------|---------------|
| Poison | Damage | — |
| Burn | Damage | — |
| Bleed | Damage | — |
| Slow | None | Speed (reduced) |
| Weaken | None | Attack (reduced) |
| Vulnerability | None | Defense (reduced) |
| Regeneration | Heal | — |
| Strength | None | Attack (boosted) |

---

## Step 2: Wire Game Logic (if needed)

For existing tick effects (damage/heal), the system handles application automatically.

For custom effects:
1. Add handler in `packages/game-core/src/systems/status-effects.ts`
2. Wire into turn scheduler in `packages/game-core/src/engine/turn-scheduler.ts`
3. Add event type in `packages/game-contracts/src/events/index.ts`
4. Add event formatter in `packages/presenter/src/event-formatter.ts`

---

## Balance Configuration

Status magnitudes are configured in `packages/content/src/balance/tables.ts`:

```typescript
poison: {
  damagePerTurn: 5,
},
slow: {
  speedMultiplier: 0.6,  // 60% of normal speed
},
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/statuses/` (individual files) |
| Animation refs | `packages/content/src/animation-refs/` |
| Balance config | `packages/content/src/balance/tables.ts` |
| Game logic | `packages/game-core/src/systems/status-effects.ts` |
| Turn handling | `packages/game-core/src/engine/turn-scheduler.ts` |
| Tests | `packages/game-core/src/systems/status-effects.test.ts` |
