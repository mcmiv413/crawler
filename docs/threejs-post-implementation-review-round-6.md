# Three.js Overlay Post-Implementation Review - Round 6

Review basis:

- Plan: `.plan/threejs.md`
- Prior reviews:
  - `docs/threejs-post-implementation-review.md`
  - `docs/threejs-post-implementation-review-round-2.md`
  - `docs/threejs-post-implementation-review-round-3.md`
  - `docs/threejs-post-implementation-review-round-4.md`
  - `docs/threejs-post-implementation-review-round-5.md`

Review date: 2026-05-29

Branch/worktree: `threejs`

Bottom line: not acceptable. The core unit/component path is much healthier than the earlier rounds, and `pnpm validate` passes, but the branch still violates the locked scope and the actual browser proof for the MVP Three overlay is red. Passing the default validation gate is insufficient because the plan explicitly required Playwright/browser proof for visible overlay pixels.

## Validation Evidence

- `pnpm exec vitest run apps/web/src/rendering/three/three-effects.contract.test.ts` - passed, 4 tests.
- `pnpm exec vitest run apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx apps/web/src/hooks/useDungeonRenderState.test.ts apps/web/src/components/DungeonCanvas.test.tsx apps/web/src/components/DungeonPhase.test.tsx apps/web/src/sprites/canvas-renderer.test.ts` - passed, 144 tests.
- `pnpm exec playwright test tests/e2e/three-effects-overlay.spec.ts` - failed. The test reached the dungeon screen but could not find `data-testid="dungeon-map-container"` at `tests/e2e/three-effects-overlay.spec.ts:237`.
- `pnpm run check:fast` - passed with 7 warnings.
- `pnpm validate:quick` - passed; changed tests reported 199 passed.
- `pnpm validate` - passed; full test run reported 2029 passed, build passed, exports passed.

## Findings

### P0 - The branch scope is far outside the locked Three.js MVP

File/line:

- `.plan/threejs.md:7`
- `.plan/threejs.md:11`
- `.plan/threejs.md:37`
- `.plan/threejs.md:43`
- `.plan/threejs.md:46`
- `.plan/threejs.md:50`
- `apps/server/src/app.ts:1`
- `packages/game-core/src/engine/game-engine.ts:1`
- `packages/content/src/animation-refs/self.ts:1`
- `packages/presenter/src/game-view.ts:1`

Plan expectation:

The plan is a web-only overlay MVP. It explicitly says no gameplay rules, server behavior, persistence, map generation, combat math, pathfinding, primary renderer migration, or content animation-ref edits are part of this implementation.

Problem:

`git diff --shortstat main` reports `869 files changed, 65482 insertions(+), 17977 deletions(-)`. The server/core/content/presenter subset alone reports `501 files changed, 29565 insertions(+), 8696 deletions(-)`. The branch includes broad changes to server routes, persistence, game-core systems, content catalogs, presenter shape, generated indexes, tests, scripts, and docs beyond the Three overlay files.

Impact:

This cannot be reviewed as the approved Three.js overlay plan. The implementation may contain a valid overlay, but it is buried inside a branch that also changes runtime behavior and ownership boundaries the plan explicitly excluded. Any acceptance signal from this branch is contaminated by unrelated gameplay, content, persistence, and infrastructure churn.

Suggested fix:

Split or rebase the Three overlay work onto a branch whose diff contains only the plan-owned files: `apps/web/package.json`, `pnpm-lock.yaml`, web feature flag/rendering/canvas files, the specified docs, and the planned Three tests. Treat all game-core/server/content/persistence changes as separate plans or accepted deviations with their own reviews.

Missing validation:

No validation run proves the Three MVP independently from the unrelated 869-file branch diff.

### P0 - The required browser proof is red

File/line:

- `.plan/threejs.md:75`
- `.plan/threejs.md:76`
- `.plan/threejs.md:266`
- `.plan/threejs.md:284`
- `tests/e2e/three-effects-overlay.spec.ts:223`
- `tests/e2e/three-effects-overlay.spec.ts:237`

Plan expectation:

The Playwright spec must seed a dungeon run, use a real potion in the browser, verify overlay/canvas bounds, observe visible overlay pixels near the player, and prove click-through.

Problem:

`pnpm exec playwright test tests/e2e/three-effects-overlay.spec.ts` fails before the potion is used:

```text
Error: expect(locator).toBeVisible() failed
Locator: getByTestId('dungeon-map-container')
Expected: visible
Timeout: 5000ms
Error: element(s) not found
```

The error snapshot shows the dungeon heading, HUD, and action buttons, but not the expected map container.

Impact:

The MVP's only browser-level proof does not run. This is the exact acceptance story the plan added because mocked renderer tests cannot prove a real visible WebGL overlay.

Suggested fix:

Fix the E2E flow before handoff. Either repair the app/test selector mismatch, force the expected viewport/layout state, or add a stable map/canvas test id at the actual rendered surface. Then rerun the exact Playwright command and include the evidence.

Missing validation:

The Playwright command in the plan is currently failing, even though `pnpm validate` passes.

### P1 - The browser pixel assertion can pass without proving the Three overlay rendered

File/line:

- `.plan/threejs.md:76`
- `tests/e2e/three-effects-overlay.spec.ts:241`
- `tests/e2e/three-effects-overlay.spec.ts:264`
- `tests/e2e/three-effects-overlay.spec.ts:275`
- `apps/web/src/components/DungeonPhase.tsx:201`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:196`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:201`

Plan expectation:

The browser proof must observe visible overlay pixels for the Three-backed `fx.self.healing-pulse`, not just any visual change in the dungeon area.

Problem:

The spec takes a screenshot of the whole `dungeon-map-container` before the potion and later counts changed pixels in that same container. That container includes the primary 2D `DungeonCanvas`. The canvas is not told to skip the healing animation until the overlay reports initialization through `onInitialized`, so there is at least a transient path where the old canvas animation can create the changed pixels. On WebGL failure, the canvas fallback is also supposed to create changed pixels.

Impact:

After the line-237 failure is fixed, this test can still pass for the wrong renderer. It does not isolate WebGL canvas pixels, assert that canvas suppression is active before sampling, or prove the pixel delta came from `ThreeEffectsOverlay`.

Suggested fix:

Sample the overlay canvas specifically, or assert the parent has received the overlay-owned skip list before taking the post-potion screenshot. A stronger test should verify nontransparent/changed pixels on `data-testid="three-effects-overlay"` itself, while a separate fallback test verifies the canvas-only path when WebGL fails.

Missing validation:

No current browser assertion proves that the visible pulse pixels came from the WebGL overlay rather than the 2D canvas fallback.

### P1 - `DungeonCanvas` no longer preserves the previous click guard

File/line:

- `.plan/threejs.md:114`
- `.plan/threejs.md:181`
- `apps/web/src/components/DungeonCanvas.tsx:102`
- `apps/web/src/components/DungeonCanvas.tsx:112`
- `apps/web/src/components/DungeonCanvas.tsx:113`
- `apps/web/src/components/DungeonCanvas.tsx:115`

Plan expectation:

The `DungeonCanvas` refactor should receive shared render inputs and keep click handling unchanged.

Problem:

The current click path only returns when a found cell is non-walkable:

```ts
const cell = map.cells.find(c => c.x === grid.x && c.y === grid.y);
if (cell !== undefined && !cell.walkable) return;
```

The pre-refactor guard rejected missing cells and hidden cells before pathing. This implementation allows pathfinding to run for missing cells and hidden walkable cells.

Impact:

This is a primary renderer behavior regression independent of Three.js. It can allow click-to-move attempts into hidden or non-present map data, violating the plan's "click handling unchanged" constraint.

Suggested fix:

Restore the guard before `findPath`: reject `!cell`, `cell.visibility === 'hidden'`, and `!cell.walkable`. Add a `DungeonCanvas` click test covering hidden and missing-cell targets through the refactored prop-driven render path.

Missing validation:

The current component tests do not prove hidden or missing cells are rejected after the render-state extraction.

### P2 - The Three effect docs do not match the shipped module contract

File/line:

- `.plan/threejs.md:210`
- `.plan/threejs.md:217`
- `docs/guides/adding-animation.md:131`
- `docs/guides/adding-animation.md:135`
- `docs/guides/adding-animation.md:149`
- `docs/guides/adding-animation.md:247`
- `docs/guides/adding-animation.md:249`
- `apps/web/src/rendering/three/three-effect-types.ts:40`
- `apps/web/src/rendering/three/three-effect-types.ts:44`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:49`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:66`

Plan expectation:

The docs must teach contributors the new renderer boundary and the correct way to add a Three effect module.

Problem:

The example `ThreeEffectModule` in `adding-animation.md` omits the required `setPosition(...)` method, so it does not satisfy the current `ThreeEffectModule` type. It also creates `CircleGeometry(0.45)` without scaling it by `context.tileSize`, which is the sub-pixel pattern earlier review rounds rejected. The later positioning test expects `group.position.y` to equal the incoming y value, while the shipped healing pulse flips y with `canvasHeight - position.y`.

Impact:

A contributor following the docs will either fail typecheck, create an invisible/sub-pixel effect, or write a position test that contradicts the actual overlay coordinate convention.

Suggested fix:

Update the docs example to implement `setPosition`, size geometry in tile-relative pixel space, and document the y-axis flip exactly as the real `healing-pulse-effect` does. Keep the example aligned with `ThreeEffectModule` so copy-paste code typechecks.

Missing validation:

There is no docs/example validation that the documented Three module pattern compiles against the current type contract.

### P2 - Built-in effect registration mutates global registry state during render

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:96`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:98`
- `apps/web/src/rendering/three/effects/index.ts:31`
- `apps/web/src/rendering/three/effects/index.ts:39`
- `apps/web/src/rendering/three/three-effect-registry.ts:10`
- `apps/web/src/rendering/three/three-effect-registry.ts:12`

Plan expectation:

The Three registry should be a typed, testable foundation for effect lookup, and the overlay should be a presentation renderer fed by shared render inputs.

Problem:

`ThreeEffectsOverlay` calls `registerBuiltInThreeEffects()` inside `useMemo`, which mutates the module-level registry map during React render. The same built-ins are also registered at module load in `effects/index.ts`, so this is duplicate global mutation in the render path.

Impact:

The code works because registration is idempotent today, but it weakens the contract for future effects and tests. React render should be pure; global registry writes during render make StrictMode and test ordering harder to reason about.

Suggested fix:

Register built-ins once at module initialization, or pass a resolved registration list into the overlay without mutating global state during render. If duplicate registration remains intentional, document it and add a test for the duplicate-registration policy.

Missing validation:

No test asserts that rendering `ThreeEffectsOverlay` is free of registry side effects.

## Residual Risk

The implementation has made real progress on the previous renderer-wiring issues, but the acceptance bar for this plan is visual and browser-level. Until the Playwright proof is fixed and made overlay-specific, the branch still does not prove the actual MVP: a player-visible Three.js healing pulse centered on the player tile.
