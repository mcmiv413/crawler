# Three.js Dungeon Animation Migration Review - Round 9

Review basis:

- Plan: `plan.md`
- Requested skill: `.claude/skills/post-implementation-review/SKILL.md`
- Prior review: `docs/threejs-post-implementation-review-round-8.md`
- Branch/worktree: `threejs-next`, including current uncommitted and untracked fixes
- Review date: 2026-05-29

Bottom line: still not acceptable. The round-8 typecheck blocker is fixed and the production path now renders `ThreeAnimationOverlay`, but the implementation still misses core plan outcomes: status animation ownership is partial, projectile visuals are degraded, the browser proof still only proves the old healing-pulse shape, and the fix branch is not yet represented by tracked Git state.

## Review Scope Notes

- `git diff --shortstat origin/main...HEAD`: `679 files changed, 43390 insertions(+), 17032 deletions(-)`.
- `git diff --name-only origin/main...HEAD | wc -l`: `679`.
- `git diff --name-only origin/main...HEAD | rg -c '^(apps/server|packages/game-core|packages/game-contracts|packages/content)'`: `308`.
- `git diff --shortstat` for the current working tree before this report: `19 files changed, 1152 insertions(+), 364 deletions(-)`.
- Current fixes include untracked files used by the modified code path.

## Findings

### P0 - The branch scope is still outside the locked Three migration plan

File/line:

- `plan.md:36`
- `plan.md:42`
- `plan.md:390`
- `plan.md:403`
- `apps/server/src/app.ts:1`
- `packages/game-core/src/engine/game-engine.ts:1`
- `packages/game-contracts/src/types/game-state.ts:1`
- `packages/content/src/balance/tables.ts:1`

Plan expectation:

The plan explicitly excludes game-core, server command handling, persistence, combat math, movement rules, AI, content tuning, unrelated UI layout, and branch hygiene changes.

Problem:

The branch still contains broad server/core/contracts/content/CI/docs changes unrelated to the Three animation migration. The remote-base diff is 679 files, with 308 under server/core/contracts/content. This is unchanged from the prior review's scope objection.

Impact:

The branch cannot be reviewed or merged as the approved Three migration. Any green validation signal is contaminated by unrelated runtime, persistence, content, and infrastructure changes.

Suggested fix:

Split or rebase the Three animation migration onto a branch containing only plan-owned files, or explicitly create and approve a larger plan that covers the server/core/content changes.

Missing validation:

No validation isolates the Three migration from the unrelated branch churn.

### P0 - The current fix state depends on untracked files

File/line:

- `package.json:18`
- `package.json:43`
- `apps/web/src/components/DungeonPhase.tsx:26`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:26`
- `scripts/guardrails/check-three-animation-coverage.ts:1`
- `apps/web/src/hooks/useCombatIndicatorState.ts:1`
- `apps/web/src/rendering/three/entities/three-defender-hit-flash.ts:1`

Plan expectation:

The branch must be reviewable as a coherent implementation artifact, and `check:fast` must include the Three guardrail.

Problem:

`package.json` now runs `scripts/guardrails/check-three-animation-coverage.ts`, `DungeonPhase` imports `useCombatIndicatorState`, and `ThreeAnimationOverlay` imports `three-defender-hit-flash`, but all three implementation files are currently untracked. `git ls-files` returns no entries for them.

Impact:

The working tree can validate locally while the actual branch commit cannot. A partial commit or push will either fail immediately or silently omit key Workstream 8/9 behavior.

Suggested fix:

Track all implementation files that are imported by tracked code before considering the branch ready for review or PR. Re-run validation from a clean index after staging the intended set.

Missing validation:

No clean-tree validation was provided. Current validation is against the dirty working tree, not the branch tip.

### P0 - Status presentation ownership is partial and explicitly keeps runtime status motion on canvas

File/line:

- `plan.md:66`
- `plan.md:92`
- `plan.md:93`
- `plan.md:324`
- `plan.md:327`
- `plan.md:328`
- `plan.md:332`
- `packages/presenter/src/animation-metadata.ts:86`
- `packages/presenter/src/animation-metadata.ts:99`
- `packages/presenter/src/animation-metadata.ts:110`
- `apps/web/src/components/DungeonPhase.tsx:208`
- `apps/web/src/components/DungeonPhase.tsx:216`
- `apps/web/src/components/DungeonPhase.test.tsx:986`
- `apps/web/src/components/DungeonPhase.test.tsx:1018`
- `packages/content/src/animation-refs/index.test.ts:1`

Plan expectation:

Every status presentation with a ring must have a Three status module ID, and Three must render persistent ring pulses plus entity presentation scale. Canvas status scale/ring drawing remains fallback-only after successful WebGL ownership.

Problem:

Only `strength` gets `animationRefs.status.goldRingPulse.id`. `heat_surge` and `arcane_charge` still have rings and entity scale but no `animationId`, so they can never be Three-owned. For `strength`, `DungeonPhase` strips only the ring and intentionally keeps `entityScale` in the canvas fallback path; the test at `DungeonPhase.test.tsx:986` encodes that as expected behavior. There is also no contract in `packages/content/src/animation-refs/index.test.ts` proving every ring presentation has a Three status module ID.

Impact:

Status pulses and entity scale pulses are not fully migrated. In Three mode, some statuses remain canvas-owned, and even the handled status still leaves entity scale on canvas, violating the one-owner model.

Suggested fix:

Add animation IDs for every ring status presentation, or remove/document those rings as canvas-only follow-up scope. Move entity scale presentation into the Three status/entity layer when status ownership is active, and suppress both ring and scale on canvas only after WebGL reports ownership. Add the planned contract for ring presentations.

Missing validation:

No contract catches ring presentations without animation IDs. No browser proof samples status pulse pixels for `strength`, `heat_surge`, or `arcane_charge`.

### P0 - Browser proof still does not prove the required animation categories

File/line:

- `plan.md:95`
- `plan.md:96`
- `plan.md:97`
- `plan.md:98`
- `plan.md:120`
- `plan.md:124`
- `plan.md:278`
- `plan.md:309`
- `plan.md:333`
- `plan.md:360`
- `plan.md:440`
- `tests/e2e/three-animation-backend.spec.ts:250`
- `tests/e2e/three-animation-backend.spec.ts:270`
- `tests/e2e/three-animation-backend.spec.ts:302`

Plan expectation:

Browser tests must sample `data-testid="three-animation-overlay"` with `gl.readPixels()` for movement, bump/attack, projectile, impact, aoe, self/consumable, status pulse, combat label, defender-hit flash, WebGL failure fallback, pointer safety, and a negative proof that canvas fallback cannot satisfy the Three assertion.

Problem:

The new e2e file still drives a single health-potion scenario and counts green pixels. It does not trigger or prove movement WebGL pixels, bump/lunge, projectile, impact, aoe, utility, status, combat labels, defender-hit flash, WebGL failure fallback, or the negative canvas-only assertion.

Impact:

The central failure mode from the previous review loop remains: a browser test can pass while most claimed Three-owned categories are unproven or broken.

Suggested fix:

Split `tests/e2e/three-animation-backend.spec.ts` into deterministic category scenarios. Sample the overlay canvas by `data-testid="three-animation-overlay"` for each category, include a forced WebGL failure case that proves DOM/canvas fallback, and include a negative proof that the 2D dungeon canvas cannot satisfy the WebGL pixel assertion.

Missing validation:

The planned category browser proof has not been implemented or run.

### P1 - Projectile modules do not travel from actor to target

File/line:

- `plan.md:249`
- `plan.md:273`
- `plan.md:275`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:120`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:127`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:529`
- `apps/web/src/rendering/three/modules/projectile/single-arrow.ts:35`
- `apps/web/src/rendering/three/modules/projectile/single-arrow.ts:39`
- `apps/web/src/rendering/three/modules/projectile/ember-bolt.ts:35`
- `apps/web/src/animations/modules/ranged-pin.ts:15`
- `apps/web/src/animations/modules/ember-bolt.ts:10`

Plan expectation:

Port existing canvas visuals and recompute transient positions every frame from `playerPos`, `targetPos`, `blastPositions`, viewport, and camera offset.

Problem:

`getOverlayPositions()` collapses an animation to blast positions, else target position, else player position. The module contract then receives only one `setPosition()` coordinate. Projectile modules such as `singleArrow` and `emberBolt` only set a mesh at that coordinate and fade/scale it; they never receive source and target coordinates, so they cannot draw the projectile path that the canvas modules draw from actor to target.

Impact:

Projectile abilities regress from "travels from source to target" to "appears at target and fades." This is not a port of the existing player-visible animation.

Suggested fix:

Extend the Three module input or overlay bridge so projectile modules receive both source and target screen positions plus progress. Keep impact/aoe anchoring separate from projectile interpolation. Add tests asserting `singleArrow`/`emberBolt` are positioned along the actor-to-target path over progress.

Missing validation:

No component or browser test proves projectile travel or orientation through WebGL.

### P1 - Three entity sprites drop instance-color markers during motion ownership

File/line:

- `plan.md:81`
- `plan.md:204`
- `apps/web/src/rendering/three/entities/three-entity-sprite.ts:27`
- `apps/web/src/rendering/three/entities/three-entity-sprite.ts:90`
- `apps/web/src/rendering/three/entities/three-entity-sprite.test.ts:1`
- `apps/web/src/sprites/canvas-renderer.ts:631`

Plan expectation:

The entity sprite helper must preserve existing sprite metadata and instance-color markers.

Problem:

`createEntityTexture()` and `applyEntitySpriteAppearance()` accept only `ascii`, `color`, `spriteName`, and `type`; `instanceColor` is not passed or drawn. The tests cover tile-sized geometry and disposal but do not assert marker rendering. Canvas still draws the marker at `canvas-renderer.ts:631`, but moving/bumping entities are filtered out of the canvas when Three owns them.

Impact:

Duplicate enemies lose their disambiguating color marker during movement/bump animations in Three mode.

Suggested fix:

Pass `instanceColor` into the Three entity texture builder and draw the same marker overlay used by canvas. Add a unit test that fails when an entity with `instanceColor` produces a texture without the marker.

Missing validation:

No Three entity-sprite test covers instance-color marker preservation.

### P1 - Shared Three module contract is still a smoke test, not the promised visibility/disposal guardrail

File/line:

- `plan.md:80`
- `plan.md:206`
- `plan.md:208`
- `plan.md:209`
- `plan.md:210`
- `plan.md:251`
- `plan.md:256`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:4`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:56`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:99`
- `apps/web/src/rendering/three/testing/run-three-animation-contract.ts:105`

Plan expectation:

The shared contract must prove render-relevant state, minimum visible size, progress behavior, and GPU resource disposal. A raw `0.4`-sized module and a non-disposing module must fail.

Problem:

The helper still mostly asserts "does not throw" plus `scene.add`/`scene.remove`. It does not inspect geometry dimensions, material visibility, opacity changes, textures, or disposal calls. The comments claim geometry/disposal guarantees that the assertions do not enforce.

Impact:

Invisible or leaking modules can pass the category suites. This weakens the guardrail that was supposed to prevent the earlier sub-pixel and resource-leak failures.

Suggested fix:

Make the contract inspect standard instance shapes or require test metadata. Assert geometry/material/texture disposal with spies and add negative fixtures proving a tiny module and a non-disposing module fail.

Missing validation:

No negative visibility or disposal tests exist for the shared contract.

### P1 - `ThreeEffectsOverlay` compatibility was not converted and legacy metadata still drifts

File/line:

- `plan.md:180`
- `plan.md:181`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:7`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:9`
- `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx:11`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:2`
- `apps/web/src/components/ThreeEffectsOverlay.tsx:3`
- `apps/web/src/rendering/three-effect-metadata.ts:9`

Plan expectation:

`apps/web/src/rendering/three/ThreeEffectsOverlay.tsx` should be a compatibility re-export from `ThreeAnimationOverlay`, and handled IDs should derive from the generated Three registry instead of manual metadata.

Problem:

The old `ThreeEffectsOverlay` implementation still exists, imports the legacy `three-effect-registry`, imports `three-effect-metadata`, and loads `./effects/index.js`. `BUILT_IN_THREE_EFFECT_IDS` still manually lists only `fx.self.healing-pulse`.

Impact:

Any legacy import path still gets the old one-effect architecture. Tests and docs can continue to exercise the wrong backend even though production now uses `ThreeAnimationOverlay`.

Suggested fix:

Replace the legacy implementation with a compatibility export/wrapper around `ThreeAnimationOverlay`, or delete the legacy path once callers are migrated. Remove manual metadata or generate it from the registry.

Missing validation:

No test fails if `ThreeEffectsOverlay` keeps resolving through `three-effect-registry`.

### P1 - Component tests still mock away generated registry initialization

File/line:

- `plan.md:84`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:39`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:65`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:85`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx:572`

Plan expectation:

Component tests should mock the renderer factory but use real fixture modules to prove production registry/overlay behavior.

Problem:

`ThreeAnimationOverlay.test.tsx` mocks `three-animation-registry` itself and only returns a hand-built healing-pulse module. It does not exercise the lazy wrapper path that imports `generated/index.ts` and calls `initializeThreeAnimationModules()`.

Impact:

The tests can pass if production generated-registry initialization breaks again. This was a previous round-8 failure mode and remains under-tested.

Suggested fix:

Keep WebGL mocked, but use the real registry with either generated modules or test fixture modules registered through the same initialization path the lazy wrapper uses. Add a wrapper-level test for `apps/web/src/components/ThreeAnimationOverlay.tsx`.

Missing validation:

No component test proves the generated registry initializes through the production lazy wrapper.

### P2 - Renderer-mode compatibility alias still reads the old flag

File/line:

- `plan.md:149`
- `plan.md:150`
- `apps/web/src/config/feature-flags.ts:42`
- `apps/web/src/config/feature-flags.ts:47`
- `apps/web/src/config/feature-flags.ts:48`

Plan expectation:

`isThreeEffectsEnabledFlag()` remains only as a compatibility alias that delegates to `getAnimationRendererMode() === 'three'` until callers are migrated.

Problem:

`isThreeEffectsEnabledFlag()` still reads `VITE_THREE_EFFECTS` directly. Production `DungeonPhase` now uses `getAnimationRendererMode()`, but the compatibility API still exposes divergent behavior.

Impact:

Any remaining or future compatibility caller can disagree with the renderer-mode source of truth.

Suggested fix:

Make `isThreeEffectsEnabledFlag()` return `getAnimationRendererMode() === 'three'`, or delete it with all legacy callers/tests.

Missing validation:

No test asserts that the legacy alias and renderer-mode API agree.

### P2 - Docs and docs guardrail still teach the old optional-effects model

File/line:

- `plan.md:62`
- `plan.md:125`
- `plan.md:127`
- `plan.md:379`
- `plan.md:385`
- `docs/guides/adding-animation.md:53`
- `docs/guides/adding-animation.md:65`
- `docs/guides/adding-animation.md:88`
- `docs/guides/adding-animation.md:118`
- `docs/guides/adding-animation.md:180`
- `docs/guides/adding-animation.md:192`
- `docs/guides/adding-animation.md:280`
- `docs/guides/ui-design.md:189`
- `docs/guides/ui-design.md:191`
- `docs/guides/testing.md:1`

Plan expectation:

Docs must teach generated registry workflow, typed `AnimationId`, ownership/fallback rules, module lifecycle contract, pixel proof, WebGL failure behavior, and stop teaching canvas as the primary animation implementation. Docs examples should be checked by lint/typecheck or a compile fixture.

Problem:

`adding-animation.md` still describes Three as optional effects under `apps/web/src/rendering/three/effects/*`, still instructs manual registration in `three-effect-registry`, still updates `three-effect-metadata`, and still documents `VITE_THREE_EFFECTS`. `ui-design.md` was partially renamed to `ThreeAnimationOverlay` but still documents `VITE_THREE_EFFECTS`. `docs/guides/testing.md` has no Three/WebGL/pixel-proof guidance. There is no `docs-example.test.ts` or equivalent compile fixture.

Impact:

The next implementer will follow stale MVP instructions and reintroduce manual metadata drift or module-side y-flip mistakes.

Suggested fix:

Rewrite the docs around `apps/web/src/rendering/three/modules/<category>/`, `scripts/generators/three-animation-modules.ts`, `VITE_ANIMATION_RENDERER_MODE`, generated registration, overlay-owned y-flip, ownership reports, fallback suppression, and `three-animation-overlay` browser proof. Add the planned docs-copy guardrail.

Missing validation:

The planned docs compile fixture does not exist.

## Accepted Deviations

None. Several deviations may be reasonable as follow-up scope, but they are not documented as accepted deviations and they contradict explicit deliverables.

## Residual Risk

- The branch can validate while still not proving the player-visible Three migration because the browser category proof is too narrow.
- The current working tree is not clean; required implementation files are untracked.
- I did not attempt to repair any findings in this review.

## Validation Evidence

Ran:

```bash
pnpm run check:fast
pnpm validate:quick
pnpm validate
```

Results:

- `pnpm run check:fast` passed.
- `pnpm validate:quick` passed, including `2514` changed tests and production build.
- `pnpm validate` passed, including generation, tracked artifacts, audit guardrails, Three animation coverage, workspace wiring, ability contracts, lint/typecheck, `2514` tests, production build, and package export checks.

Not run:

- `pnpm exec playwright test tests/e2e/three-animation-backend.spec.ts --reporter=line`. Static review found the file does not contain the required category scenarios, so a pass would not satisfy the plan's browser proof.
