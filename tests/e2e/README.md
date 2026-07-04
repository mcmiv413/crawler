# Browser E2E confidence suite

Playwright E2E tests cover behavior that requires a real browser: user interactions, session restore, responsive layout, canvas or WebGL rendering, and visible feedback after commands. Logic that can be proven without a browser belongs in the unit, property, contract, integration, or balance layers.

## Test doctrine

- Use `ScenarioPage.load` with a deterministic fixture from `fixtures/scenarios/` for gameplay states. Do not explore randomly or depend on generated encounters.
- Assert both the structured command request/response and the resulting visible UI state. Parse request bodies with `postDataJSON()` or `JSON.parse`; never match raw `postData()` substrings.
- Use Playwright auto-waiting assertions such as `toBeVisible`, `toContainText`, and `expect.poll` instead of fixed delays. A `waitForTimeout` is allowed only when elapsed time is the behavior under test and the line carries the audit allowlist comment.
- Required controls are required. Do not catch failures or conditionally skip the rest of a test when a button, panel, enemy, or item is unavailable.
- Avoid broad body-text checks and assertions that only prove the page did not crash. A “game stayed alive” test is appropriate only for a named crash regression with a specific trigger and outcome.
- Keep smoke coverage small. One smoke test should prove one critical startup path, not replay a full game.

`ScenarioPage` restores an isolated server session, installs it in browser session storage, applies a named layout preset, and waits for the expected phase. Its `actionButton`, `waitForCommand`, and `commandJson` helpers provide escaped action labels and structured command assertions.

## Naming and tags

- `@smoke` in the test title: tiny startup checks run by the smoke script.
- `scenario` in the test title or filename: deterministic scenario-driven gameplay.
- `layout` in the title: responsive reachability or overflow coverage.
- `renderer` in the title: canvas/WebGL rendering behavior, including intentional visual comparisons.

These terms are grep contracts. Keep them in test titles when adding matching coverage.

## Commands

```bash
pnpm test:e2e:smoke     # titles containing @smoke
pnpm test:e2e:scenario  # titles containing scenario
pnpm test:e2e:full      # complete Playwright suite
pnpm test:e2e:ui        # Playwright UI mode
pnpm audit:tests         # test-layer and anti-pattern audit
```

The Playwright app defaults to `http://localhost:8180/`. The API base is resolved through `E2E_API_BASE`; both servers are started by `playwright.config.ts` unless a reusable API server is already running.

## Adding coverage

1. Choose the narrowest test layer first; use E2E only for browser-only confidence.
2. Add or reuse a deterministic scenario fixture and load it with `ScenarioPage.load`.
3. Trigger one user-visible behavior through the real UI.
4. Capture the matching command by parsed request type, assert its response events, and assert the specific visible result.
5. Use a layout preset when viewport behavior is part of the contract.
6. Run the focused grep script, then the repository validation gates.

Failure traces and the HTML report are written by Playwright. Use `pnpm exec playwright test --debug` for interactive diagnosis.
