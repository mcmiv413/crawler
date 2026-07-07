---
name: test-workflow
description: Route creation or modification of tests through the repo's layer, proof, determinism, and validation checklist.
---

# Test Workflow

Use this skill whenever a task creates, modifies, reviews, or fixes tests.

## Checklist

1. Identify the test layer before editing: Unit, Property, Contract, Integration, Balance, or E2E.
2. Use the cheapest sufficient layer. Prefer Vitest unit, contract, or integration tests over Playwright unless browser behavior is the thing being proven.
3. Add or preserve the test intent header with `Test layer`, `Behavior`, `Proof`, and `Validation`.
4. Unit and property tests must use local fixtures, builders, and seeded RNG. They must not import live `@dungeon/content` or construct `GameEngine`.
5. Live registry, content ID, schema, and cross-reference checks belong in contract tests.
6. Player-facing behavior must prove the visible chain: state change, event emitted, event formatted or presented, and `GameView` or UI output exposed.
7. Do not add tests that only prove existence, truthiness, non-empty length, DOM presence, or canvas presence after a player action.
8. Do not use `Math.random()`, focused tests, or skipped tests without a nearby `test-quality: allow-skip - reason` comment.
9. Avoid exact numeric `.toBe(...)` assertions in tunable game-core runtime areas; use ranges, ordering, invariants, event shape, or state transitions.
10. Run the smallest relevant test command first, then widen through `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate`.

## Guardrail

`pnpm run check:test-quality` enforces the deterministic subset of this checklist for new or changed test files only. Do not weaken the changed-file scope to clean up legacy tests.
