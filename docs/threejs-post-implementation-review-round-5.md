# Three.js Overlay Post-Implementation Review - Round 5

Review basis:

- Plan: `.plan/threejs.md`
- Prior reviews:
  - `docs/threejs-post-implementation-review.md`
  - `docs/threejs-post-implementation-review-round-2.md`
  - `docs/threejs-post-implementation-review-round-3.md`
  - `docs/threejs-post-implementation-review-round-4.md`

Review date: 2026-05-29

Branch/worktree: `threejs`

Bottom line: not acceptable yet. The current worktree fixes several earlier blockers: the overlay is lazily gated by handled animation presence, uses the mounted canvas, sizes the healing pulse in tile-scale pixel space, drives the effect from shared animation progress, and forwards overlay-owned IDs into `DungeonCanvas`. The remaining issues are still real: the shared render hook regresses odd-width viewport centering, the required contract test is not discoverable through the documented Vitest command, and the visual MVP still lacks browser/pixel evidence.

## Validation Evidence During Review

- `pnpm vitest run apps/web/src/hooks/useDungeonRenderState.test.ts apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts apps/web/src/components/DungeonPhase.test.tsx apps/web/src/components/DungeonCanvas.test.tsx apps/web/src/sprites/canvas-renderer.test.ts tests/contracts/three-effects-animation-refs.contract.test.ts` - passed 146 web tests, but did not discover the contract file.
- `pnpm vitest run tests/contracts/three-effects-animation-refs.contract.test.ts` - failed with "No test files found".
- `pnpm vitest run --project tests` - failed with "No test files found".
- `pnpm exec vitest run --config tests/vitest.config.ts tests/contracts/three-effects-animation-refs.contract.test.ts` - passed 3 contract tests.
- `pnpm run check:fast` - passed with 9 warnings, including two in `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx`.
- `pnpm validate:quick` - passed; changed tests reported 190 passed; build passed.
- `pnpm validate` - passed; full test run reported 2020 passed; build and package exports passed.
- Build output includes lazy chunk `ThreeEffectsOverlay-CPW-kW_O.js` at 469.45 kB / 118.63 kB gzip.

Passing validation is not sufficient for acceptance because the contract test path in the plan is broken unless the tests config is supplied manually, and no browser/manual evidence proves the WebGL pulse is actually visible over the dungeon.

## Findings

### P1 - Odd-sized viewports are shifted one tile from the pre-existing canvas behavior

File/line:

- `apps/web/src/hooks/useDungeonRenderState.ts:48`
- `apps/web/src/hooks/useDungeonRenderState.ts:51`
- `apps/web/src/hooks/useDungeonRenderState.ts:54`
- `apps/web/src/hooks/useDungeonRenderState.ts:55`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:184`
- `apps/web/src/hooks/useDungeonRenderState.test.ts:206`

Plan expectation:

- `.plan/threejs.md:17` - move the existing viewport origin and camera offset calculation into shared state.
- `.plan/threejs.md:35` - current canvas-only behavior remains unchanged when the flag is disabled.
- `.plan/threejs.md:117` - current sprite rendering behavior is unchanged with the feature flag off.
- `.plan/threejs.md:243` - shared render state mitigates coordinate drift.

Problem:

The old `DungeonCanvas` viewport formula used `player.x - Math.floor(vpWidth / 2)`. The extracted hook now uses `player.x - vpTilesWidth / 2` followed by `Math.floor(...)`. For even widths these match. For odd widths they do not: at the minimum viewport width of 15, the old left edge was `player.x - 7`, while the new left edge is `player.x - 8`.

Impact:

This is a flag-off primary renderer regression. On odd viewport dimensions, including the configured 15-tile minimum width, the player is shifted one tile right/down from the previous centered position. The Three overlay then faithfully shares the wrong viewport origin, so canvas and WebGL can agree with each other while still violating the plan's "unchanged" constraint.

Suggested fix:

Restore the pre-existing viewport formula in `useDungeonRenderState`: `map.playerPosition.x - Math.floor(vpTilesWidth / 2)` and the equivalent y calculation, still clamped to the minimum visible cell coordinates. Add explicit hook tests for odd viewport width 15 and odd height, plus a regression test proving the player lands on the same screen tile as the old `DungeonCanvas` behavior.

Missing validation:

No current test covers odd viewport centering. The hook tests cover clamping and movement camera offset, but not parity behavior.

### P1 - The required contract test is not runnable through the documented command

File/line:

- `.plan/threejs.md:73`
- `.plan/threejs.md:158`
- `.plan/threejs.md:265`
- `tests/vitest.config.ts:14`
- `tests/vitest.config.ts:17`
- `tests/contracts/three-effects-animation-refs.contract.test.ts:19`

Plan expectation:

- `.plan/threejs.md:73` - contract tests verify every built-in Three effect ID exists in live content.
- `.plan/threejs.md:158` - the contract test proves every built-in ID exists.
- `.plan/threejs.md:265` - `pnpm vitest run tests/contracts/three-effects-animation-refs.contract.test.ts` is the targeted validation command.
- `.plan/threejs.md:285` - the Three registry is contract-checked against live content.

Problem:

The documented command fails with "No test files found". `pnpm vitest run --project tests` also finds no files. The test only runs when bypassing the workspace project and passing the config explicitly: `pnpm exec vitest run --config tests/vitest.config.ts tests/contracts/three-effects-animation-refs.contract.test.ts`.

Impact:

The branch can claim a contract test exists while the plan's own command cannot execute it. Worse, `pnpm validate` reported 2020 passing tests, but the root `tests` project discovery is demonstrably broken in direct Vitest usage. That undermines the live-content guard the plan relied on to prevent unregistered Three effect IDs.

Suggested fix:

Fix root test project discovery so `pnpm vitest run tests/contracts/three-effects-animation-refs.contract.test.ts` and `pnpm vitest run --project tests` both find the contract suite, or move the check into an already-discovered contract location. Then rerun the plan's exact command, `pnpm test`, and `pnpm validate`.

Missing validation:

The contract passes only with an explicit `--config tests/vitest.config.ts` command, which is not the command in the plan or the default validation path.

### P1 - The visual MVP is still not proven in a browser

File/line:

- `.plan/threejs.md:55`
- `.plan/threejs.md:76`
- `.plan/threejs.md:236`
- `.plan/threejs.md:283`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx:845`
- `apps/web/src/rendering/three/effects/healing-pulse-effect.test.ts:44`

Plan expectation:

- `.plan/threejs.md:55` - a player sees the Three.js healing pulse centered on the player tile.
- `.plan/threejs.md:76` - manual QA verifies `VITE_THREE_EFFECTS`, health potion use, centering, fade, click pass-through, and no WebGL console errors.
- `.plan/threejs.md:236` - WebGL/browser manual QA notes are recorded.
- `.plan/threejs.md:283` - `ThreeEffectsOverlay` renders a transparent, pointer-safe WebGL healing pulse.

Problem:

The tests now prove object lifecycle against a mocked renderer and prove the effect has a tile-visible radius mathematically. They still do not prove real WebGL pixels are visible in the browser, that the WebGL canvas and dungeon canvas share a bounding rect at runtime, or that a real health potion event produces a centered pulse with `VITE_THREE_EFFECTS=true`.

Impact:

This MVP is explicitly a visual overlay boundary. A mocked renderer test can pass while the browser path is blank, hidden behind another layer, context-failed, or visually misaligned. Prior rounds already found exactly that class of bug, so accepting without pixel/browser evidence is too weak.

Suggested fix:

Add Playwright coverage or a documented manual QA note that starts the app with `VITE_THREE_EFFECTS=true`, triggers `health_potion` or `greater_health_potion`, asserts the overlay canvas overlaps the dungeon canvas, verifies nontransparent pixels appear near the player tile during the pulse, and confirms clicks still reach `DungeonCanvas`. Keep the manual fallback check for `VITE_THREE_EFFECTS=false`.

Missing validation:

No screenshot, canvas-pixel check, or manual QA record was found in the branch.

### P2 - The canvas skip API is ambiguous, and several tests pass the skip list through an ignored path

File/line:

- `apps/web/src/sprites/canvas-renderer.ts:59`
- `apps/web/src/sprites/canvas-renderer.ts:62`
- `apps/web/src/sprites/canvas-renderer.ts:523`
- `apps/web/src/sprites/canvas-renderer.ts:525`
- `apps/web/src/sprites/canvas-renderer.test.ts:289`
- `apps/web/src/sprites/canvas-renderer.test.ts:291`
- `apps/web/src/sprites/canvas-renderer.test.ts:403`
- `apps/web/src/sprites/canvas-renderer.test.ts:407`
- `apps/web/src/sprites/canvas-renderer.test.ts:425`
- `apps/web/src/sprites/canvas-renderer.test.ts:428`

Plan expectation:

- `.plan/threejs.md:18` - canvas must skip IDs handled by Three to avoid double drawing.
- `.plan/threejs.md:194` - add a renderer option for animation IDs handled by the Three overlay.
- `.plan/threejs.md:195` - skip `fx.self.healing-pulse` only when the overlay path is active.
- `.plan/threejs.md:199` - one visual implementation owns the MVP effect at a time.

Problem:

`PlayerEffects` declares `skipHandledAnimationIds`, but `renderMap` also accepts a separate positional `skipHandledAnimationIds` parameter. The implementation only uses the positional parameter. Several tests pass `{ skipHandledAnimationIds: [...] }` as `playerEffects`, which is ignored by the implementation; those tests still pass because their assertions do not require the skip list to take effect.

Impact:

The public renderer API now has two apparent skip paths, one of which silently does nothing. That is a future double-rendering/fallback footgun, and the tests encode the wrong call shape in multiple places.

Suggested fix:

Use one API. Prefer a structured render options object over another positional argument, or remove `skipHandledAnimationIds` from `PlayerEffects` entirely and update the tests to pass the real parameter. Add a test that fails if `PlayerEffects.skipHandledAnimationIds` is accepted but ignored, or make that property impossible to pass.

Missing validation:

The current canvas tests prove the positional parameter in some cases, but also include false-confidence cases that pass skip data through the ignored `PlayerEffects` object.

### P2 - Effect positioning relies on an implicit `instance.group` convention that the type contract does not enforce

File/line:

- `apps/web/src/rendering/three/three-effect-types.ts:31`
- `apps/web/src/rendering/three/three-effect-types.ts:39`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:19`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:21`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:261`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:262`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:263`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:264`

Plan expectation:

- `.plan/threejs.md:58` - a developer can add a second Three-backed animation by registering another `AnimationId` module without editing a large renderer switch.
- `.plan/threejs.md:132` - define a `ThreeEffectModule` keyed by `AnimationId`.
- `.plan/threejs.md:135` - coordinate helpers convert positions for the overlay.
- `.plan/threejs.md:154` - effects have orthographic alignment and deterministic lifecycle.

Problem:

`ThreeEffectModule` only requires `create`, `update`, and `dispose`. It does not require the returned instance to expose a `group`, `object`, or positioning hook. The overlay then casts `unknown` to `{ group?: { position: ... } }` and silently positions only modules that happen to return that shape.

Impact:

The MVP healing module works because it returns `group`, but the reusable module contract is weaker than the renderer assumes. A second registered effect can type-check, pass registry tests, and render at the origin or never move to the player tile, with no type error.

Suggested fix:

Make positioning part of the contract. Options: require `create()` to return an object with `object: THREE.Object3D`, add `setPosition(instance, screenPos)` to `ThreeEffectModule`, or pass position data into `update()` through a typed context. Then update tests with a fixture module that proves a registered second effect receives position updates without relying on an undocumented property.

Missing validation:

No test proves the public effect contract is sufficient for an independently authored second effect.

### P2 - Built-in Three effect metadata and actual registration can drift

File/line:

- `apps/web/src/rendering/three-effect-metadata.ts:7`
- `apps/web/src/rendering/three-effect-metadata.ts:8`
- `apps/web/src/rendering/three/effects/index.ts:13`
- `apps/web/src/rendering/three/effects/index.ts:15`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:11`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:13`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:332`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:333`

Plan expectation:

- `.plan/threejs.md:30` - key Three effects by existing `AnimationId` values; do not create a parallel namespace.
- `.plan/threejs.md:58` - a developer can add a second Three-backed animation by registering another `AnimationId` module.
- `.plan/threejs.md:155` - export a list of built-in Three effect IDs for contract validation.
- `.plan/threejs.md:285` - registry is typed, keyed by existing `AnimationId` values, and contract-checked.

Problem:

The lightweight metadata list controls whether the lazy overlay is loaded. The heavy `effects/index.ts` registration controls whether the implementation can actually resolve a module. These are two separate places that must be edited together. There is no test proving every metadata ID resolves after built-in effects are registered, or that every registered built-in appears in metadata.

Impact:

A future effect can be registered but never lazy-loaded because metadata was not updated, or listed in metadata but not registered, causing the wrapper to download the Three chunk and then render nothing. The contract test only proves metadata IDs exist in content; it does not prove they have registered Three modules.

Suggested fix:

Create one source of truth for built-ins that is safe for the lightweight wrapper to import, or add a focused test that imports `effects/index.ts` and asserts every `BUILT_IN_THREE_EFFECT_IDS` entry resolves through `three-effect-registry.get(...)`. If duplicate metadata remains necessary for bundle-splitting, document that as an accepted deviation and guard it.

Missing validation:

No registry/metadata parity test exists.

### P2 - The docs still teach a sub-pixel Three effect pattern

File/line:

- `docs/guides/adding-animation.md:131`
- `docs/guides/adding-animation.md:135`
- `docs/guides/adding-animation.md:139`
- `docs/guides/adding-animation.md:140`
- `docs/guides/ui-design.md:138`
- `docs/guides/ui-design.md:160`
- `docs/guides/ui-design.md:180`

Plan expectation:

- `.plan/threejs.md:60` - contributors can read docs and understand when to add a Three module.
- `.plan/threejs.md:211` - docs explain animation refs, presenter emission, and renderer implementations.
- `.plan/threejs.md:212` - docs explain how to add Three effects and contract coverage.
- `.plan/threejs.md:216` - docs teach the new pattern.

Problem:

The `adding-animation` sample creates `new THREE.CircleGeometry(0.45, 24)` and adds it to the scene without scaling the group by `context.tileSize` or using a pixel radius, even though the overlay camera is configured in screen-pixel coordinates. That is the same unit mistake that made earlier healing pulses effectively invisible. `ui-design.md` also refers to `ThreeOverlay`/`ThreeOverlay.tsx`, not the actual `ThreeEffectsOverlay` component.

Impact:

The implementation has been fixed, but the contributor guide still teaches future effects to be sub-pixel sized in this coordinate system. That will reproduce the same invisible-effect bug on the next Three module.

Suggested fix:

Update the docs sample to either create geometry with `context.tileSize * radiusFraction` or scale the group by `context.tileSize`, and explicitly state that the current orthographic camera uses screen pixels. Rename examples to `ThreeEffectsOverlay` and use repo-valid import conventions.

Missing validation:

No docs validation catches unit-space examples that contradict the renderer.

### P3 - The Three overlay still ships with lint warnings

File/line:

- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:164`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:298`

Plan expectation:

- `.plan/threejs.md:229` through `.plan/threejs.md:231` - run validation gates.
- `.plan/threejs.md:288` - `pnpm validate` passes.

Problem:

Validation passes, but ESLint reports two warnings in the new overlay: a `react-hooks/exhaustive-deps` cleanup warning around `effectInstancesRef.current`, and an unnecessary conditional warning for the second `shouldRender` check before returning `null`.

Impact:

The warnings are not merge-blocking, but they leave noisy evidence in the exact new renderer path. The unnecessary condition is trivial cleanup. The ref warning deserves either a small refactor or a deliberate suppression with rationale.

Suggested fix:

Remove the duplicated `shouldRender` conditional and refactor the cleanup to copy the ref value inside the effect if that matches the intended disposal semantics.

Missing validation:

No gate currently treats warnings as failures.

## Scope Note

`git diff --name-status main...HEAD` still reports 867 files against local `main`, far beyond the Three MVP plan. If the intended PR target is `main`, this is a plan-scope blocker against `.plan/threejs.md:11`, `.plan/threejs.md:37`, and `.plan/threejs.md:46`. If the intended target is a later integration branch, document that base explicitly in the PR/review notes so the Three overlay can be reviewed against the correct delta.

## Resolved Since Round 4

- The healing pulse is no longer sub-pixel sized; `healing-pulse-effect.ts` now scales the group by `context.tileSize`.
- The overlay now drives `module.update(...)` from the shared animation state's `progress`.
- The lazy wrapper now avoids loading the heavy Three chunk unless a handled animation is active.
- `DungeonCanvas` now receives and forwards `skipHandledAnimationIds`.
- `useDungeonRenderState` now restores movement camera offset from `getMoveTravelOffsetPx(...)`.

