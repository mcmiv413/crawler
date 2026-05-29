# Three.js Overlay Post-Implementation Review - Round 3

Review basis:

- Plan: `.plan/threejs.md`
- Prior review: `docs/threejs-post-implementation-review.md`
- Prior review round 2: `docs/threejs-post-implementation-review-round-2.md`

Review date: 2026-05-29

Branch/worktree: `threejs`

Bottom line: the branch is still not acceptable. Some round-2 items were partially addressed, especially the lazy import wrapper and content-ref lookup for the built-in effect, but the MVP remains unproven and likely invisible in-browser. Playtesting also shows the primary dungeon canvas is visually regressed: parts of the dungeon appear cut off and black grid seams shift while navigating. The current tests pass while missing the same player-visible behavior the plan was meant to prove.

## Validation Evidence During Review

- `pnpm vitest run apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx` - passed, 57 tests.
- `pnpm vitest run apps/web/src/hooks/useDungeonRenderState.test.ts` - passed, 5 tests.
- `pnpm vitest run apps/web/src/components/DungeonPhase.test.tsx` - passed, 28 tests.
- `pnpm vitest run apps/web/src/sprites/canvas-renderer.test.ts` - passed, 11 tests.
- `pnpm run check:fast` - passed, with warnings only.
- `pnpm validate:quick` - passed.
- `pnpm validate` - passed, 2005 tests.
- Build output includes a lazy Three chunk: `ThreeEffectsOverlay-4s_hok2o.js` at 468.89 kB / 118.48 kB gzip.

These are not acceptance evidence. The passing tests do not assert that a visible Three pulse is mounted over the dungeon canvas, sized in tile/pixel units, rendered through the effect module, or coordinated with canvas fallback.

## Findings

### P0 - The overlay canvas is not anchored over the dungeon canvas

File/line:

- `apps/web/src/components/DungeonPhase.tsx:167`
- `apps/web/src/components/DungeonCanvas.tsx:121`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:261`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:267`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:268`

Plan expectation:

- `.plan/threejs.md:5` - introduce a visual effects overlay above the existing dungeon canvas.
- `.plan/threejs.md:55` - the player sees the pulse centered on the player tile.
- `.plan/threejs.md:174` - stable absolute positioning inside the existing map container.
- `.plan/threejs.md:283` - `ThreeEffectsOverlay` renders a transparent, pointer-safe WebGL healing pulse.

Problem:

`ThreeEffectsOverlay` returns an absolutely positioned `<canvas>` but does not set `top`, `left`, or `inset`. It is rendered after the block-level `DungeonCanvas` inside the same fixed-size relative container. With all insets left as `auto`, the absolute element uses its static position, which is after the existing canvas rather than pinned to the top-left of the map layer.

Impact:

Even when WebGL initialization succeeds and effect rendering runs, the overlay canvas can be laid out below the dungeon canvas or clipped by the surrounding overflow-hidden container instead of appearing above the map. This directly breaks the MVP visibility story.

Suggested fix:

Pin the overlay surface to the map container with `top: 0`, `left: 0`, and a stable layer order. Add a component or browser-level assertion that the Three canvas and dungeon canvas have the same bounding rect.

Missing validation:

No test asserts overlay placement. The current overlay tests only check `position: absolute` and `pointer-events: none`, which is insufficient for an overlay.

### P0 - The healing pulse is effectively sub-pixel sized

File/line:

- `apps/web/src/rendering/three/three-renderer-factory.ts:45`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:105`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:106`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:107`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:108`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:189`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:203`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:16`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.ts:29`

Plan expectation:

- `.plan/threejs.md:55` - a player sees the Three.js healing pulse centered on the player tile.
- `.plan/threejs.md:154` - the module renders a visible pulse/expand/fade behavior with orthographic alignment.

Problem:

The orthographic camera is configured in canvas pixel coordinates (`0..canvasWidth`, `0..canvasHeight`), and the overlay positions the effect group in screen pixels. The healing effect then creates `new THREE.CircleGeometry(BASE_RADIUS, SEGMENTS)` with `BASE_RADIUS = 0.4`. In this coordinate system the final pulse radius is less than one CSS pixel, not 40 percent of a tile.

Impact:

The Three effect can technically render but still be invisible or indistinguishable from a tiny dot. The old canvas healing animation can mask this during manual observation because canvas fallback is still always drawing it.

Suggested fix:

Size the geometry in the same unit system as the camera. For example, create the pulse radius from `context.tileSize * 0.4` or keep geometry unit-sized and scale the group to a tile-relative pixel radius. Add a focused effect test that proves the maximum radius is tile-visible.

Missing validation:

There is no `healing-pulse-effect` test and no screenshot/canvas-pixel verification that `fx.self.healing-pulse` is visibly rendered.

### P0 - The shared render hook causes cut-off dungeon edges and shifting grid seams

File/line:

- `apps/web/src/hooks/useDungeonRenderState.ts:42`
- `apps/web/src/hooks/useDungeonRenderState.ts:49`
- `apps/web/src/hooks/useDungeonRenderState.ts:55`
- `apps/web/src/hooks/useDungeonRenderState.ts:58`
- `apps/web/src/hooks/useDungeonRenderState.ts:59`
- `apps/web/src/hooks/useDungeonRenderState.ts:64`
- `apps/web/src/components/DungeonCanvas.tsx:97`
- `apps/web/src/components/DungeonCanvas.tsx:98`
- `apps/web/src/sprites/canvas-renderer.ts:547`
- `apps/web/src/sprites/canvas-renderer.ts:548`
- `apps/web/src/sprites/canvas-renderer.ts:549`
- `apps/web/src/sprites/canvas-renderer.ts:550`
- `apps/web/src/sprites/canvas-renderer.ts:553`
- `apps/web/src/sprites/canvas-renderer.ts:554`

Plan expectation:

- `.plan/threejs.md:17` - existing viewport origin and camera offset calculation should be shared, not redefined.
- `.plan/threejs.md:34` - the overlay uses the same tile coordinate model as `DungeonCanvas`.
- `.plan/threejs.md:103` - one source of truth for viewport origin and camera offset.
- `.plan/threejs.md:117` - current sprite behavior is unchanged with the flag off.
- `.plan/threejs.md:243` - shared render state mitigates coordinate drift.

Problem:

`useDungeonRenderState` computes `cameraOffset` as a fractional tile offset from viewport centering math. Near clamped map edges, `idealVpLeft - vpLeft` and `idealVpTop - vpTop` can even be negative fractional tile values. `DungeonCanvas` and `canvas-renderer` consume `cameraOffset` as pixels for click hit-testing, overscan selection, and `ctx.translate(...)`.

Player-visible evidence:

- Playtesting shows parts of the dungeon view appear cut off.
- Playtesting shows a black line/grid artifact that shifts as the player navigates.
- This is consistent with translating pixel-art tile rendering by fractional pixel offsets such as `0.5` or negative edge-clamp offsets such as `-2.5`; tile fills no longer land on exact pixel boundaries and the canvas exposes/reveals black background at the edges.

The hook also ignores `moveAnimations`, so it does not preserve the prior active-player movement camera behavior described by the plan.

Impact:

This is a flag-off regression in the primary renderer, independent of whether Three is enabled. The dungeon can look clipped or seam-filled during normal navigation, and click conversion can be shifted by values in the wrong unit.

Suggested fix:

Do not use viewport-centering remainders as camera offsets. Keep viewport origin math equivalent to the existing canvas behavior and return `{ x: 0, y: 0 }` unless there is an active movement animation that requires a pixel camera offset. Move the existing player-move camera offset calculation into `useDungeonRenderState`, returning integer or otherwise intentional pixel offsets. Clamp viewport origin before deriving any pan offset so edge clamping never produces negative fractional translation.

Missing validation:

`apps/web/src/hooks/useDungeonRenderState.test.ts` only checks field shape and array forwarding. It needs cases for viewport origin near map edges, odd/even viewport sizes, no fractional offset without active movement, active player movement offset in pixels, and click conversion through `DungeonCanvas`. Add a visual regression test or Playwright screenshot that fails on shifting black seams.

### P1 - Canvas ownership and WebGL fallback are still not wired

File/line:

- `apps/web/src/sprites/canvas-renderer.ts:62`
- `apps/web/src/sprites/canvas-renderer.ts:465`
- `apps/web/src/sprites/canvas-renderer.ts:638`
- `apps/web/src/components/DungeonCanvas.tsx:73`
- `apps/web/src/components/DungeonCanvas.tsx:84`
- `apps/web/src/components/DungeonPhase.tsx:185`
- `apps/web/src/components/DungeonPhase.tsx:200`

Plan expectation:

- `.plan/threejs.md:18` - canvas skips only animation IDs handled by Three to avoid double drawing.
- `.plan/threejs.md:36` - WebGL initialization failure falls back to canvas-only behavior.
- `.plan/threejs.md:193` through `.plan/threejs.md:199` - skip `fx.self.healing-pulse` only when the overlay path is active; one visual implementation owns the effect at a time.
- `.plan/threejs.md:284` - canvas renders the same animation when the feature is disabled or WebGL setup fails.

Problem:

`canvas-renderer` has a `skipHandledAnimationIds` option, but `DungeonCanvas` never accepts or passes it. `DungeonPhase` mounts the overlay when the flag is enabled, but it never learns whether the overlay actually initialized WebGL for a handled animation, so it cannot decide when to suppress the canvas implementation.

Impact:

After the overlay is made visible, the MVP effect will render twice. If WebGL fails, there is no owner-state proving that fallback happened; the implementation only falls back accidentally because the canvas path was never told to skip anything.

Suggested fix:

Represent Three ownership in one place. Let `ThreeEffectsOverlay` report initialized/failed state for the active handled IDs, and pass `skipHandledAnimationIds` into `DungeonCanvas` only after successful initialization. Keep the skip list empty when the flag is disabled, no handled animation is active, or WebGL setup fails.

Missing validation:

Add a `DungeonPhase`/`DungeonCanvas` integration-style component test for flag off, flag on plus renderer success, and flag on plus renderer failure, asserting the exact skip set passed to `renderMap`.

### P1 - WebGL setup failure contradicts the planned null/fallback behavior

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:79`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:92`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:93`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:257`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:261`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:317`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:339`

Plan expectation:

- `.plan/threejs.md:171` through `.plan/threejs.md:174` - render `null` when WebGL setup fails, and mount a stable overlay only when active.
- `.plan/threejs.md:246` through `.plan/threejs.md:247` - renderer creation is caught and canvas fallback remains available.

Problem:

When the renderer factory throws or returns `null`, the effect sets `rendererReady` false but the render path still returns a `<canvas>` because `shouldRender` remains true. The tests encode this wrong behavior by expecting a canvas on WebGL failure.

Impact:

The DOM can claim an overlay surface exists when no renderer owns it. This makes fallback ownership impossible to reason about and lets tests pass while the overlay is a blank inert canvas.

Suggested fix:

Track renderer initialization failure separately from `shouldRender`, return `null` for failed setup, and expose failure/success to the parent if the canvas skip decision lives there.

Missing validation:

Replace the current failure tests with assertions that failed WebGL produces no overlay and leaves canvas rendering unsuppressed.

### P2 - Effect identity and positioning are unstable

File/line:

- `apps/web/src/hooks/useConsumableAnimationState.ts:34`
- `apps/web/src/hooks/useConsumableAnimationState.ts:35`
- `apps/web/src/hooks/useFxAnimationState.ts:32`
- `apps/web/src/hooks/useFxAnimationState.ts:33`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:146`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:147`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:148`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:166`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:187`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:206`

Plan expectation:

- `.plan/threejs.md:135` - coordinate helpers convert grid positions to overlay world coordinates using current viewport and camera offset.
- `.plan/threejs.md:154` - healing pulse has orthographic alignment and deterministic disposal.

Problem:

The active animation hooks already provide stable `id` values, but `ThreeEffectsOverlay` keys effect instances by `${anim.type}:${anim.index}`. When arrays change, indexes can shift and an old Three instance can be reused for a different active animation. Position is also calculated only when the instance is created, so any viewport or camera offset change during an active animation leaves the effect behind.

Impact:

Rapid or overlapping effects can inherit the wrong lifecycle. Camera/viewport changes during an active animation can detach the Three pulse from the player tile.

Suggested fix:

Key instances by the hook-provided `anim.id` plus renderer category. Recompute position from current `vpLeft`, `vpTop`, and `cameraOffset` on every frame before calling `module.update(...)`.

Missing validation:

Add tests for simultaneous handled animations, removal of the first animation in the array, and viewport/camera changes while an effect remains active.

### P2 - The Three registry still permits a parallel raw-string namespace

File/line:

- `apps/web/src/rendering/three/three-effect-registry.ts:7`
- `apps/web/src/rendering/three/three-effect-registry.ts:13`
- `apps/web/src/rendering/three/three-effect-registry.ts:15`
- `apps/web/src/rendering/three/three-effect-registry.ts:19`
- `apps/web/src/rendering/three/three-effect-types.ts:29`
- `apps/web/src/rendering/three/effects/index.ts:17`

Plan expectation:

- `.plan/threejs.md:19` - use the repo's existing `AnimationId` identity.
- `.plan/threejs.md:30` - do not create a parallel effect ID namespace.
- `.plan/threejs.md:132` - define `ThreeEffectModule` keyed by `AnimationId`.
- `.plan/threejs.md:285` - registry is typed, keyed by existing `AnimationId` values, and contract-checked.

Problem:

The built-in effect now dot-walks through `animationRefs.self.healingPulse.id`, which is an improvement. But the registry itself is still `Map<string, ThreeEffectModule>`, `register(animationId: string, ...)`, `get(animationId: string)`, and `BUILT_IN_THREE_EFFECT_IDS: readonly string[]`. There are also two different `ThreeEffectModule` interfaces: one in `three-effect-registry.ts` and one in `three-effect-types.ts`.

Impact:

TypeScript still cannot prevent arbitrary string registration. The contract test can catch built-in IDs after the fact, but the public registry API still contradicts the plan's typed `AnimationId` boundary.

Suggested fix:

Import `type AnimationId` from `@dungeon/content`, use it in `register`, `get`, and `BUILT_IN_THREE_EFFECT_IDS`, and keep a single exported `ThreeEffectModule` contract.

Missing validation:

Add a type-level check or focused compile-time test that the registry API is not plain `string`.

### P2 - The tests still provide false confidence over the riskiest behavior

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:32`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:38`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:483`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:687`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:94`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:109`
- `apps/web/src/components/DungeonPhase.test.tsx:116`
- `apps/web/src/components/DungeonPhase.test.tsx:171`

Plan expectation:

- `.plan/threejs.md:64` through `.plan/threejs.md:76` - tests cover coordinate conversion, registry behavior, overlay wiring, canvas fallback, and manual visible behavior.
- `.plan/threejs.md:286` - unit and component tests cover overlay wiring and canvas fallback.

Problem:

`ThreeEffectsOverlay.test.tsx` passes with a mock scene that has no `add` method, because the tests do not drive an animation frame far enough to prove `healingPulseEffect.create`, `update`, `dispose`, or `handle.render(...)`. `useDungeonRenderState.test.ts` checks field names and forwarding, not the camera behavior that was previously broken. `DungeonPhase.test.tsx` mocks both `useDungeonRenderState` and `ThreeEffectsOverlay`, so it cannot catch real overlay rendering, real handled-ID filtering, or real fallback ownership.

Impact:

The tests are now green while missing the failures that matter most: visible overlay placement, effect size, module lifecycle, canvas skip ownership, WebGL failure behavior, and camera correctness.

Suggested fix:

Replace presence-only assertions with behavior assertions. Mock the effect registry or register a fixture effect whose create/update/dispose calls are observed under fake RAF. Test the real hook's camera math. Keep one component-level path that wires `DungeonPhase` to `DungeonCanvas` skip ownership without mocking the owner contract away.

Missing validation:

No automated test proves the player-visible MVP effect, and no manual QA evidence is recorded for `VITE_THREE_EFFECTS=true`.

### P3 - Contributor docs still document behavior the implementation does not provide

File/line:

- `docs/guides/adding-animation.md:136`
- `docs/guides/adding-animation.md:143`
- `docs/guides/adding-animation.md:163`
- `docs/guides/adding-animation.md:225`
- `docs/guides/ui-design.md:196`
- `docs/guides/ui-design.md:204`
- `docs/guides/ui-design.md:209`
- `docs/guides/ui-design.md:210`

Plan expectation:

- `.plan/threejs.md:210` through `.plan/threejs.md:217` - docs teach the new pattern and preserve the presentation-only boundary.

Problem:

`ui-design.md` says the overlay is "default in dev" even though `isThreeEffectsEnabledFlag()` defaults to disabled. It says Three.js overlay code is "tree-shaken from the bundle"; the implementation uses a lazy chunk, not tree-shaking, and the branch has no bundle evidence in the docs. It also says effect registration is skipped on WebGL failure, but registration happens at module import time before renderer creation. `adding-animation.md` teaches `BUILT_IN_THREE_EFFECT_IDS: readonly string[]` and contains a dispose example that references `context.scene` where `context` is not in scope.

Impact:

Contributors will copy incorrect defaults, incorrect type patterns, and incorrect lifecycle code. The docs overstate fallback behavior and bundle behavior.

Suggested fix:

Update docs to match the actual implementation after the implementation is fixed: disabled by default, lazy-loaded dynamic chunk rather than "tree-shaken", registration sourced from `AnimationId`, and disposal examples that store `scene` on the returned instance.

Missing validation:

No doc-path or example check catches these semantic mistakes.

### P3 - A local scratch script remains in the branch

File/line:

- `filter-errors.mjs:1`
- `filter-errors.mjs:2`
- `filter-errors.mjs:3`
- `filter-errors.mjs:4`

Plan expectation:

- `.plan/threejs.md:11` - the work is scoped to the Three overlay and validation.
- `.plan/threejs.md:43` through `.plan/threejs.md:51` - owned artifacts are web renderer files, feature flag, lockfile, and required docs.

Problem:

`filter-errors.mjs` is a root-level scratch script with a hardcoded absolute path into a local `.claude` tool-results directory.

Impact:

This is non-reproducible local tooling noise and should not ship with the Three overlay branch.

Suggested fix:

Delete the script or move a generalized version into documented repo tooling with tests.

Missing validation:

No tracked-artifact guard caught this local absolute path.

## Residual Risk

The remaining critical risk is that validation can be green while the browser-visible MVP is false. Before accepting this branch, the repair sequence should be:

1. Pin the overlay canvas to the map container and prove its bounding rect matches `DungeonCanvas`.
2. Scale the healing pulse in tile/pixel units so it is visibly larger than a sub-pixel dot.
3. Restore pixel-based camera offset semantics in `useDungeonRenderState`.
4. Wire canvas skip ownership only after successful overlay initialization.
5. Return `null` and preserve canvas fallback on WebGL setup failure.
6. Replace presence-only tests with effect lifecycle, positioning, fallback, and real hook behavior tests.
7. Fix the registry types and docs.
8. Run `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate`.
