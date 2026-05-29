# Three.js Overlay Post-Implementation Review - Round 4

Review basis:

- Plan: `.plan/threejs.md`
- Prior reviews:
  - `docs/threejs-post-implementation-review.md`
  - `docs/threejs-post-implementation-review-round-2.md`
  - `docs/threejs-post-implementation-review-round-3.md`

Review date: 2026-05-29

Branch/worktree: `threejs`

Scope note: `git diff --name-status main...HEAD` currently reports an 867-file branch diff, far beyond the Three MVP plan. This review focuses on the current Three overlay repair set and the files touched after round 3. If the PR target is actually `main`, the broad branch scope is itself a blocker against the locked plan's "game-core/server/content stay untouched" boundary.

Bottom line: the branch is still not acceptable. The latest pass fixed the absolute overlay anchoring and added a parent callback for canvas suppression, but the player-visible MVP remains unproven and likely still effectively invisible. The new tests are green because they assert DOM presence and object shape, not visible pixels, effect timing, or fallback ownership.

## Validation Evidence During Review

- `pnpm vitest run apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts apps/web/src/hooks/useDungeonRenderState.test.ts apps/web/src/components/DungeonPhase.test.tsx apps/web/src/sprites/canvas-renderer.test.ts` - passed, 107 tests.
- `pnpm run check:fast` - passed with warnings.
- `pnpm validate:quick` - passed; changed tests reported 181 passed.
- `pnpm validate` - passed; full test run reported 2011 passed, build passed, and package exports passed.

Important warning from `check:fast`:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:162` - the renderer initialization effect is missing `consumableAnimations`, `fxAnimations`, and `onInitialized` dependencies.

## Findings

### P0 - The healing pulse is still effectively sub-pixel sized

File/line:

- `apps/web/src/rendering/three/three-renderer-factory.ts:45`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:124`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:129`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:130`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:131`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:132`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:16`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:29`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:43`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:45`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts:44`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts:54`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts:55`

Plan expectation:

- `.plan/threejs.md:7` - MVP renders a player-visible Three.js healing pulse.
- `.plan/threejs.md:55` - the pulse is centered on the player tile.
- `.plan/threejs.md:154` - the module renders visible pulse/expand/fade behavior with orthographic alignment.

Problem:

The camera is configured in screen-pixel coordinates: `0..canvasWidth` and `0..canvasHeight`. The effect then creates `CircleGeometry(0.4)` and scales its group by `context.tileSize / 16`. With the current `CELL_SIZE = 24`, the maximum radius is `0.4 * 1.5 = 0.6` screen pixels, not 40% of a 24px tile.

The new effect test encodes the same unit mistake. It calls this "40% of a tile" while calculating only Three world units and using a fixture `tileSize` of 16, where the group scale becomes 1.0 and the asserted radius remains 0.4. It never proves a pixel-visible radius.

Impact:

The Three effect can technically be instantiated and rendered but still be invisible or indistinguishable from a tiny dot. This is the MVP acceptance story, so green tests are not enough.

Suggested fix:

Use the same unit system as the camera. For example, create geometry with a pixel radius derived from `context.tileSize * 0.4`, or keep unit geometry and scale the group by `context.tileSize`, not `context.tileSize / 16`. Add a test that asserts the final world/screen radius is approximately `0.4 * tileSize`, and add screenshot or canvas-pixel verification that the pulse is visible.

Missing validation:

No automated or manual evidence proves visible pixels for `fx.self.healing-pulse` with `VITE_THREE_EFFECTS=true`.

### P1 - The overlay ignores the animation state's actual progress

File/line:

- `apps/web/src/hooks/useConsumableAnimationState.ts:4`
- `apps/web/src/hooks/useConsumableAnimationState.ts:6`
- `apps/web/src/hooks/useConsumableAnimationState.ts:7`
- `apps/web/src/hooks/useFxAnimationState.ts:4`
- `apps/web/src/hooks/useFxAnimationState.ts:6`
- `apps/web/src/hooks/useFxAnimationState.ts:7`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:190`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:206`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:207`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:208`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:234`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:235`

Plan expectation:

- `.plan/threejs.md:17` - the overlay shares the same presentation inputs as `DungeonCanvas`.
- `.plan/threejs.md:103` - one source of truth for animation state.
- `.plan/threejs.md:154` - visible pulse/expand/fade behavior follows the active animation.

Problem:

The active hooks already provide `startTime` and `progress`, but `ThreeEffectsOverlay` starts its own clock with `performance.now()` when the effect instance is first created. First-time lazy import, Suspense resolution, WebGL initialization, or React scheduling can all happen after the consumable animation started. The Three pulse then restarts from progress 0 instead of rendering the current animation progress.

Impact:

The Three effect can lag, restart, or be cut off when the hook removes the animation at the original duration. Canvas and Three no longer describe the same player-visible event. This is especially risky on first use, exactly when the lazy Three chunk is loaded.

Suggested fix:

Drive `module.update(...)` from `anim.progress`, or derive progress from the hook-provided `startTime` rather than a new overlay-local start time. The overlay instance can still own object lifecycle, but timing must come from the shared animation state.

Missing validation:

Add a RAF-driven component test where the first frame starts with `anim.progress = 0.5` and assert the module receives `0.5`, not a near-zero overlay-local progress.

### P1 - Canvas fallback ownership can go stale after overlay teardown or flag changes

File/line:

- `apps/web/src/components/DungeonPhase.tsx:109`
- `apps/web/src/components/DungeonPhase.tsx:183`
- `apps/web/src/components/DungeonPhase.tsx:187`
- `apps/web/src/components/DungeonPhase.tsx:202`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:84`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:85`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:86`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:87`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:100`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:101`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:143`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:158`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:160`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:162`

Plan expectation:

- `.plan/threejs.md:36` - WebGL initialization failure falls back to canvas-only behavior.
- `.plan/threejs.md:193` through `.plan/threejs.md:199` - skip `fx.self.healing-pulse` only when the overlay path is active.
- `.plan/threejs.md:284` - canvas renders the same animation when the feature is disabled or WebGL setup fails.

Problem:

`DungeonPhase` stores `handledAnimationIds` and always passes it into `DungeonCanvas`. The overlay only reports `onInitialized([])` on renderer creation failure. It does not clear ownership when `shouldRender` becomes false, when the overlay unmounts after animations finish, or when `threeEnabled` later becomes false and the overlay is not mounted at all. The initialization effect also omits `consumableAnimations`, `fxAnimations`, and `onInitialized` from its dependency list, which means the callback can report stale handled IDs for future effects.

Impact:

After one successful overlay initialization, the canvas skip list can persist outside the lifetime of the overlay. A later feature-flag disable, no-overlay period, or subsequent WebGL failure can suppress the canvas fallback for `fx.self.healing-pulse`, producing a missing animation instead of the required fallback.

Suggested fix:

Make ownership explicit in the parent. Clear `handledAnimationIds` whenever `threeEnabled` is false, `useSprites` is false, or no active handled animation exists. Have the overlay report success and failure for the current handled IDs and clear ownership in cleanup. Include the active animation ID set in the effect dependencies or compute ownership outside the renderer initialization effect.

Missing validation:

Add a `DungeonPhase` test that exercises: flag off after prior overlay success, overlay unmount after animation end, first renderer success followed by later renderer failure, and verifies the exact `skipHandledAnimationIds` passed to `renderMap`.

### P1 - The shared render hook still drops movement camera offset

File/line:

- `apps/web/src/hooks/useDungeonRenderState.ts:28`
- `apps/web/src/hooks/useDungeonRenderState.ts:29`
- `apps/web/src/hooks/useDungeonRenderState.ts:42`
- `apps/web/src/hooks/useDungeonRenderState.ts:55`
- `apps/web/src/hooks/useDungeonRenderState.ts:58`
- `apps/web/src/hooks/useDungeonRenderState.ts:59`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:94`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:109`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:122`

Plan expectation:

- `.plan/threejs.md:17` - existing viewport origin and camera offset calculation are shared from `MapDisplay`, not duplicated or lost.
- `.plan/threejs.md:103` - one source of truth for viewport origin and camera offset.
- `.plan/threejs.md:113` - `useDungeonRenderState` returns `cameraOffset`.
- `.plan/threejs.md:117` - current sprite behavior is unchanged with the feature flag off.

Problem:

The hook reads `moveAnimations` but always returns `{ x: 0, y: 0 }`. The comment explicitly says movement animation pixel-pan logic is future work. That is not a completed implementation of the approved plan; it is a TODO in the path that was supposed to preserve current renderer behavior and share it with the overlay.

Impact:

The canvas and Three overlay cannot share movement camera behavior because it is not implemented. Any player movement panning or click-hit-test compensation expected by the existing animation pipeline is dropped in the new shared state.

Suggested fix:

Move the actual player movement camera offset calculation into `useDungeonRenderState`, using the active player move and `getMoveRenderedOffsetPx(...)` or the intended movement-profile helper. Return pixel offsets only; do not reintroduce fractional tile offsets.

Missing validation:

The current hook tests check object shape and array forwarding. Add behavior tests for active player movement, no-movement zero offset, edge-clamped viewport origin, and click conversion through `DungeonCanvas` using the hook-produced offset.

### P2 - The flag-on path lazy-loads Three even when no handled animation is active

File/line:

- `apps/web/src/components/DungeonPhase.tsx:187`
- `apps/web/src/components/DungeonPhase.tsx:188`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:4`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:5`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:58`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:67`
- `apps/web/src/components/DungeonPhase.test.tsx:530`

Plan expectation:

- `.plan/threejs.md:163` - mount the overlay only when relevant animations are active.
- `.plan/threejs.md:172` - render null when no handled animation is active.
- `.plan/threejs.md:175` - use a lazy import path for the Three overlay.
- `.plan/threejs.md:251` - lazy-load to avoid bundle cost before value is proven.

Problem:

`DungeonPhase` renders the lazy wrapper whenever sprites are on and the flag is enabled, before checking whether any handled animation exists. That triggers the dynamic import of `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx`, which imports the Three renderer and built-in effects, just so the implementation can later return `null`.

The `DungeonPhase` test encodes the wrong contract by expecting `ThreeEffectsOverlay` to render when the flag is enabled even with empty animation arrays.

Impact:

With `VITE_THREE_EFFECTS=true`, the app downloads the 469 kB Three overlay chunk on dungeon render even if the player never triggers `fx.self.healing-pulse`. The lazy split protects the disabled default path, but it does not satisfy the "relevant animations are active" mount rule.

Suggested fix:

Keep a lightweight, non-Three-owned handled-ID predicate outside the heavy implementation, or expose a tiny metadata module that does not import `three`. Render the lazy overlay only when the current render state contains an active handled animation.

Missing validation:

Add a flag-on/no-handled-animation test proving the lazy implementation is not imported and no overlay wrapper is mounted.

### P2 - Overlay tests still do not prove effect lifecycle or rendering

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:32`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:38`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:388`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:497`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:701`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:183`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:206`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:243`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:266`

Plan expectation:

- `.plan/threejs.md:70` - component tests cover the mocked renderer behavior.
- `.plan/threejs.md:154` - effect create/update/dispose are deterministic.
- `.plan/threejs.md:286` - tests cover overlay wiring and canvas fallback.

Problem:

The overlay tests mostly assert that a canvas exists and that the renderer factory was called. The mock scene is `{}` with no `add` method, so a real effect `create(...)` call would throw if the RAF loop actually ran against the real healing module. The tests do not observe `module.create`, `module.update`, `module.dispose`, object position, or `handle.render(...)`.

Impact:

The exact behavior that matters for the MVP can be broken while the suite stays green. This is how the branch can pass 58 overlay tests without proving a visible Three-backed pulse.

Suggested fix:

Inject or register a fixture Three effect module in the overlay test and drive `requestAnimationFrame` deterministically. Assert create/update/render calls, object position from `playerPos`, disposal when the animation disappears, and fallback behavior when module creation or renderer creation fails.

Missing validation:

No current automated test proves a frame is rendered by a Three effect module.

### P2 - `DungeonPhase` tests mock away the ownership contract they need to prove

File/line:

- `apps/web/src/components/DungeonPhase.test.tsx:116`
- `apps/web/src/components/DungeonPhase.test.tsx:171`
- `apps/web/src/components/DungeonPhase.test.tsx:530`
- `apps/web/src/components/DungeonPhase.test.tsx:634`
- `apps/web/src/components/DungeonPhase.test.tsx:649`
- `apps/web/src/components/DungeonCanvas.test.tsx:252`
- `apps/web/src/components/DungeonCanvas.test.tsx:627`

Plan expectation:

- `.plan/threejs.md:70` through `.plan/threejs.md:72` - component tests cover overlay wiring and refactored render inputs.
- `.plan/threejs.md:195` through `.plan/threejs.md:199` - canvas skip ownership is correct only when the overlay path is active.
- `.plan/threejs.md:286` - tests cover overlay wiring and canvas fallback.

Problem:

`DungeonPhase.test.tsx` mocks both `useDungeonRenderState` and `ThreeEffectsOverlay`. The overlay mock never calls `onInitialized`, so no test can verify how `DungeonPhase` updates `handledAnimationIds` or forwards `skipHandledAnimationIds` to `DungeonCanvas`/`renderMap`. `DungeonCanvas.test.tsx` verifies `cameraOffset`, but it has no test that `skipHandledAnimationIds` reaches `renderMap`.

Impact:

Canvas suppression can be stale, missing, or over-broad without failing component tests. The current tests prove sibling DOM shape, not the core fallback contract.

Suggested fix:

Add an integration-style component test that keeps `DungeonCanvas`/`renderMap` observable and uses an overlay test double that calls `onInitialized(['fx.self.healing-pulse'])` and then `onInitialized([])`. Assert `renderMap` receives the right final argument in success, failure, flag-off, and teardown cases.

Missing validation:

No test currently proves the parent-owned skip list.

### P2 - The Three effect contracts are still split and partially untyped

File/line:

- `apps/web/src/rendering/three/three-effect-registry.ts:9`
- `apps/web/src/rendering/three/three-effect-registry.ts:10`
- `apps/web/src/rendering/three/three-effect-types.ts:29`
- `apps/web/src/rendering/three/three-effect-types.ts:31`
- `apps/web/src/rendering/three/effects/index.ts:17`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:29`
- `apps/web/src/components/DungeonCanvas.tsx:24`
- `apps/web/src/sprites/canvas-renderer.ts:62`

Plan expectation:

- `.plan/threejs.md:19` - use the same `AnimationId` identity as the existing registry.
- `.plan/threejs.md:30` - do not create a parallel effect-id namespace.
- `.plan/threejs.md:132` - define `ThreeEffectModule` keyed by `AnimationId`.
- `.plan/threejs.md:285` - registry is typed and keyed by existing `AnimationId` values.

Problem:

The registry now accepts `AnimationId`, which is progress, but the rest of the contract is still split and loose. There are two exported `ThreeEffectModule` interfaces. The registry accepts `create(context: unknown)`, while the actual effect modules use `ThreeEffectContext`. `BUILT_IN_THREE_EFFECT_IDS` is still `readonly string[]`, and the canvas/overlay ownership callbacks still use plain `string[]`.

Impact:

TypeScript still permits raw-string ownership lists and erases the context contract at the registry boundary. The contract test catches live built-in IDs after the fact, but the public API still teaches a weaker namespace than the plan requires.

Suggested fix:

Keep one exported `ThreeEffectModule` contract, import it into the registry, type `BUILT_IN_THREE_EFFECT_IDS` as `readonly AnimationId[]`, and type `onInitialized`/`skipHandledAnimationIds` with `AnimationId`.

Missing validation:

Add a type-level test or compile assertion that built-in IDs and ownership lists are `AnimationId[]`, not arbitrary strings.

### P3 - Contributor docs still document behavior the implementation does not provide

File/line:

- `docs/guides/adding-animation.md:121`
- `docs/guides/adding-animation.md:143`
- `docs/guides/adding-animation.md:163`
- `docs/guides/adding-animation.md:187`
- `docs/guides/adding-animation.md:190`
- `docs/guides/ui-design.md:196`
- `docs/guides/ui-design.md:204`
- `docs/guides/ui-design.md:210`

Plan expectation:

- `.plan/threejs.md:210` through `.plan/threejs.md:217` - docs teach the new renderer boundary and preserve the presentation-only contract.

Problem:

The docs still say overlay-enabled dev is the default, but `isThreeEffectsEnabledFlag()` defaults disabled. They say Three code is "tree-shaken" when disabled, while the implementation uses a lazy chunk. They say effect registration is skipped on WebGL failure, but registration happens at module import time. The `adding-animation.md` example uses `context.scene` inside `dispose`, where `context` is not in scope, types `BUILT_IN_THREE_EFFECT_IDS` as `readonly string[]`, and uses `THREE.Scene()` in a snippet without importing `THREE`.

Impact:

Contributors will copy incorrect defaults, incorrect lifecycle code, and the raw-string type pattern that the plan explicitly tried to avoid.

Suggested fix:

Update docs after fixing the implementation: disabled by default, lazy chunk rather than tree-shaking, registration separate from renderer creation, disposal stores `scene` on the instance, and built-in IDs are `AnimationId[]`.

Missing validation:

No docs/example check catches these semantic mistakes.

### P3 - New test imports violate the repo's strict ESM import rule

File/line:

- `apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts:3`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts:4`

Plan expectation:

- `AGENTS.md` key rule: all imports use `.js` extension under strict ESM.

Problem:

The new test imports `./healing-pulse-effect` and `../three-effect-types` without `.js` extensions. Validation currently passes, but this branch should not add new exceptions to a repo-wide ESM convention.

Impact:

The test normalizes a pattern that the repo explicitly forbids and that can break outside Vite's test resolver.

Suggested fix:

Change the imports to `./healing-pulse-effect.js` and `../three-effect-types.js`.

Missing validation:

The current lint/type gates do not enforce this rule for this file.

## Residual Risk

The central risk is unchanged: validation can be green while the browser-visible MVP is false. The repair order should be:

1. Fix the pulse sizing in screen/tile units and prove visible pixels.
2. Drive Three effect progress from shared animation state.
3. Make canvas skip ownership explicit and clear it on teardown, flag-off, and failure.
4. Restore real movement camera offset semantics in `useDungeonRenderState`.
5. Avoid lazy-loading the Three implementation until a handled animation is active.
6. Replace presence-only tests with RAF-driven lifecycle, positioning, fallback, and parent ownership tests.
7. Fix the type contract and docs.
8. Re-run `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate`.
