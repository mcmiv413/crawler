---
name: test-workflow
description: Route creation or modification of tests through the repo's layer, proof, determinism, and validation checklist.
---

# Test Workflow

Use this skill whenever a task creates, modifies, reviews, or fixes tests.

## Checklist

1. Identify the test layer before editing: Unit, Property, Contract, Integration, Balance, or E2E.
2. Look up existing proof homes in `docs/feature-proofs.yml`, then classify every changed production surface before deciding which tests to add.
3. Use the cheapest sufficient layer. Prefer Vitest unit, contract, or integration tests over Playwright unless browser behavior is the thing being proven.
4. Add or preserve the test intent header with `Test layer`, `Behavior`, `Proof`, and `Validation`.
5. Unit and property tests must use local fixtures, builders, and seeded RNG. They must not import live `@dungeon/content` or construct `GameEngine`.
6. Live registry, content ID, schema, and cross-reference checks belong in contract tests.
7. Player-facing behavior must prove the visible chain: state change, event emitted, event formatted or presented, and `GameView` or UI output exposed.
8. Browser-facing changes need component proof or `pnpm test:e2e:scenario`; scenario fixture and E2E changes must record the focused Playwright command.
9. Persisted state shape changes need save compatibility proof, including historical fixtures when older saves must keep loading.
10. Do not add tests that only prove existence, truthiness, non-empty length, DOM presence, or canvas presence after a player action.
11. Do not use `Math.random()`, focused tests, or skipped tests without a nearby `test-quality: allow-skip - reason` comment.
12. Avoid exact numeric `.toBe(...)` assertions in tunable game-core runtime areas; use ranges, ordering, invariants, event shape, or state transitions.
13. Run the smallest relevant test command first, then `pnpm run check:feature-proofs`, then widen through `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate`.

## Guardrail

`pnpm run check:test-quality` enforces the deterministic subset of this checklist for new or changed test files only. `pnpm run check:feature-proofs` enforces that production feature changes are paired with matching proof files. Do not weaken changed-file scope to clean up legacy tests; use `pnpm run report:test-quality-baseline` and `docs/testing/weak-test-backlog.md` to track backlog cleanup.
