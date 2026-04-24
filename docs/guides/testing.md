# Testing Guide

## Test Layers

| Layer | Location | Purpose | Config imports? |
|-------|----------|---------|-----------------|
| **Unit** | `src/**/*.test.ts` (colocated) | Single function/module | ❌ Use builders |
| **Property** | `src/**/*.property.test.ts` | Prove contracts across random states | ❌ Use builders |
| **Contract** | `tests/contracts/*.test.ts` | Config structure/integrity | ✅ Live config |
| **Integration** | `tests/integration/*.test.ts` | Multi-step game flows | ✅ Real engine |
| **Balance** | `tests/balance/*.test.ts` | Outcome distributions (100+ trials) | ✅ Real config |
| **E2E** | `tests/e2e/*.spec.ts` | Critical user journeys | ✅ Real server+UI |

---

## Anti-Patterns

### AP-1: Exact Value Assertions ❌
```typescript
// WRONG — breaks on any tuning
expect(calculateDamage(player, enemy)).toBe(25);

// RIGHT — survives tuning
expect(calculateDamage(player, enemy)).toBeGreaterThan(0);
```

### AP-2: Config Imports in Unit Tests ❌
```typescript
// WRONG — tight coupling to live config
import { PLAYER_STATS } from '@dungeon/content';

// RIGHT — use builders
const player = new PlayerBuilder().build();
```

### AP-3: Mixed Test Layers ❌
Don't use `GameEngine` in unit tests (that's integration). Don't test single functions in integration tests.

### AP-4: Unseeded Randomness ❌
Always use `SeededRng` — never `Math.random()`.

### AP-5: Missing Event Verification ❌
```typescript
// WRONG — state changes but player never sees it
expect(result.state.player.health).toBeLessThan(before.health);

// RIGHT — verify full chain
assertFeatureChain(result, before, { eventType: 'ATTACK_PERFORMED' });
```

### AP-6: Comparative Tests
Use high-vs-low comparisons instead of exact assertions for config-dependent values.

---

## Key Helpers

### Builders (`tests/support/builders/`)
```typescript
const player = new PlayerBuilder().withStats({ attack: 15 }).withLevel(5).build();
const enemy = new EnemyBuilder().withStats({ defense: 10 }).build();
```

### Seeded RNG (`tests/support/mocks/`)
```typescript
const rng = new SeededRng(42);  // Deterministic
```

### Feature Chain Helper (`packages/presenter/src/testing/feature-chain-helpers.ts`)
```typescript
assertFeatureChain(result, beforeState, { eventType: 'ITEM_USED' });
// Validates: state change → event emitted → event formatted → view exposes data
```

Additional helpers:
- `expectEventEmitted()` — assert specific event types
- `expectFormattedEvent()` — verify event formats to text
- `expectStatChanged()` — verify stat changes
- `expectAllEventsFormatted()` — all events can format

### Balance Simulation (`tests/support/helpers/balance-simulator.ts`)
```typescript
const results = runSeededSuccessSimulation((rng) => playerWon(rng), 100);
const winRate = successPercentage(results.trials);
expect(winRate).toBeGreaterThanOrEqual(40);
expect(winRate).toBeLessThanOrEqual(60);
```

Distribution analysis:
```typescript
const dist = assertDistribution(values);
dist.meanInRange(20, 30);           // Check mean
dist.allInRange(5, 50);             // Check all values
dist.percentageInRange(80, 10, 40); // Check percentage in range
```

---

## Writing a Test — Quick Start

1. **Choose layer** based on what you're testing
2. **Create file** in correct location:
   - Unit: `src/my-module.test.ts` (colocated with source)
   - Contract: `tests/contracts/my-contract.contract.test.ts`
   - Integration: `tests/integration/my-flow.integration.test.ts`
   - Balance: `tests/balance/my-balance.balance.test.ts`
3. **Use correct imports** — builders for unit, live config for contract/integration/balance
4. **Run** `pnpm test` to verify

---

## Unit Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './my-module.js';
import { PlayerBuilder, EnemyBuilder } from 'tests/support/builders';
import { SeededRng } from 'tests/support/mocks';

describe('myFunction', () => {
  it('handles normal case', () => {
    const player = new PlayerBuilder().build();
    const rng = new SeededRng(42);
    const result = myFunction(player, rng);
    expect(result).toBeGreaterThan(0);
  });
});
```

## Balance Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { runSeededSuccessSimulation, successPercentage } from 'tests/support/helpers';

describe('Balance: Combat', () => {
  it('player wins 40-60% of tier-1 encounters', () => {
    const results = runSeededSuccessSimulation(
      (rng) => simulateEncounter(rng),
      100,
    );
    const winRate = successPercentage(results.trials);
    expect(winRate).toBeGreaterThanOrEqual(40);
    expect(winRate).toBeLessThanOrEqual(60);
  });
});
```

---

## Before Committing a Test

- Uses correct layer (unit/contract/integration/balance)
- No `Math.random()` — use SeededRng
- No exact value assertions on config-dependent values
- No live config imports in unit tests
- Uses builders/fixtures for test objects
- Asserts behavior, not implementation
- `pnpm test` passes consistently

---

## E2E Tests

**Location:** `tests/e2e/*.spec.ts` — Playwright
**Pattern:** Page Object Model — `GamePage` class centralizes UI interactions
**Run:** `pnpm test:e2e` (auto-starts server + web)

See `tests/e2e/README.md` for E2E-specific patterns.
