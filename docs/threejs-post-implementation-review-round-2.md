# Three.js Overlay Post-Implementation Review - Round 2

Review basis:

- Plan: `.plan/threejs.md`
- Prior review: `docs/threejs-post-implementation-review.md`

Review date: 2026-05-28

Branch/worktree: `threejs`

Bottom line: the branch is not acceptable. The implementation still does not deliver a visible Three-backed healing pulse, it regresses existing canvas camera behavior, and the required validation gate is red.

## Validation Evidence

- `pnpm vitest run apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx` - failed, 16 failed.
- `pnpm vitest run apps/web/src/components/DungeonPhase.test.tsx` - passed.
- `pnpm vitest run apps/web/src/components/DungeonCanvas.test.tsx` - passed.
- `pnpm run check:fast` - passed with existing warnings.
- `pnpm validate:quick` - failed at `pnpm test:changed`: 16 failed, 1996 passed.
- `.validate-logs/test.log` was inspected after the failure.
- `pnpm validate` was not run because the repo instructions require stopping on the first validation failure.

Passing `check:fast` is not meaningful acceptance evidence here. The changed test gate fails.

## Findings

### P0 - Validation is red

File/line:

- `.validate-logs/test.log:1`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:88`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:108`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:284`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:388`

Plan expectation:

- `.plan/threejs.md:70` - `ThreeEffectsOverlay.test.tsx` covers the mocked renderer component behavior.
- `.plan/threejs.md:228` through `.plan/threejs.md:232` - run affected tests and validation, inspect `.validate-logs/test.log` on failure.
- `.plan/threejs.md:235` and `.plan/threejs.md:288` - finish with `pnpm validate` passing.

Problem:

`pnpm validate:quick` fails because `ThreeEffectsOverlay.test.tsx` has 16 failing tests. The fixture helpers create "active" consumable and FX animations without a registered handled `animationId`, while the component now correctly requires a handled animation before it initializes WebGL. The tests still assert that any non-empty animation array should render a canvas, which contradicts the plan requirement to render null when no handled animation is active.

Impact:

The branch cannot be claimed complete. This is not a flaky visual gap; the required local confidence gate is hard red and points at the exact overlay slice this plan added.

Suggested fix:

Update overlay test fixtures so positive cases use the MVP handled ID, `fx.self.healing-pulse`, and add negative cases for unhandled animation IDs. Then rerun the targeted test, `pnpm validate:quick`, and `pnpm validate`.

Missing validation:

No full validation can be accepted until `pnpm validate:quick` and then `pnpm validate` pass.

### P0 - The Three renderer still draws to a detached canvas

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:79`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:87`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:116`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:264`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:268`

Plan expectation:

- `.plan/threejs.md:7` - the MVP renders a player-visible Three.js healing pulse.
- `.plan/threejs.md:55` - a player using a health potion sees the pulse centered on the player tile.
- `.plan/threejs.md:152` through `.plan/threejs.md:154` - the renderer factory and healing pulse produce visible pulse behavior.
- `.plan/threejs.md:283` - `ThreeEffectsOverlay` renders the transparent WebGL healing pulse.

Problem:

The component returns `null` while `rendererReady` is false. On the initial handled-animation render there is no mounted React canvas, so `canvasRef.current` is null. The effect creates a separate `document.createElement('canvas')` and passes that detached canvas to the renderer factory. The replacement branch at line 116 cannot run because there is no mounted canvas to replace. After `setRendererReady(true)`, React renders a new `<canvas>`, but the Three renderer is still bound to the earlier detached canvas.

Impact:

The WebGL renderer can render frames and effect instances without anything becoming visible in the DOM. The old 2D canvas animation can still mask this when the skip path is not wired, but the MVP Three effect remains absent.

Suggested fix:

Render a stable canvas node before creating the renderer, then initialize Three from that exact DOM node through a ref or callback ref. Do not create a detached canvas in the effect. Add a test that asserts `createRenderer` receives the same canvas node that is mounted in the container and that `handle.domElement` is the visible overlay canvas.

Missing validation:

There is no component test that proves the actual renderer DOM element is mounted, and no browser/manual QA note proving the Three pulse is visible.

### P1 - The shared render hook breaks existing viewport and camera behavior

File/line:

- `apps/web/src/hooks/useDungeonRenderState.ts:42`
- `apps/web/src/hooks/useDungeonRenderState.ts:49`
- `apps/web/src/hooks/useDungeonRenderState.ts:55`
- `apps/web/src/hooks/useDungeonRenderState.ts:64`
- `apps/web/src/components/DungeonCanvas.tsx:73`
- `apps/web/src/components/DungeonCanvas.tsx:97`
- `apps/web/src/sprites/canvas-renderer.ts:547`
- `apps/web/src/sprites/canvas-renderer.ts:554`

Plan expectation:

- `.plan/threejs.md:17` - existing viewport origin and camera offset behavior must be shared, not redefined.
- `.plan/threejs.md:34` - the overlay uses the same tile coordinate model as `DungeonCanvas`.
- `.plan/threejs.md:103` - one source of truth for viewport origin and camera offset.
- `.plan/threejs.md:117` - current sprite rendering behavior is unchanged with the feature flag off.

Problem:

`useDungeonRenderState` no longer computes the player movement camera offset from active move animations. It returns an `offsetX`/`offsetY` derived from fractional viewport math, in tile units, while `DungeonCanvas` and `canvas-renderer` consume `cameraOffset` as pixels for `ctx.translate(...)` and click hit-testing. The hook also computes `idealVpLeft = player.x - vpTilesWidth / 2`, which is not equivalent to the previous `player.x - floor(width / 2)` viewport origin for odd widths.

Impact:

This is a flag-off regression in the primary canvas renderer. Player movement panning no longer follows the existing move animation pipeline, click coordinates can be adjusted by values in the wrong unit, and the viewport can be shifted from the previous player-centered behavior.

Suggested fix:

Move the old `DungeonCanvas` camera logic into `useDungeonRenderState`: resolve the active player move, call `getMoveTravelOffsetPx(activePlayerMove, CELL_SIZE)`, and return the negated pixel offset. Keep viewport origin math equivalent to the old canvas behavior unless a separate plan changes it.

Missing validation:

Add real hook tests in `apps/web/src/hooks/useDungeonRenderState.test.ts` that do not mock the hook. Cover viewport origin, active player move camera offset in pixels, and click conversion through `DungeonCanvas`.

### P1 - Canvas fallback and double-render prevention are still not wired

File/line:

- `apps/web/src/sprites/canvas-renderer.ts:62`
- `apps/web/src/sprites/canvas-renderer.ts:465`
- `apps/web/src/sprites/canvas-renderer.ts:638`
- `apps/web/src/components/DungeonCanvas.tsx:73`
- `apps/web/src/components/DungeonCanvas.tsx:84`
- `apps/web/src/components/DungeonPhase.tsx:183`
- `apps/web/src/components/DungeonPhase.tsx:184`

Plan expectation:

- `.plan/threejs.md:18` - canvas skips only IDs handled by Three to avoid double drawing.
- `.plan/threejs.md:36` - WebGL initialization failure falls back to canvas-only behavior.
- `.plan/threejs.md:193` through `.plan/threejs.md:199` - skip `fx.self.healing-pulse` only when the overlay path is active, and ensure one visual implementation owns the effect at a time.
- `.plan/threejs.md:244` through `.plan/threejs.md:247` - mitigate duplicate rendering and WebGL failure.

Problem:

`canvas-renderer` has a `skipHandledAnimationIds` option, but `DungeonCanvas` never receives or passes it. `DungeonPhase` mounts the overlay when the flag is enabled, but there is no success/failure signal from the overlay back to the canvas path. The canvas therefore always draws the healing pulse.

Impact:

If the Three canvas is fixed, the MVP effect will render twice. If WebGL fails, there is no explicit owner-state proving fallback. Today the bug is masked because the Three canvas is detached and blank.

Suggested fix:

Represent active handled Three IDs in one owner path. Pass the skip set to `DungeonCanvas` only after the overlay has successfully initialized for a handled active animation. Keep the skip set empty when the flag is disabled, there is no handled animation, or WebGL setup fails.

Missing validation:

Add a `DungeonPhase` or integration-level component test for flag off, flag on with renderer success, and flag on with renderer failure, asserting the exact `skipHandledAnimationIds` value passed to `renderMap`.

### P1 - The disabled default path still eagerly imports Three.js

File/line:

- `apps/web/src/components/DungeonPhase.tsx:13`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:6`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:4`
- `apps/web/src/rendering/three/three-renderer-factory.ts:7`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:12`

Plan expectation:

- `.plan/threejs.md:33` - the feature flag defaults disabled.
- `.plan/threejs.md:99` - no production path imports or initializes Three while the flag is disabled.
- `.plan/threejs.md:175` - use a lazy import path so the disabled default path does not eagerly load WebGL.
- `.plan/threejs.md:250` through `.plan/threejs.md:251` - avoid bundle cost before value is proven.

Problem:

`DungeonPhase` statically imports the component shim, the shim statically exports the rendering implementation, the implementation statically imports the renderer factory and built-in effects, and those files statically import `three`.

Impact:

The disabled-by-default path still pays the dependency and bundle cost. The feature flag prevents rendering, not loading.

Suggested fix:

Move the heavyweight implementation behind `React.lazy` or an explicit dynamic `import()` reached only after `isThreeEffectsEnabledFlag()` is true. Keep the default canvas-only render path free of `three` imports.

Missing validation:

Add an import-boundary or bundle guard proving the disabled/default path does not include the Three implementation.

### P2 - The Three registry still uses raw strings instead of content `AnimationId` refs

File/line:

- `apps/web/src/rendering/three/three-effect-registry.ts:13`
- `apps/web/src/rendering/three/three-effect-registry.ts:15`
- `apps/web/src/rendering/three/three-effect-registry.ts:19`
- `apps/web/src/rendering/three/effects/index.ts:11`
- `apps/web/src/rendering/three/effects/index.ts:14`
- `packages/content/src/animation-refs/index.ts:7`

Plan expectation:

- `.plan/threejs.md:19` - reuse the repo's `AnimationId` identity.
- `.plan/threejs.md:30` - do not create a parallel effect ID namespace.
- `.plan/threejs.md:132` - `ThreeEffectModule` is keyed by `AnimationId`.
- `.plan/threejs.md:153` - register the MVP module for `animationRefs.self.healingPulse.id`.
- `.plan/threejs.md:285` - the registry is typed, keyed by existing `AnimationId` values, and contract-checked.

Problem:

The registry is `Map<string, ThreeEffectModule>`, `register(animationId: string, ...)`, and `get(animationId: string)`. The built-in registry hardcodes `'fx.self.healing-pulse'` instead of dot-walking through `animationRefs.self.healingPulse.id`, despite the content package explicitly documenting that consumers must dot-walk through `animationRefs`.

Impact:

The contract test can catch some misses after the fact, but TypeScript cannot prevent this implementation from creating a parallel untyped string namespace. The docs added in this branch also copy the raw-string registration pattern.

Suggested fix:

Import `animationRefs` and `type AnimationId` from `@dungeon/content`, type the registry API with `AnimationId`, and export `BUILT_IN_THREE_EFFECT_IDS` as `readonly AnimationId[]` sourced from `animationRefs.self.healingPulse.id`.

Missing validation:

Add a type-level or focused unit check that the public registry API is not just arbitrary `string`.

### P2 - The tests still provide false confidence around the riskiest extraction

File/line:

- `apps/web/src/components/DungeonPhase.test.tsx:118`
- `apps/web/src/components/DungeonPhase.test.tsx:468`
- `apps/web/src/components/DungeonPhase.test.tsx:481`
- `apps/web/src/components/DungeonPhase.test.tsx:649`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:88`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:388`

Plan expectation:

- `.plan/threejs.md:70` through `.plan/threejs.md:72` - component tests cover overlay wiring and refactored render inputs.
- `.plan/threejs.md:103` - one source of truth for shared render state.
- `.plan/threejs.md:286` - tests cover coordinate conversion, overlay wiring, and fallback behavior.

Problem:

`DungeonPhase.test.tsx` mocks `useDungeonRenderState` and then has a `useDungeonRenderState hook` describe block that calls the mocked hook. Those tests verify the fixture object at line 125, not the real implementation in `apps/web/src/hooks/useDungeonRenderState.ts`. Separately, the overlay tests claim to cover successful overlay rendering while their default fixtures lack a registered handled `animationId`.

Impact:

The tests pass around broken camera math and fail around their own stale assumptions. They do not protect the actual behavior the plan was trying to prove.

Suggested fix:

Move hook tests into `apps/web/src/hooks/useDungeonRenderState.test.ts` and do not mock the hook under test. Fix overlay fixtures to include handled and unhandled IDs explicitly. Add assertions for renderer creation, effect module create/update/dispose calls, mounted renderer canvas identity, and fallback skip ownership.

Missing validation:

No current test proves real hook camera offset behavior or visible renderer ownership.

### P2 - Effect instance identity and positioning are unstable

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:173`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:176`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:190`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:194`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:206`

Plan expectation:

- `.plan/threejs.md:135` - coordinate helpers convert grid positions to overlay world coordinates using current viewport and camera offset.
- `.plan/threejs.md:154` - render with orthographic alignment and deterministic disposal.
- `.plan/threejs.md:243` - shared render state and coordinate utilities mitigate coordinate drift.

Problem:

The effect key is `${anim.type}:${anim.index}`. When active animation arrays change, indexes can shift and an existing Three instance can be reused for a different animation. Positioning is also performed only when the instance is created. If `vpLeft`, `vpTop`, or `cameraOffset` changes while the animation is active, the Three object does not follow the same coordinate model as the canvas renderer.

Impact:

Overlapping or rapidly successive effects can inherit the wrong start time, position, or disposal lifecycle. Camera and viewport changes during an active effect can visually detach the Three pulse from the player tile.

Suggested fix:

Use a stable animation identity from the active hook state, such as `anim.id` with a type prefix. Recompute position each frame from the current viewport and camera offset before calling `module.update(...)`.

Missing validation:

Add tests for two simultaneous handled animations, removal of the first active animation, and viewport/camera changes while an effect remains active.

### P2 - New implementation files are still untracked

File/line:

- `git status --short --untracked-files=all`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx`
- `apps/web/src/hooks/useDungeonRenderState.ts`
- `tests/contracts/three-effects-animation-refs.contract.test.ts`

Plan expectation:

- `.plan/threejs.md:43` - web owns new renderer files under `apps/web/src/rendering/three/`.
- `.plan/threejs.md:74` - the contract test belongs in `tests/contracts/`.
- `.plan/threejs.md:158` - the contract test must prove every built-in ID exists.

Problem:

The worktree contains the new implementation, tests, and contract file as `??` untracked files. The `.gitignore` exception was added for the contract test, but the file itself is still not tracked.

Impact:

If this branch is pushed or reviewed from tracked changes only, the core implementation and required contract coverage can be omitted. This is especially easy to miss because `git diff --stat` excludes these files.

Suggested fix:

Add all intentional new implementation, test, and docs files to version control, and remove any scratch files before handoff.

Missing validation:

Run `git status --short --untracked-files=all` and `git ls-files tests/contracts/three-effects-animation-refs.contract.test.ts` before handoff.

### P3 - Docs still teach incorrect paths, defaults, and raw-ID patterns

File/line:

- `docs/guides/adding-animation.md:62`
- `docs/guides/adding-animation.md:79`
- `docs/guides/adding-animation.md:103`
- `docs/guides/adding-animation.md:158`
- `docs/guides/adding-animation.md:161`
- `docs/guides/ui-design.md:196`
- `docs/guides/ui-design.md:204`
- `docs/guides/ui-design.md:239`

Plan expectation:

- `.plan/threejs.md:211` through `.plan/threejs.md:213` - docs teach renderer boundaries, contract coverage, unit-test boundaries, and UI config ownership.
- `.plan/threejs.md:216` - docs teach the new pattern without preserving old or wrong patterns.

Problem:

The docs refer to non-existent canvas module paths under `apps/web/src/rendering/canvas/*`; existing canvas animation modules live under `apps/web/src/animations/modules/`. The examples hardcode animation IDs instead of using `animationRefs`. `ui-design.md` says the overlay is "default in dev" and that disabled mode tree-shakes Three code from the bundle, neither of which is true in the current implementation.

Impact:

Contributors following these docs will add files in the wrong place, copy raw string IDs, and believe a lazy import boundary exists when it does not.

Suggested fix:

Update docs to use actual existing paths, source IDs from `animationRefs`, and only claim tree-shaking/lazy loading after the import boundary is real.

Missing validation:

Docs were not checked against `rg --files` output or bundle/import behavior.

### P3 - Unrelated changes and scratch artifacts remain in the branch

File/line:

- `apps/web/src/components/ItemSpriteIcon.tsx:51`
- `docs/skills/planning/SKILL.md:16`
- `filter-errors.mjs:1`
- `filter-errors.mjs:2`

Plan expectation:

- `.plan/threejs.md:37` - unrelated game/UI behavior does not move into the Three work.
- `.plan/threejs.md:43` through `.plan/threejs.md:51` - owned artifacts are the web renderer files, feature flag, lockfile, and required docs.
- `.plan/threejs.md:202` through `.plan/threejs.md:213` - docs scope is `adding-animation.md` and `ui-design.md`.

Problem:

The branch changes `ItemSpriteIcon` empty-sprite DOM behavior, edits the canonical planning skill, and leaves a local `filter-errors.mjs` scratch script with a hardcoded path into a local Claude tool-results directory.

Impact:

These changes increase review noise and can ship unrelated behavior or local-machine paths with the Three overlay branch.

Suggested fix:

Remove unrelated files from this branch unless each has an explicit bug reference and test coverage. Delete `filter-errors.mjs`.

Missing validation:

No targeted item icon test or repo-skill generation/check evidence was added for these unrelated changes.

## Residual Risk

The current branch has the same central failure as the first review: validation can be green in partial gates while the player-visible MVP is false. In this second pass, even the changed-test gate is red.

The most important repair sequence is:

1. Make `ThreeEffectsOverlay` mount the actual renderer canvas.
2. Restore pixel-based camera offset and old viewport behavior in `useDungeonRenderState`.
3. Wire canvas skip ownership only after overlay success.
4. Add the lazy import boundary.
5. Fix the tests so they prove handled-ID behavior and real hook behavior.
6. Re-run `pnpm validate:quick`, then `pnpm validate`.

