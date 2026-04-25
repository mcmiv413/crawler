# RPG Testing Guide

## Purpose

Tests define required behavior, not current implementation.

AI assistants are allowed to generate test scaffolding, but every test must be reviewed for:
- correct layer
- deterministic setup
- meaningful assertions
- player-visible outcome validation
- no accidental coupling to tunable config

## Test Layer Decision

| Question | Layer | Location |
|---|---|---|
| Testing one pure function or module? | Unit | `src/**/*.test.ts` |
| Testing invariants across many inputs? | Property | `src/**/*.property.test.ts` |
| Validating live content/config integrity? | Contract | `tests/contracts/*.contract.test.ts` |
| Testing multi-step engine behavior? | Integration | `tests/integration/*.integration.test.ts` |
| Testing statistical tuning outcomes? | Balance | `tests/balance/*.balance.test.ts` |
| Testing browser/user journeys? | E2E | `tests/e2e/*.spec.ts` |

## Layer Rules

| Layer | Live config? | Real engine? | Assert |
|---|---:|---:|---|
| Unit | No | No | Function behavior |
| Property | No | No | Always-true invariants |
| Contract | Yes | No | IDs, schemas, references |
| Integration | Yes | Yes | Game-flow outcomes |
| Balance | Yes | Yes | Distributions/ranges |
| E2E | Yes | Yes | User-visible behavior |

## Hard Rules

1. No `Math.random()` in tests. Use `SeededRng`.
2. No live config imports in unit/property tests. Use builders.
3. No exact assertions on tunable values.
4. No weak assertions such as `toBeDefined()` unless existence is the actual requirement.
5. No state-only assertions for player-facing behavior.
6. Any state change the player should notice must verify the full chain:
   `state change → event emitted → event formatted → view exposes data`
7. Any feature referencing content IDs must have contract coverage.
8. Tests must validate intended behavior, not mirror implementation details.
9. Do not mix layers. If a test needs `GameEngine`, it is not a unit test.
10. Prefer one clear requirement per test.

## Anti-Patterns

### Exact Tunable Values

```ts
// Wrong
expect(calculateDamage(player, enemy)).toBe(25);

// Right
expect(calculateDamage(player, enemy)).toBeGreaterThan(0);
````

### Live Config in Unit Tests

```ts
// Wrong
import { PLAYER_STATS } from '@dungeon/content';

// Right
const player = new PlayerBuilder().build();
```

### Unseeded Randomness

```ts
// Wrong
const roll = Math.random();

// Right
const rng = new SeededRng(42);
```

### Weak Assertions

```ts
// Wrong
expect(result).toBeDefined();

// Right
expect(result.events).toContainEqual(
  expect.objectContaining({ type: 'ATTACK_PERFORMED' }),
);
```

### State Without Player-Visible Output

```ts
// Wrong
expect(result.state.player.health).toBeLessThan(before.player.health);

// Right
assertFeatureChain(result, before, { eventType: 'ATTACK_PERFORMED' });
```

### Missing Content Contract

```ts
// Wrong
targetItemId: 'leather_armor'; // not verified

// Right
expect(ITEM_BY_ID[quest.targetItemId]).toBeDefined();
```

## Required Helpers

### Builders

Use builders for unit/property tests.

```ts
const player = new PlayerBuilder()
  .withStats({ attack: 15 })
  .withLevel(5)
  .build();

const enemy = new EnemyBuilder()
  .withStats({ defense: 10 })
  .build();
```

### Seeded RNG

```ts
const rng = new SeededRng(42);
```

### Feature Chain

Use when behavior should be visible to the player.

```ts
assertFeatureChain(result, beforeState, {
  eventType: 'ITEM_USED',
});
```

Expected chain:

* state changed
* event emitted
* event formatted
* view exposes the result

### Balance Simulation

```ts
const results = runSeededSuccessSimulation(
  (rng) => playerWon(rng),
  100,
);

const winRate = successPercentage(results.trials);

expect(winRate).toBeGreaterThanOrEqual(40);
expect(winRate).toBeLessThanOrEqual(60);
```

### Distribution Assertions

```ts
const dist = assertDistribution(values);

dist.meanInRange(20, 30);
dist.allInRange(5, 50);
dist.percentageInRange(80, 10, 40);
```

## When to Write Contract Tests

Write a contract test when:

* a feature references item IDs, enemy IDs, ability IDs, biome IDs, quest IDs, or faction IDs
* content in one package references content in another package
* invalid references would make a feature invisible, broken, or impossible to complete
* AI generated or modified content references

Contract tests should use live config.

Contract tests should not test:

* game logic
* exact tuning values
* multi-step player behavior
* UI behavior

## Templates

### Unit Test

```ts
import { describe, expect, it } from 'vitest';
import { myFunction } from './my-module.js';
import { PlayerBuilder } from 'tests/support/builders';
import { SeededRng } from 'tests/support/mocks';

describe('myFunction', () => {
  it('produces a valid outcome', () => {
    const player = new PlayerBuilder().build();
    const rng = new SeededRng(42);

    const result = myFunction(player, rng);

    expect(result).toBeGreaterThan(0);
  });
});
```

### Contract Test

```ts
import { describe, expect, it } from 'vitest';
import { ITEM_BY_ID, ALL_QUESTS } from '@dungeon/content';

describe('quest content references', () => {
  it('all quest target item IDs exist', () => {
    for (const quest of ALL_QUESTS) {
      if (quest.targetItemId !== undefined) {
        expect(ITEM_BY_ID[quest.targetItemId]).toBeDefined();
      }
    }
  });
});
```

### Integration Test

```ts
import { describe, it } from 'vitest';
import { assertFeatureChain } from '@dungeon/presenter/testing';

describe('combat flow', () => {
  it('attacking an enemy produces a player-visible event', () => {
    const before = createTestState();
    const result = engine.attack(before, enemyId);

    assertFeatureChain(result, before, {
      eventType: 'ATTACK_PERFORMED',
    });
  });
});
```

### Balance Test

```ts
import { describe, expect, it } from 'vitest';
import {
  runSeededSuccessSimulation,
  successPercentage,
} from 'tests/support/helpers';

describe('balance: tier-1 combat', () => {
  it('player win rate stays within expected bounds', () => {
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

### E2E Test

```ts
import { expect, test } from '@playwright/test';
import { GamePage } from './support/GamePage';

test('player can complete a basic encounter', async ({ page }) => {
  const game = new GamePage(page);

  await game.start();
  await game.attack();

  await expect(game.log).toContainText('ATTACK');
});
```

## AI Assistant Rules

When asking an AI assistant to write or modify tests, require it to:

1. State the selected test layer.
2. Explain why that layer is correct.
3. Avoid live config unless the layer allows it.
4. Use builders for unit/property tests.
5. Use seeded RNG for all randomness.
6. Avoid exact assertions on tunable values.
7. Verify player-visible output for player-facing behavior.
8. Add contract tests for new content references.
9. Strengthen weak assertions.
10. Run or name the exact validation command.

Reject AI-generated tests that:

* only assert existence
* duplicate implementation logic
* import live config in unit tests
* pass with broken behavior
* rely on random outcomes
* freeze balance values unnecessarily

## Type-Checking in Monorepos

TypeScript's `rootDir` validation in monorepos with cross-package path aliases produces TS6059 warnings when test files import from modules in sibling packages. This is expected and not an error.

**Convention:** The validation script (`scripts/typecheck-tests.mjs`) ignores TS6059 warnings and only reports real type errors. Test `tsconfig.test.json` files use `rootDir: "."` to validate test-package-local files, and cross-package imports via path aliases are excluded from validation.

If `pnpm validate` shows a warning like:
```
✓ packages/content (21 cross-package TS6059 ignored)
```

This is normal and expected. It means 21 diagnostic messages about cross-package imports were filtered out, but no actual type errors exist.

## Validation Commands

```bash
pnpm test
pnpm test:e2e
pnpm validate
```

## Pre-Commit Checklist

* Correct layer selected
* No mixed-layer tests
* No `Math.random()`
* No live config in unit/property tests
* Builders used where required
* Assertions verify behavior
* No exact assertions on tunable values
* Player-visible behavior validates events/output
* Content references covered by contract tests
* Tests pass consistently
