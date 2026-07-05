# RPG Testing Guide

## Purpose

Tests define required behavior, not current implementation.

> For the tracked repo workflow, use `README.md` and `docs/guides/repo-skills.md`. This guide provides the layer rules, helpers, and examples that support that workflow.

For cross-project ownership rules, generated-index ownership, and presenter/UI boundaries, also read [Architecture Patterns](architecture-patterns.md).

AI assistants are allowed to generate test scaffolding, but every test must be reviewed for:
- correct layer
- deterministic setup
- meaningful assertions
- player-visible outcome validation
- no accidental coupling to tunable config

## Execution Workflow

1. Start with the smallest affected scope (`pnpm vitest run path/to/file.test.ts` or `pnpm test:changed`).
2. If a quiet run fails, rerun the failing scope with full output (`pnpm test:verbose`, targeted Vitest, and `.validate-logs/test.log`) before diagnosing.
3. Decide whether the failure is a real regression or a brittle test. Prefer fixing the test when it depends on tuned values, live config in the wrong layer, or implementation details.
4. Widen through the repo gates in order: `pnpm run check:fast`, then `pnpm validate:quick`, then `pnpm validate`.
5. Finish with `pnpm validate`. Focused test passes help you iterate, but they do not replace full validation.

## Command Map

| Need | Command |
|---|---|
| Fast-fail Vitest run | `pnpm test` |
| Balance-only Vitest run | `pnpm test:balance` |
| Full Vitest output | `pnpm test:verbose` |
| Changed-file Vitest scope | `pnpm test:changed` |
| Single Vitest file | `pnpm vitest run path/to/file.test.ts` |
| Root `tests/` single-file scope | `pnpm vitest run --config tests/vitest.config.ts tests/integration/foo.integration.test.ts` |
| Fast pre-commit gate | `pnpm run check:fast` |
| Local confidence gate | `pnpm validate:quick` |
| Tracked artifact guardrail | `pnpm run check:tracked-artifacts` |
| Workspace wiring guardrail | `pnpm run check:workspace-wiring` |
| Ability contract guardrail | `pnpm run check:ability-contracts` |
| Package export guardrail | `pnpm run check:exports` |
| Playwright only | `pnpm test:e2e` |
| Repo-wide test layer audit | `pnpm exec tsx scripts/audit-tests.ts` |
| Merge gate | `pnpm validate` |

## Audit Helper

Use `pnpm exec tsx scripts/audit-tests.ts` when you need a repo-wide layer map before or during an audit. It reports both the recognized layer (`Unit`, `Property`, `Contract`, `Integration`, `Balance`, `E2E`) and whether each file participates in the default workspace Vitest run.

The default merge gate excludes balance suites under `tests/balance/` and `packages/game-core/src/**/*.balance.test.ts`. Run `pnpm test:balance` when you need those suites.

`pnpm run check:ability-contracts` is intentionally invariant-based instead of snapshot-based: it validates live registry/schema alignment, command payload requirements, and animation coverage without forcing per-ability test updates every time new content is added.

Root `tests/` single-file runs should use `tests/vitest.config.ts`. The default workspace single-file filter does not reliably discover those files by path and can fail with `No test files found`.

## Deterministic Smoke Suite

Use the existing smoke scripts by failure class instead of building ad hoc one-off checks:

- `pnpm run check:tracked-artifacts` catches force-added or already tracked cache files, Zone.Identifier files, and source-map noise that `.gitignore` alone cannot prevent.
- `pnpm run check:audit-guardrails` catches deterministic review failures: ignored or untracked tests, tests that execute mocked subjects, optional backend static imports, copied generated/catalog refs, stale docs paths, and configured source-of-truth literal drift.
- `pnpm run check:workspace-wiring` catches undeclared workspace dependencies, `src`-internal imports across packages, and unexported workspace subpaths before the failure diffuses into later build or runtime noise.
- `pnpm run check:ability-contracts` catches live ability metadata, command payload, and animation coverage drift with invariant checks that do not require per-ability snapshots.
- `pnpm run check:exports` catches built-output and consumer-context package resolution failures that source-level tests can miss when local `dist/` state masks the problem.

This split is intentional: each script is cheap, deterministic, and points at a specific class of breakage. When `check:audit-guardrails` fails, fix the named pattern instead of adding broad allowlists:

- add ignored tests to a narrow `.gitignore` allowlist and git-track them
- test real subjects while mocking only their dependencies
- put optional backends behind dynamic imports
- dot-walk generated/catalog refs through source-of-truth exports
- update docs paths to real files or explicitly declared new files
- import configured constants from their owner module

## Three Animation Proof Stack

Use the matching proof layer for Three renderer work instead of relying on one broad smoke test:

1. **Docs compile fixture** - `apps/web/src/rendering/three/testing/three-animation-docs.fixture.ts` keeps the public module example type-checked.
2. **Module contract** - `apps/web/src/rendering/three/testing/run-three-animation-contract.ts` enforces visible geometry and disposal for individual `ThreeAnimationModule`s.
3. **Registry coverage** - `pnpm run check:three-animations` proves every live content `AnimationId` has a matching Three module registration and no unknown IDs are registered.
4. **Component ownership** - `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx` and `apps/web/src/components/DungeonPhase.test.tsx` verify lazy loading, ownership reporting, and fallback suppression.
5. **Browser proof** - `tests/e2e/three-animation-backend.spec.ts` samples `data-testid="three-animation-overlay"` with `gl.readPixels()` and proves movement, bump/attack, projectile, impact, aoe, self/consumable, status pulse, combat label, defender-hit flash, pointer safety, forced WebGL failure fallback, and the negative canvas-only assertion.

Do not treat a canvas-only screenshot or DOM-presence check as sufficient evidence for the WebGL backend. The browser proof must exercise the overlay canvas itself.

## Presenter/Web Hotspot Seams

When a regression sits between `game-core`, `presenter`, and `apps/web`, extend the existing hotspot proof homes before reaching for new browser flows:

- `packages/presenter/src/game-view-builder.test.ts`
- `packages/presenter/src/game-view-builder-coverage.test.ts`
- `packages/presenter/src/animation-sequence.test.ts`
- `apps/web/src/components/DungeonPhase.test.tsx`
- `apps/web/src/components/DungeonCanvas.test.tsx`
- `apps/web/src/components/TownPhase.test.tsx`

These files cover the churn-heavy seam where `GameState` becomes `GameView`, animation metadata becomes renderer events, and town/dungeon components consume the presenter output. They are the cheapest place to catch presenter propagation gaps, impact-animation ordering drift, and render-guard regressions before the failure escapes into broader integration churn.

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

**MERGE-BLOCKING AUDIT:** Unit and property tests must NOT import live `@dungeon/content` or build large integrated state. Use builders (PlayerBuilder, EnemyBuilder, SeededRng) or local fixtures instead. Live-registry checks belong in contract suites. This is enforced by `check:audit-guardrails` and blocks merge.

1. No `Math.random()` in tests. Use `SeededRng`.
2. No live config imports in unit/property tests. Use builders.
3. No exact assertions on tunable values. Numeric literal `.toBe(...)` is only auto-blocked today in `packages/game-core/src/systems/**/*.test.ts` through `dungeon/no-numeric-toBe`; elsewhere, treat exact tunable assertions as brittle review failures and prefer range or comparative checks.
4. No weak assertions such as `toBeDefined()` unless existence is the actual requirement.
5. No state-only assertions for player-facing behavior.
6. Any state change the player should notice must verify the full chain:
   `state change → event emitted → event formatted → view exposes data`
7. Any feature referencing content IDs must have contract coverage.
8. Tests must validate intended behavior, not mirror implementation details.
9. Do not mix layers. If a test needs `GameEngine`, it is not a unit test.
10. Prefer one clear requirement per test.
11. Generated-index and live-registry checks belong in contract tests, not unit/property tests.

## Anti-Patterns

### Exact Tunable Values

```ts
// Wrong
expect(calculateDamage(player, enemy)).toBe(25);

// Right
expect(calculateDamage(player, enemy)).toBeGreaterThan(0);
```

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
  entryCheck: (before) => buildGameView(before).availableActions.some((action) => action.id === 'use_item'),
  uiCheck: (view) => view.inventory.items.some((item) => item.itemId === itemId),
});
```

Expected chain:

* entry point is triggerable when `entryCheck` is provided
* state changed
* event emitted
* event formatted when `formattingCheck` is provided
* `GameView` exposes the UI-facing result when `viewChecks` or `uiCheck` are provided
* actual React rendering stays in component tests

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
* generated registries or catalog indexes need live integrity coverage

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

#### Scenario-driven browser tests

Use an authored fixture with `ScenarioPage.load(page, scenarioName, layoutPreset)` when the behavior requires a real browser: canvas rendering, responsive layout, session restore, keyboard or pointer interaction, or player-visible UI feedback. The helper restores the fixture through the server and initializes the browser session before the app boots, so tests do not need to create a game, explore a generated map, or search for content.

Keep engine behavior in Vitest contract or integration tests. Fixture validity, command results, state transitions, save/load equivalence, and presenter output are deterministic non-browser concerns. Playwright complements those tests; it does not replace them.

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

**Convention:** The validation script (`scripts/typecheck-tests.mjs`) type-checks test files and their cross-package path-alias imports, filters only the expected TS6059 `rootDir` diagnostics, and reports all other type errors. Test `tsconfig.test.json` files use `rootDir: "."` to define the test package's source boundary.

If `pnpm validate` shows a warning like:
```
✓ packages/content (21 cross-package TS6059 ignored)
```

This is normal and expected. It means 21 diagnostic messages about cross-package imports were filtered out, but no actual type errors exist.

## Validation Commands

Use `pnpm test` for fast-fail validation and `pnpm test:verbose` when you need the full failing set.

```bash
pnpm test
pnpm test:verbose
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
