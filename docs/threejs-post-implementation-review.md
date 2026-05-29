# Three.js Overlay Post-Implementation Review

Review basis: `.plan/threejs.md`

Review date: 2026-05-28

Branch/worktree: `threejs`

Validation run during review:

- `pnpm run check:fast` - passed, with warnings only.
- `pnpm validate:quick` - passed.
- `pnpm validate` - passed.
- Build warning: web main chunk is `682.20 kB`; this matters because the plan explicitly required lazy loading of the Three path.

Passing validation is not sufficient for acceptance here. The implementation currently passes tests while missing the player-visible MVP effect.

## Findings

### P0 - The Three overlay never renders the healing pulse

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:59`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:67`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:78`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:94`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:27`

Plan expectation:

- `.plan/threejs.md:7` - MVP renders a player-visible Three.js healing pulse for `fx.self.healing-pulse`.
- `.plan/threejs.md:55` - player sees the pulse centered on the player tile.
- `.plan/threejs.md:154` - render visible pulse/expand/fade behavior.
- `.plan/threejs.md:283` - `ThreeEffectsOverlay` renders the WebGL healing pulse when enabled.

Problem:

`ThreeEffectsOverlay` creates a canvas at line 67 and passes it to the renderer factory, but the component returns a different React-created `<canvas>` at line 94. The renderer's `domElement` is never attached to the DOM. The component also never imports the built-in effects, never resolves `fx.self.healing-pulse`, never calls a module `create`/`update`/`dispose`, never positions an effect from `playerPos`, and never calls `handle.render(...)`.

Impact:

With `VITE_THREE_EFFECTS=true`, the Three path mounts a blank DOM canvas. The delivered MVP is visually absent. The only reason a player may still see a healing animation is the old 2D canvas renderer, not the new Three implementation.

Suggested fix:

Make the overlay own and attach the actual renderer canvas, or mount a React canvas and pass that exact node to `createThreeRenderer`. Import/register built-in effects, filter active animations to handled IDs, instantiate one effect per active animation, update progress and position from presenter data, call `render(scene, camera)`, and dispose instances deterministically.

Missing validation:

Add a component test that proves the renderer factory receives the DOM canvas that is actually mounted, and that a handled `fx.self.healing-pulse` animation causes module `create`, `update`, and `render` calls. Add a browser/manual QA note proving the pulse is visible.

### P1 - The overlay coordinate/camera system is not implemented

File/line:

- `apps/web/src/rendering/three/three-renderer-factory.ts:42`
- `apps/web/src/rendering/three/three-coordinate-utils.ts:29`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:40`

Plan expectation:

- `.plan/threejs.md:34` - overlay uses the same tile coordinate model as `DungeonCanvas`.
- `.plan/threejs.md:135` - coordinate helpers convert grid positions to overlay world coordinates.
- `.plan/threejs.md:154` - healing pulse has orthographic alignment.
- `.plan/threejs.md:243` - coordinate drift is mitigated by shared render state and coordinate utilities.

Problem:

The coordinate helpers are only tested; they are not used by the overlay, renderer, or healing-pulse module. The camera is hardcoded to `(-1, 1, 1, -1)` and is not resized to the canvas/tile coordinate system. The healing effect creates a group at the origin and has no animation/player position input.

Impact:

Even after wiring the module calls, the effect would not be centered on the player tile. It would render in the wrong coordinate space, likely at the scene origin or at an arbitrary scale.

Suggested fix:

Define the orthographic camera in canvas pixel or tile units, update it on resize, use `tileCenterWorld`/`worldToScreen` for each active animation, apply the Three y-axis convention in one place, and test that a known player tile maps to the expected overlay object position.

Missing validation:

Add an overlay-level test that passes `playerPos`, `vpLeft`, `vpTop`, and `cameraOffset`, then asserts the created effect is positioned at the player tile center.

### P1 - Three.js is eagerly imported on the default disabled path

File/line:

- `apps/web/src/components/DungeonPhase.tsx:13`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:6`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:3`
- `apps/web/src/rendering/three/three-renderer-factory.ts:7`

Plan expectation:

- `.plan/threejs.md:33` - feature flag defaults disabled.
- `.plan/threejs.md:99` - no production path imports or initializes Three while flag is disabled.
- `.plan/threejs.md:175` - use a lazy import path so the disabled default path does not eagerly load WebGL implementation.
- `.plan/threejs.md:251` - mitigate bundle cost with lazy loading.

Problem:

`DungeonPhase` statically imports `ThreeEffectsOverlay`. The component re-export statically imports the rendering implementation, which statically imports the renderer factory, which statically imports `three`.

Impact:

The disabled-by-default path still pays the module loading/bundle cost. The `pnpm validate` build produced a `682.20 kB` main web chunk and a Rollup chunk-size warning, consistent with this plan violation.

Suggested fix:

Gate the Three implementation behind `React.lazy` or a dynamic `import()` that is reached only after `isThreeEffectsEnabledFlag()` is true. Keep the lightweight flag check and primary canvas path free of `three` imports.

Missing validation:

Add a build or unit guard that the disabled/default render path does not import `three`, or at minimum document bundle output before/after the lazy split.

### P1 - Canvas fallback and double-render prevention are not wired

File/line:

- `apps/web/src/components/DungeonCanvas.tsx:73`
- `apps/web/src/components/DungeonCanvas.tsx:84`
- `apps/web/src/components/DungeonPhase.tsx:183`
- `apps/web/src/sprites/canvas-renderer.ts:62`
- `apps/web/src/sprites/canvas-renderer.ts:465`
- `apps/web/src/sprites/canvas-renderer.ts:638`

Plan expectation:

- `.plan/threejs.md:18` - canvas must skip IDs handled by Three to avoid double drawing.
- `.plan/threejs.md:195` - skip `fx.self.healing-pulse` only when the flag is enabled and overlay path is active.
- `.plan/threejs.md:196` - keep canvas rendering it when flag is disabled or WebGL setup fails.
- `.plan/threejs.md:199` - one visual implementation owns the MVP effect at a time.

Problem:

`canvas-renderer.ts` added a `skipHandledAnimationIds` option, but `DungeonCanvas` never passes it. `DungeonPhase` mounts the overlay when the flag is on, but it does not tell the canvas which IDs are owned by a successfully initialized overlay. There is also no feedback path from WebGL success/failure to decide fallback behavior.

Impact:

Once the Three overlay is actually made visible, `fx.self.healing-pulse` will render in both canvas and Three. Today, because the Three path is blank, the old canvas animation continues to mask the missing MVP.

Suggested fix:

Represent handled Three IDs in one place, pass them to `DungeonCanvas` only when the overlay has successfully initialized and has a handled active animation, and leave the skip set empty when disabled or when WebGL creation fails.

Missing validation:

Add a `DungeonPhase`/`DungeonCanvas` integration test that exercises flag off, flag on plus WebGL success, and flag on plus WebGL failure, asserting the exact `playerEffects.skipHandledAnimationIds` passed to `renderMap`.

### P1 - The shared render hook regresses camera panning

File/line:

- `apps/web/src/hooks/useDungeonRenderState.ts:28`
- `apps/web/src/hooks/useDungeonRenderState.ts:59`

Plan expectation:

- `.plan/threejs.md:17` - `DungeonCanvas` already owned camera offset calculation and the overlay needs the same inputs.
- `.plan/threejs.md:103` - one source of truth for viewport origin and camera offset.
- `.plan/threejs.md:113` - return `cameraOffset`.
- `.plan/threejs.md:117` - current sprite behavior unchanged with flag off.

Problem:

The hook reads `moveAnimations` but always returns `ZERO_CAMERA_OFFSET`. The previous `DungeonCanvas` implementation computed player movement camera offset from active player movement so the viewport could pan smoothly and click hit-testing could account for that pan.

Impact:

Flag-off sprite rendering is not unchanged. Player movement camera behavior regresses even when Three is disabled, and click coordinate adjustment during active player movement no longer matches the intended moving camera.

Suggested fix:

Move the existing player-move camera-offset computation into `useDungeonRenderState`, using the active player entity id or player destination fallback and `getMoveTravelOffsetPx(...)`.

Missing validation:

Add a real `useDungeonRenderState` test for active player movement that expects a non-zero `cameraOffset`, plus a `DungeonCanvas` click test that uses the hook-produced value through `DungeonPhase`.

### P2 - The component test suite mocks the hook it claims to test

File/line:

- `apps/web/src/components/DungeonPhase.test.tsx:118`
- `apps/web/src/components/DungeonPhase.test.tsx:125`
- `apps/web/src/components/DungeonPhase.test.tsx:468`
- `apps/web/src/components/DungeonPhase.test.tsx:640`
- `apps/web/src/components/DungeonPhase.test.tsx:649`

Plan expectation:

- `.plan/threejs.md:70` - component tests cover overlay wiring.
- `.plan/threejs.md:72` - `DungeonCanvas` tests cover refactored render inputs.
- `.plan/threejs.md:286` - unit/component tests cover overlay wiring and fallback.

Problem:

`DungeonPhase.test.tsx` mocks `useDungeonRenderState` at line 118 and then has a `useDungeonRenderState hook` describe block that calls the mocked function through `renderHook`. The hook tests therefore validate the mock fixture, not the implementation. This is why a hook that always returns a zero camera offset still passes tests.

Impact:

The test suite gives false confidence over the most important shared-state extraction in the plan. It cannot catch camera offset regressions or real status/animation selector behavior.

Suggested fix:

Move hook tests to `apps/web/src/hooks/useDungeonRenderState.test.ts` without mocking the hook itself. Mock only its dependencies, or use store/test providers as appropriate.

Missing validation:

Real hook tests for viewport origin, player movement camera offset, status presentation extraction, and animation array forwarding.

### P2 - The contract test required by the plan is ignored and untracked

File/line:

- `.gitignore:65`
- `tests/contracts/three-effects-animation-refs.contract.test.ts:1`

Plan expectation:

- `.plan/threejs.md:73` - add a contract test for built-in Three IDs.
- `.plan/threejs.md:149` - contract test is a deliverable.
- `.plan/threejs.md:158` - contract proves every built-in ID exists in live content.
- `.plan/threejs.md:285` - registry is contract-checked against live content.

Problem:

The new contract test exists on disk, but `git status --ignored` reports it as ignored by `.gitignore:65` (`tests/contracts/*`). It will not be included in the branch unless force-added or moved into an existing tracked contract file.

Impact:

The implementation can appear locally validated while the required live-content guard never reaches CI or review. Future changes could ship unvalidated Three IDs.

Suggested fix:

Either force-add `tests/contracts/three-effects-animation-refs.contract.test.ts` or append the check to an existing tracked contract suite such as `tests/contracts/content-cross-references.contract.test.ts`.

Missing validation:

Before handoff, verify with `git ls-files tests/contracts/three-effects-animation-refs.contract.test.ts` that the file is tracked.

### P2 - Three effect IDs are raw strings instead of typed content refs

File/line:

- `apps/web/src/rendering/three/three-effect-registry.ts:13`
- `apps/web/src/rendering/three/three-effect-registry.ts:15`
- `apps/web/src/rendering/three/effects/index.ts:11`
- `apps/web/src/rendering/three/effects/index.ts:14`
- `packages/content/src/animation-refs/types.ts:4`

Plan expectation:

- `.plan/threejs.md:19` - use the same `AnimationId` identity as the existing animation registry.
- `.plan/threejs.md:30` - key Three effects by existing content `AnimationId` values.
- `.plan/threejs.md:132` - define `ThreeEffectModule` keyed by `AnimationId`.
- `.plan/threejs.md:153` - register module for `animationRefs.self.healingPulse.id`.
- `.plan/threejs.md:285` - registry is typed and keyed by existing `AnimationId` values.

Problem:

The registry is a `Map<string, ThreeEffectModule>` and `register(animationId: string, ...)`. The built-in effect index hardcodes `'fx.self.healing-pulse'` instead of dot-walking through `animationRefs.self.healingPulse.id`. This contradicts the content rule that animation ID literals only live under `packages/content/src/animation-refs/`.

Impact:

The contract test may catch some mistakes after the fact, but TypeScript cannot prevent misspelled or parallel IDs. The docs also copy this raw-literal pattern, making the drift likely to repeat.

Suggested fix:

Import `animationRefs` and `type AnimationId` from `@dungeon/content`, type the registry map and APIs with `AnimationId`, and export `BUILT_IN_THREE_EFFECT_IDS` as `readonly AnimationId[]` sourced from `animationRefs`.

Missing validation:

Add a type-level/unit assertion that registry APIs reject arbitrary strings outside tests. Unit tests can keep local fixture IDs by typing them as fixture `AnimationId` literals.

### P2 - The overlay initializes for any animation, not only handled animations

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:48`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:49`

Plan expectation:

- `.plan/threejs.md:163` - mount overlay only when relevant animations are active.
- `.plan/threejs.md:172` - render null when no handled animation is active.
- `.plan/threejs.md:185` - Three replaces only the handled animation.

Problem:

`hasAnimations` is true for any consumable or ability FX animation, regardless of whether the Three registry handles its `animationId`. A non-Three animation with the flag enabled will still create a WebGL renderer and mount the overlay canvas.

Impact:

This adds avoidable WebGL churn and will make future behavior harder to reason about. It also makes the "no handled animation" plan requirement untested.

Suggested fix:

Filter active animations through the Three registry or built-in handled-ID set before deciding `shouldRender`.

Missing validation:

Add tests where only an unhandled animation is active and assert no renderer is created and no overlay is mounted.

### P2 - Viewport sizing was re-hardcoded in `DungeonPhase`

File/line:

- `apps/web/src/components/DungeonPhase.tsx:3`
- `apps/web/src/components/DungeonPhase.tsx:105`
- `apps/web/src/components/DungeonPhase.tsx:106`

Plan expectation:

- `.plan/threejs.md:48` - `ui-config.ts` remains source for tile and viewport sizing constants.
- `.plan/threejs.md:117` - current sprite behavior unchanged with flag off.

Problem:

`MapDisplay` now initializes viewport tile counts with hardcoded `15` and `12`, while `VP_WIDTH` and `VP_HEIGHT` are still imported but unused. The central config defines `VP_WIDTH = 30` and `VP_HEIGHT = 22`.

Impact:

Initial render behavior changes independently of Three, and the component now violates the repo's sizing centralization rule. This is also inconsistent with the docs updated in this branch saying sizing is centralized.

Suggested fix:

Initialize state from `VP_WIDTH` and `VP_HEIGHT`, and keep minimum viewport constants centralized if `15` and `12` are intended as lower bounds.

Missing validation:

Add a test that verifies the initial viewport uses `VP_WIDTH`/`VP_HEIGHT` before `ResizeObserver` measurements arrive.

### P3 - Docs teach paths and defaults that do not match the implementation or plan

File/line:

- `docs/guides/adding-animation.md:62`
- `docs/guides/adding-animation.md:79`
- `docs/guides/adding-animation.md:158`
- `docs/guides/ui-design.md:196`
- `docs/guides/ui-design.md:204`

Plan expectation:

- `.plan/threejs.md:211` - docs must teach the new renderer boundary.
- `.plan/threejs.md:212` - docs must explain contract coverage and unit-test boundaries.
- `.plan/threejs.md:216` - docs should no longer teach the old or wrong pattern.

Problem:

The docs refer to non-existent canvas module paths under `apps/web/src/rendering/canvas/*`; the existing canvas animation modules live under `apps/web/src/animations/modules/`. The docs also register Three effects with raw string literals, and `ui-design.md` says `VITE_THREE_EFFECTS=true` is the "default in dev" plus disabled builds tree-shake Three code, neither of which matches the plan or current static import implementation.

Impact:

Contributors following these docs will add files in the wrong place, copy the raw-ID anti-pattern, and expect lazy bundle behavior that does not exist.

Suggested fix:

Update docs to match actual paths, source IDs from `animationRefs`, and only claim tree-shaking/lazy loading after the implementation actually uses a dynamic import.

Missing validation:

A docs review against actual `rg --files` output and the final bundle behavior.

### P3 - Out-of-scope UI behavior changed in `ItemSpriteIcon`

File/line:

- `apps/web/src/components/ItemSpriteIcon.tsx:51`

Plan expectation:

- `.plan/threejs.md:37` - implementation does not move unrelated UI behavior into the Three work.
- `.plan/threejs.md:202` - docs-only workstream, not item icon behavior.

Problem:

The branch changes `ItemSpriteIcon` to return a `<span>` instead of a `<canvas>` when `spriteName` is absent. This was not in the Three overlay plan and is not documented as an accepted deviation.

Impact:

Likely low, but it changes DOM shape in inventory/shop/equipment surfaces unrelated to the MVP. If this was needed to stabilize tests, it should be split out or justified.

Suggested fix:

Remove it from this branch unless it has a specific bug reference, or document the deviation and add focused coverage for affected UI.

Missing validation:

No targeted item-icon/component test was added for the changed empty-sprite DOM behavior.

### P3 - Local scratch script is left in the worktree

File/line:

- `filter-errors.mjs:1`
- `filter-errors.mjs:2`

Plan expectation:

- `.plan/threejs.md:41` through `.plan/threejs.md:51` define owned artifacts; scratch scripts are not part of the deliverables.

Problem:

`filter-errors.mjs` is an untracked helper with a hardcoded path into a local Claude tool-results directory.

Impact:

If accidentally committed, it leaks local-machine paths and adds unsupported tooling noise to the branch.

Suggested fix:

Delete the scratch file before commit.

Missing validation:

Verify `git status --short --untracked-files=all` contains only intentional source/test/docs files.

## Residual Risk

The highest risk is that validation is currently green while the central acceptance story is false: the Three-backed healing pulse is not visible. The tests mostly prove that props and placeholder canvases exist, not that a real renderer canvas is mounted, a registered effect is instantiated, or a frame is rendered at the player tile.

Manual QA evidence for `VITE_THREE_EFFECTS=false` and `VITE_THREE_EFFECTS=true` was not found in the worktree. The plan requires it, and this implementation specifically needs browser verification because the failing behavior is visual/WebGL-specific.
