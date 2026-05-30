# Three.js Dungeon Animation Migration Review - Round 8

Review basis:

- Plan: `plan.md`
- Requested skill: `.claude/skills/post-implementation-review/SKILL.md`
- Branch/worktree: `threejs`
- Review date: 2026-05-29

Bottom line: not acceptable. The branch adds a lot of Three.js-looking infrastructure, but the shipped dungeon path is still the repaired MVP `ThreeEffectsOverlay` path that only handles `fx.self.healing-pulse`. The generated registry, new module catalog, ownership state, entity motion helpers, status helpers, and combat-label helpers are largely disconnected from the production UI. This does not satisfy the plan's "all dungeon/combat animations move to Three ownership" goal.

## Review Scope Notes

- `git diff --shortstat origin/main...HEAD`: `679 files changed, 43390 insertions(+), 17032 deletions(-)`.
- `git diff --shortstat main...HEAD`: `933 files changed, 73287 insertions(+), 17977 deletions(-)`.
- I reviewed against `plan.md`, not against a general "does this compile" bar.

## Findings

### P0 - Mandatory `check:fast` gate is red

File/line:

- `plan.md:101`
- `plan.md:423`
- `package.json:18`
- `apps/web/src/rendering/three/three-guardrails.test.ts:117`
- `.validate-logs/typecheck.log:1`

Plan expectation:

Completion requires `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate` in order, stopping on first failure.

Problem:

`pnpm run check:fast` fails during `pnpm run lint:types:all`, specifically `node scripts/typecheck-tests.mjs`. The current diagnostic is:

```text
apps/web/src/rendering/three/three-guardrails.test.ts(117,31): error TS2345:
Argument of type '... | undefined' is not assignable to parameter of type 'AnimationId'.
```

The failing test passes `ALL_TEST_IDS[0]` directly to `getAnimationModule(...)`; TypeScript correctly sees indexed array access as possibly `undefined`.

Impact:

The implementation cannot be claimed complete by repo rules. `validate:quick` and `validate` were not run because the mandatory first gate failed.

Suggested fix:

Fix the test type error without weakening the assertion, for example by destructuring or non-null asserting after proving the fixture list is non-empty. Then rerun the gates in the required order.

Missing validation:

`pnpm validate:quick` and `pnpm validate` remain unexecuted for this review run because `check:fast` failed first.

### P0 - Branch scope is far outside the locked migration plan

File/line:

- `plan.md:36`
- `plan.md:42`
- `apps/server/src/app.ts:1`
- `packages/game-core/src/engine/game-engine.ts:1`
- `packages/content/src/balance/tables.ts:1`
- `packages/game-contracts/src/types/game-state.ts:1`

Plan expectation:

The plan explicitly excludes game-core, server command handling, persistence, combat math, movement rules, AI, content declarations outside animation ownership, unrelated UI layout, content tuning, and branch hygiene changes.

Problem:

The branch is not a Three animation migration slice. It includes broad changes across server, game-core, contracts, content catalogs, abilities, persistence/state, docs, CI, lint infrastructure, and generated or compiled artifacts. The remote-base diff is 679 files. The local-main diff is 933 files.

Impact:

This branch cannot be reviewed or merged as the approved plan. Any validation signal is contaminated by unrelated runtime and infrastructure changes. Regressions in gameplay, persistence, content, or server behavior can ship under a Three.js review.

Suggested fix:

Split or rebase the Three migration onto a branch containing only plan-owned files. Move unrelated server/core/content/persistence/CI/doc changes into separate plans and reviews, or explicitly document them as accepted deviations before review.

Missing validation:

No validation proves the Three migration independently from the unrelated branch churn.

### P0 - Production still uses the old one-effect overlay, not the generated Three animation backend

File/line:

- `plan.md:176`
- `plan.md:180`
- `plan.md:181`
- `plan.md:259`
- `apps/web/src/components/DungeonPhase.tsx:16`
- `apps/web/src/components/DungeonPhase.tsx:27`
- `apps/web/src/components/DungeonPhase.tsx:147`
- `apps/web/src/components/DungeonPhase.tsx:205`
- `apps/web/src/rendering/three-effect-metadata.ts:7`
- `apps/web/src/rendering/three-effect-metadata.ts:17`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:7`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:9`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:11`

Plan expectation:

Workstream 2 requires `ThreeEffectsOverlay.tsx` to become a compatibility re-export of `ThreeAnimationOverlay.tsx`, new code to use `ThreeAnimationOverlay`, and handled IDs to derive from the generated Three registry instead of manual metadata.

Problem:

`DungeonPhase` still imports and renders `ThreeEffectsOverlay`, and it decides whether to render the overlay with `collectHandledThreeAnimationIds()`. That metadata file still contains only `animationRefs.self.healingPulse.id`. The production overlay still imports `three-effect-registry` and `three-effect-metadata`, not `three-animation-registry` or the generated module registry.

Impact:

The 24 generated Three modules are dead in the actual game path. In Three mode, projectile, impact, aoe, utility, status, movement, and combat-label animations still do not route through the new generated backend. Only the old healing-pulse MVP can render through WebGL.

Suggested fix:

Make `apps/web/src/components/DungeonPhase.tsx` render the lazy `ThreeAnimationOverlay` wrapper. Convert `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx` into a real compatibility re-export of `ThreeAnimationOverlay`. Delete or deprecate `three-effect-metadata.ts` after handled IDs come from the generated registry/overlay ownership report.

Missing validation:

Add a component test that fails if `DungeonPhase` renders `three-effects-overlay` instead of `three-animation-overlay`, and browser proofs for non-healing categories.

### P0 - The generated Three registry is never initialized in production

File/line:

- `plan.md:179`
- `plan.md:273`
- `apps/web/src/rendering/three/generated/index.ts:36`
- `apps/web/src/rendering/three/three-animation-registry.ts:20`
- `apps/web/src/rendering/three/three-animation-registry.ts:34`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:39`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:111`
- `tests/contracts/three-animation-coverage.contract.test.ts:21`
- `tests/contracts/three-animation-coverage.contract.test.ts:44`

Plan expectation:

The overlay resolves active animations through the generated Three registry. Generated registration belongs in module initialization or a generated registration function.

Problem:

`initializeThreeAnimationModules()` exists, but the only non-generated production reference search finds it in the contract test. `ThreeAnimationOverlay` calls `getAnimationModule()`, but no production import initializes the registry first. If the app were switched to `ThreeAnimationOverlay`, the registry would be empty and no animations would resolve.

Impact:

The generalized backend is nonfunctional outside tests that explicitly mock or initialize the registry. This also explains why component tests pass while production wiring is broken.

Suggested fix:

Import the generated registration module from the lazy Three implementation initialization path, or have the generated module self-register on import. Keep registration out of React render bodies, but make the lazy backend initialize before resolving active animations.

Missing validation:

Add a production-wiring test that imports the lazy overlay path without mocking `three-animation-registry` and proves at least one generated module resolves.

### P0 - Renderer mode is implemented contrary to the plan and ignored by the production path

File/line:

- `plan.md:43`
- `plan.md:149`
- `plan.md:150`
- `plan.md:381`
- `apps/web/src/config/feature-flags.ts:22`
- `apps/web/src/config/feature-flags.ts:34`
- `apps/web/src/config/feature-flags.ts:38`
- `apps/web/src/config/feature-flags.ts:43`
- `apps/web/src/components/DungeonPhase.tsx:146`
- `apps/web/src/config/feature-flags.test.ts:68`
- `apps/web/src/rendering/three/three-guardrails.test.ts:5`

Plan expectation:

`getAnimationRendererMode()` defaults to `canvas`. `three` is only enabled by explicit env/global override until the final rollout commit, after browser proof for every category. `isThreeEffectsEnabledFlag()` is a compatibility alias that delegates to the new mode until callers are migrated.

Problem:

`getAnimationRendererMode()` defaults to `three` now, and tests encode that as expected behavior. Meanwhile, `DungeonPhase` does not call `getAnimationRendererMode()` at all. It still uses `isThreeEffectsEnabledFlag()`, which reads only `VITE_THREE_EFFECTS`.

Impact:

`VITE_ANIMATION_RENDERER_MODE=canvas` does not actually control the dungeon overlay. The branch claims final rollout default behavior before the plan's category browser proofs exist, while the production path still gates on the old flag.

Suggested fix:

Make `getAnimationRendererMode()` default to `canvas`. Make `isThreeEffectsEnabledFlag()` delegate to `getAnimationRendererMode() === 'three'` during migration. Migrate `DungeonPhase` to the renderer-mode API. Flip the default only in the dedicated final rollout commit after all browser proofs pass.

Missing validation:

Add a `DungeonPhase` test proving `VITE_ANIMATION_RENDERER_MODE=canvas` suppresses Three loading even if legacy flags are absent.

### P0 - Entity movement and bump/lunge animation are still canvas-owned

File/line:

- `plan.md:285`
- `plan.md:300`
- `plan.md:301`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:86`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:153`
- `apps/web/src/components/DungeonPhase.tsx:193`
- `apps/web/src/components/DungeonPhase.tsx:211`
- `apps/web/src/sprites/canvas-renderer.ts:542`
- `apps/web/src/sprites/canvas-renderer.ts:582`
- `apps/web/src/sprites/canvas-renderer.ts:595`
- `apps/web/src/sprites/canvas-renderer.ts:615`
- `apps/web/src/rendering/three/entities/three-entity-motion.ts:176`

Plan expectation:

Three renders active moving entities and active bump attackers as sprite planes. Canvas suppresses those exact active entity IDs only while Three owns the entity animation.

Problem:

`ThreeAnimationOverlay` accepts `bumpAnimations` and `moveAnimations` props but does not destructure or render them. `renderMap()` still builds move/bump lookup maps, computes offsets, and draws the animated entity through canvas. The `shouldCanvasSuppressEntity()` helper exists but is not wired into `DungeonPhase`, `DungeonCanvas`, or `renderMap()`.

Impact:

Movement and attack lunge remain owned by canvas, directly violating the goal to remove animated entity transforms from the canvas renderer. If Three entity rendering is later added without suppression, this path will double-render.

Suggested fix:

Wire active `moveAnimations` and `bumpAnimations` through the Three overlay, render entity sprite planes there, report owned `entityIds` after WebGL success, and make `renderMap()` skip those entity IDs only when ownership is active.

Missing validation:

No browser proof shows moving entity WebGL pixels or absence of duplicate canvas entity rendering.

### P0 - Status presentation ownership is not implemented

File/line:

- `plan.md:311`
- `plan.md:325`
- `plan.md:326`
- `plan.md:327`
- `plan.md:328`
- `packages/presenter/src/game-view.ts:236`
- `packages/presenter/src/animation-metadata.ts:85`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:90`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:153`
- `apps/web/src/sprites/canvas-renderer.ts:74`
- `apps/web/src/sprites/canvas-renderer.ts:617`

Plan expectation:

`StatusPresentationView` gets `animationId?: AnimationId`, status metadata sources `animationRefs.status.goldRingPulse.id`, Three renders persistent status rings/entity scale, and canvas status scale/ring drawing becomes fallback-only.

Problem:

`StatusPresentationView` has no `animationId`. `PLAYER_STATUS_PRESENTATION` contains only scale/ring styling, no animation ref. `ThreeAnimationOverlay` accepts `statusPresentations` but never uses it. `renderMap()` always resolves and draws player status scale/ring via canvas.

Impact:

Status pulses and entity scale pulses remain canvas-owned in all modes. There is no renderer-neutral presenter identity for status animation ownership.

Suggested fix:

Add `animationId?: AnimationId` to `StatusPresentationView`, source it from `animationRefs.status.goldRingPulse.id`, render status presentations in the Three overlay after WebGL success, and pass a status suppression flag to the canvas fallback path.

Missing validation:

No presenter test proves status animation IDs are display-ready, and no browser proof samples status pulse pixels on `three-animation-overlay`.

### P0 - Combat indicators and defender-hit flashes are still DOM/hook-only, not Three-owned

File/line:

- `plan.md:335`
- `plan.md:339`
- `plan.md:346`
- `plan.md:352`
- `plan.md:353`
- `plan.md:354`
- `plan.md:355`
- `apps/web/src/components/DungeonPhase.tsx:224`
- `apps/web/src/components/CombatIndicators.tsx:20`
- `apps/web/src/components/CombatIndicators.tsx:51`
- `apps/web/src/rendering/three/text/three-combat-label.ts:40`
- `apps/web/src/rendering/three/text/combat-indicator-state.ts:60`
- `apps/web/src/hooks/useDefenderHitState.ts:35`
- `apps/web/src/rendering/three/three-animation-ownership.ts:51`

Plan expectation:

Floating label state moves into a shared hook, Three renders combat labels as text textures, DOM `CombatIndicators` renders only in fallback mode, and Three renders defender-hit flash/shake for `defender-hit` events.

Problem:

`DungeonPhase` always mounts `CombatIndicators`. `CombatIndicators` owns its own DOM state and emits DOM labels from window events. The Three text helper and combat ownership helpers are not used by the overlay. There is no `apps/web/src/hooks/useCombatIndicatorState.ts`, and there is no `three-defender-hit-flash.ts` module.

Impact:

Damage/heal/status/gold labels and defender-hit feedback remain outside the Three backend. The planned "one visual owner at a time" model is not enforced for combat labels.

Suggested fix:

Move label state into the planned shared hook, feed it to both DOM fallback and Three overlay, report `combatIndicators: true` only after WebGL label rendering initializes, suppress DOM labels in Three ownership mode, and add a defender-hit flash module wired to `useDefenderHitState()`.

Missing validation:

No browser proof shows Three-rendered label pixels or defender-hit flash pixels. DOM fallback absence in Three mode is unproven.

### P1 - Transient Three positioning ignores target and blast positions

File/line:

- `plan.md:273`
- `plan.md:275`
- `packages/presenter/src/game-view.ts:356`
- `packages/presenter/src/game-view.ts:360`
- `packages/presenter/src/game-view.ts:361`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:55`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:104`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:322`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:326`
- `apps/web/src/sprites/canvas-renderer.ts:413`
- `apps/web/src/sprites/canvas-renderer.ts:429`
- `apps/web/src/sprites/canvas-renderer.ts:435`

Plan expectation:

Transient effects recompute position every frame from `playerPos`, `targetPos`, `blastPositions`, `vpLeft`, `vpTop`, and `cameraOffset`.

Problem:

`ThreeAnimationOverlay` stores only `playerPos` on `ResolvedAnimation`. It never carries `targetPos` or `blastPositions`. Every module instance is positioned at `anim.playerPos`. The canvas fallback has category-aware anchoring for aoe blasts, impact targets, projectile targets, and blast positions; the Three overlay does not.

Impact:

Even if the generated overlay were wired and initialized, projectiles, impacts, aoes, trap sparks, and bomb blasts would render at the player tile instead of the intended target/blast tiles.

Suggested fix:

Carry target and blast positions through `ResolvedAnimation`, compute anchors by animation category/ref metadata, and support multiple instances for multi-tile blast effects. Mirror the canvas anchor semantics in the Three presenter-to-renderer bridge, not inside individual modules.

Missing validation:

Add component tests that assert `setPosition()` receives target tile coordinates for projectile/impact and every blast tile for aoe.

### P1 - Browser proof is still the old one-scenario healing-pulse test

File/line:

- `plan.md:95`
- `plan.md:96`
- `plan.md:97`
- `plan.md:98`
- `plan.md:120`
- `plan.md:122`
- `tests/e2e/three-effects-overlay.spec.ts:222`
- `tests/e2e/three-effects-overlay.spec.ts:227`
- `tests/e2e/three-effects-overlay.spec.ts:250`
- `tests/e2e/three-effects-overlay.spec.ts:300`

Plan expectation:

`tests/e2e/three-animation-backend.spec.ts` proves visible WebGL pixels on `data-testid="three-animation-overlay"` for movement, bump/attack, projectile, impact, aoe, self/consumable, status pulse, combat label, WebGL failure fallback, pointer safety, and a negative proof that canvas fallback cannot satisfy the assertion.

Problem:

There is no `tests/e2e/three-animation-backend.spec.ts`. The only Three E2E file is still `three-effects-overlay.spec.ts`; it looks for `three-effects-overlay`, uses a healing potion, and only proves the old healing-pulse overlay path.

Impact:

The exact review-loop failure called out by the plan remains: tests can pass while the wrong renderer/path owns most animations. There is no browser evidence for any generated module category or for the new overlay test ID.

Suggested fix:

Add the planned `three-animation-backend.spec.ts` and drive deterministic scenarios for every category. Sample `gl.readPixels()` from `three-animation-overlay`, include WebGL-failure fallback, and include a negative assertion that the 2D canvas alone cannot satisfy the Three pixel proof.

Missing validation:

The planned proof command `pnpm exec playwright test tests/e2e/three-animation-backend.spec.ts --reporter=line` cannot run because the file does not exist.

### P1 - Deterministic guardrails required by the plan are missing from `check:fast`

File/line:

- `plan.md:105`
- `plan.md:107`
- `plan.md:110`
- `plan.md:112`
- `plan.md:377`
- `package.json:18`
- `package.json:41`
- `package.json:42`
- `scripts/check-audit-guardrails.mjs:81`

Plan expectation:

Add `check:three-animations`, include it in `pnpm run check:fast`, and add a Three import-boundary guardrail script. Missing modules and eager static Three imports must fail deterministic checks before merge.

Problem:

There is no `check:three-animations` package script. `check:fast` does not run a Three coverage guardrail. The branch has a contract test for coverage, but it is not exposed as the planned guardrail command and is not part of `check:fast`.

Impact:

The pre-commit gate can pass without running the explicit Three coverage proof. A future missing generated module can avoid the exact deterministic guardrail the plan required.

Suggested fix:

Add `scripts/guardrails/check-three-animation-coverage.ts` and a `check:three-animations` script, then include it in `check:fast`. Add or rename an explicit Three import-boundary guardrail matching the plan, or document the generic optional-import guardrail as an accepted deviation with equivalent known-bad coverage.

Missing validation:

No `pnpm run check:three-animations` command exists to execute the plan's proof command.

### P1 - Shared module contract does not enforce the promised visibility or disposal requirements

File/line:

- `plan.md:206`
- `plan.md:208`
- `plan.md:209`
- `plan.md:210`
- `plan.md:251`
- `plan.md:256`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:4`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:9`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:10`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:56`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:99`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:105`

Plan expectation:

The shared contract must prove render-relevant state, tile-scale geometry, and GPU resource disposal. A module sized at `0.4` without multiplying by tile size must fail. A module that omits geometry/material/texture disposal must fail.

Problem:

The helper comments claim those guarantees, but the actual assertions only check that methods do not throw and that `scene.add`/`scene.remove` are called. It never inspects geometry dimensions, material opacity/renderability, texture/material/geometry disposal, or visible pixels.

Impact:

Module tests can pass for invisible or leaking implementations. This weakens the main guardrail intended to prevent the earlier sub-pixel and disposal mistakes.

Suggested fix:

Extend the helper to inspect standard instance shapes or require modules to expose test metadata. At minimum, assert tile-scale geometry/material visibility and spy on `dispose()` calls for geometry, material, and textures. Keep negative tests that prove intentionally tiny or non-disposing modules fail.

Missing validation:

Current module tests are lifecycle smoke tests, not the visibility/disposal contract described by the plan.

### P1 - Component tests mock away the production registry wiring failure

File/line:

- `plan.md:84`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:38`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:64`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:73`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:84`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:186`

Plan expectation:

`ThreeAnimationOverlay.test.tsx` should use a mocked renderer factory and real fixture modules to prove mounted canvas identity, lifecycle, active animation filtering, ownership callbacks, teardown, resize, and render calls.

Problem:

The test mocks `three-animation-registry` itself and returns only a hand-built healing-pulse module. It does not import the generated registry or real fixture modules.

Impact:

The tests pass even though production never initializes `initializeThreeAnimationModules()`. They cannot catch generated-registry drift, missing production registration, or non-healing category resolution failures.

Suggested fix:

Keep the renderer factory mocked, but use the real `three-animation-registry` plus generated modules or explicit fixture modules registered through the same initialization path production uses.

Missing validation:

No component test currently fails when generated registration is absent from production wiring.

### P2 - Documentation still teaches the old optional `ThreeEffectsOverlay` model

File/line:

- `plan.md:379`
- `plan.md:385`
- `docs/guides/adding-animation.md:53`
- `docs/guides/adding-animation.md:65`
- `docs/guides/adding-animation.md:73`
- `docs/guides/adding-animation.md:86`
- `docs/guides/adding-animation.md:118`
- `docs/guides/adding-animation.md:214`
- `docs/guides/adding-animation.md:280`
- `docs/guides/ui-design.md:133`
- `docs/guides/ui-design.md:137`
- `docs/guides/ui-design.md:138`
- `docs/guides/ui-design.md:191`

Plan expectation:

Docs must teach the generated registry workflow, typed `AnimationId` usage, ownership/fallback rules, module lifecycle contract, pixel-proof expectations, WebGL failure behavior, and no longer teach canvas as the primary animation implementation.

Problem:

The docs still describe Three as optional effects under `apps/web/src/rendering/three/effects/*`, still name `ThreeEffectsOverlay`, still document `VITE_THREE_EFFECTS`, and still state canvas is primary for animation. `adding-animation.md` also teaches module-side Y flipping, which contradicts the new overlay-owned y-axis flip.

Impact:

The docs will lead the next implementer back to the old MVP architecture instead of the planned generated backend. The branch has implementation/docs drift on the exact boundary this plan was supposed to stabilize.

Suggested fix:

Rewrite the Three docs around `ThreeAnimationOverlay`, `apps/web/src/rendering/three/modules/<category>/`, generated registration, `VITE_ANIMATION_RENDERER_MODE`, ownership reports, fallback suppression, and `three-animation-overlay` browser proof.

Missing validation:

The planned docs-copy guardrail/compile fixture is not present, so stale examples do not fail validation.

## Accepted Deviations

None. The deviations above are not documented as accepted implementation tradeoffs and directly contradict plan deliverables or exit criteria.

## Residual Risk

- I did not attempt to repair the branch; this is a review artifact only.
- The current production path can still look healthy in local component tests because those tests mock the registry and WebGL renderer.
- The missing browser category proof is a hard blocker. This plan explicitly exists because previous tests passed while observing the wrong renderer.

## Validation Evidence

Ran and stopped at first failure:

```bash
pnpm run check:fast
```

Result: failed.

Failure summary:

- `check:tracked-artifacts` passed.
- `check:audit-guardrails` passed.
- Workspace wiring passed.
- ESLint tiers completed before typecheck.
- `lint:types:all` failed in test typecheck for `apps/web`.
- Current diagnostic is in `.validate-logs/typecheck.log`: `apps/web/src/rendering/three/three-guardrails.test.ts(117,31): error TS2345`.

Per the mandatory workflow, I did not run `pnpm validate:quick` or `pnpm validate` after this failure.
