# Three.js Dungeon Animation Migration Review - Round 10

Review basis:

- Plan: `plan.md`
- Requested skill: `.claude/skills/post-implementation-review/SKILL.md`
- Prior reviews: `docs/threejs-post-implementation-review-round-8.md`, `docs/threejs-post-implementation-review-round-9.md`
- Branch/worktree: `threejs-next`, including current staged and unstaged fixes
- Review date: 2026-05-29

Scope note: per request, this review does not raise the mixed-branch / broad branch-scope issue again.

Bottom line: still not acceptable. The production path is materially closer than round 9: `DungeonPhase` now renders the lazy `ThreeAnimationOverlay`, the generated registry is initialized from the lazy wrapper, renderer mode defaults back to canvas, status overlays exist for the ring statuses, and mandatory repo validation is green. The blocking problem is now proof and remaining visual fidelity. The plan requires browser-pixel proof for every category, and the new Playwright proof is currently red across the board.

## Findings

### P0 - The required browser-pixel proof suite fails before proving any WebGL pixels

File/line:

- `plan.md:95`
- `plan.md:96`
- `plan.md:97`
- `plan.md:98`
- `plan.md:120`
- `plan.md:121`
- `plan.md:122`
- `plan.md:123`
- `plan.md:124`
- `plan.md:440`
- `tests/e2e/three-animation-backend.spec.ts:81`
- `tests/e2e/three-animation-backend.spec.ts:82`
- `tests/e2e/three-animation-backend.spec.ts:91`
- `tests/e2e/three-animation-backend.spec.ts:246`
- `tests/e2e/three-animation-backend.spec.ts:258`
- `apps/web/src/main.tsx:4`
- `apps/web/src/main.tsx:6`
- `apps/web/src/testing/e2e-bridge.ts:40`
- `apps/web/src/testing/e2e-bridge.ts:46`
- `apps/web/src/testing/e2e-bridge.ts:50`
- `apps/web/src/components/DungeonPhase.tsx:189`
- `apps/web/src/components/DungeonPhase.tsx:192`

Plan expectation:

Browser tests must use `gl.readPixels()` against `data-testid="three-animation-overlay"` and prove movement, bump/attack, projectile, impact, aoe, self/consumable, status pulse, combat label, WebGL failure fallback, and pointer safety.

Problem:

`pnpm exec playwright test tests/e2e/three-animation-backend.spec.ts --reporter=line` failed all 11 tests. Every failure timed out in `waitForDungeonE2EReady()` before any scenario could emit animations or sample WebGL pixels:

```text
Expected: true
Received: false
Timeout 5000ms exceeded while waiting on the predicate
```

The page reached the dungeon screen, but the E2E readiness predicate never observed `window.__DUNGEON_E2E__.ready === true && api !== undefined`. That means the browser-proof harness is not currently usable.

Impact:

The implementation has no passing browser evidence for the plan's central acceptance condition. Unit, contract, and build gates can pass while the browser proof for the actual mounted WebGL path is completely red.

Suggested fix:

Make the bridge installation deterministic before relying on it for proof. Either gate and dynamically install it from the app entry only when the Playwright harness explicitly enables it, or make the test wait on a real app signal that is guaranteed to be published after the bridge API is installed. Then rerun the full targeted Playwright command and include the output as required proof.

Missing validation:

The mandatory repo gates passed, but the plan-specific browser command failed 11/11.

### P1 - The WebGL pixel assertions are too weak even if the readiness bug is fixed

File/line:

- `plan.md:96`
- `plan.md:97`
- `plan.md:120`
- `plan.md:121`
- `tests/e2e/three-animation-backend.spec.ts:546`
- `tests/e2e/three-animation-backend.spec.ts:553`
- `tests/e2e/three-animation-backend.spec.ts:561`
- `tests/e2e/three-animation-backend.spec.ts:635`
- `tests/e2e/three-animation-backend.spec.ts:637`
- `tests/e2e/three-animation-backend.spec.ts:642`
- `tests/e2e/three-animation-backend.spec.ts:698`
- `tests/e2e/three-animation-backend.spec.ts:702`

Plan expectation:

Browser proof must verify visible pixels near expected tile positions, and fallback canvas pixels must not be able to satisfy the Three assertion.

Problem:

`countVisibleWebGlPixels()` reads the entire WebGL drawing buffer and `waitForOverlayPixels()` only asserts that the whole overlay has more than a threshold number of visible pixels. The scenario table names categories, but the assertion does not sample the expected movement path, attacker/defender tile, projectile path, impact target, status/player tile, label tile, or defender-hit tile.

Impact:

Once the readiness bug is fixed, these tests can still pass for the wrong reason: any unrelated visible WebGL artifact anywhere on the overlay can satisfy a category proof. This repeats the earlier review-loop failure mode where tests observe the wrong surface or the wrong visual.

Suggested fix:

For each scenario, compute the expected CSS/WebGL tile region and read a bounded region around that coordinate. Use before/after or positive/negative region checks so the movement test proves a moving entity, projectile proves travel along the actor-to-target path, status proves the player tile ring/scale, and combat label proves label pixels at the label tile. Keep the global canvas-fallback negative, but do not treat it as a substitute for per-category location proof.

Missing validation:

No current browser assertion proves category-specific pixels near expected tile positions.

### P1 - `arrowVolley` is still not a port of the canvas projectile animation

File/line:

- `plan.md:248`
- `plan.md:249`
- `plan.md:273`
- `plan.md:275`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:140`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:156`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:218`
- `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx:239`
- `apps/web/src/rendering/three/modules/projectile/arrow-volley.ts:17`
- `apps/web/src/rendering/three/modules/projectile/arrow-volley.ts:47`
- `apps/web/src/rendering/three/modules/projectile/arrow-volley.ts:51`
- `apps/web/src/animations/modules/ranged-volley.ts:26`
- `apps/web/src/animations/modules/ranged-volley.ts:35`
- `apps/web/src/animations/modules/ranged-volley.ts:40`

Plan expectation:

Existing canvas visuals are ported, and transient positions are recomputed from `playerPos`, `targetPos`, `blastPositions`, viewport, and camera offset.

Problem:

`singleArrow` and `emberBolt` now accept source/target endpoints, but `arrowVolley` still ignores `source`, `target`, and travel progress. Its `setPosition()` pins the whole group at `pos.x/pos.y`, and `update()` only fades opacity. The canvas `ranged-volley` implementation moves each arrow from the player position toward each blast target over progress.

Impact:

The ranged volley projectile regresses from visible outbound arrows to a static group that fades at the target anchor. The category-level e2e only uses `fx.projectile.ember-bolt`, so this regression is not browser-proven.

Suggested fix:

Give `arrowVolley` the same endpoint-aware contract used by `singleArrow` and `emberBolt`. For blast-position animations, treat each resolved blast position as that instance's target and interpolate from `playerPos` to that target. Add a module test that asserts mid-progress positions move along the source-to-target path, and add a browser proof for `fx.projectile.arrow-volley` or a deterministic projectile matrix.

Missing validation:

Current projectile module tests cover source/target travel for `singleArrow` and `emberBolt`, but not `arrowVolley`; the browser projectile scenario only covers `ember-bolt`.

### P1 - The Playwright-only bridge is statically imported by the production app entry

File/line:

- `plan.md:42`
- `plan.md:120`
- `apps/web/src/main.tsx:4`
- `apps/web/src/main.tsx:6`
- `apps/web/src/testing/e2e-bridge.ts:40`
- `apps/web/src/testing/e2e-bridge.ts:50`
- `apps/web/src/testing/e2e-bridge.ts:57`
- `apps/web/src/testing/e2e-bridge.ts:70`
- `apps/web/src/testing/e2e-bridge.ts:86`
- `apps/web/src/testing/e2e-bridge.ts:90`

Plan expectation:

Browser proof should verify the implementation without mixing test-only control surfaces into the shipped runtime path.

Problem:

`main.tsx` statically imports `installDungeonE2EBridge()` and calls it for every app load. The bridge is inert unless `window.__DUNGEON_E2E__.enabled === true`, but the production bundle still includes a test API that can mutate the Zustand game view, inject map entities/statuses, emit animation events, emit combat labels, and trigger defender-hit flashes.

Impact:

This creates a production-loaded test backdoor and couples browser proof infrastructure to the app entry. It also makes the readiness failure harder to reason about because the test bridge is neither explicitly e2e-mode-only nor dynamically installed from the test harness.

Suggested fix:

Keep the bridge out of the normal entry chunk. Use an explicit e2e/dev gate plus a dynamic import, for example checking a dedicated Vite env or a Playwright init-script marker before importing `./testing/e2e-bridge.js`. Add a guardrail or build test that fails if `apps/web/src/main.tsx` statically imports `apps/web/src/testing/e2e-bridge.ts`.

Missing validation:

No guardrail currently prevents test bridge code from entering the production entry path.

### P2 - `PLAYER_STATUS_PRESENTATION` is still not display-ready for `strength`

File/line:

- `plan.md:324`
- `plan.md:325`
- `plan.md:326`
- `plan.md:331`
- `packages/presenter/src/animation-metadata.ts:86`
- `packages/presenter/src/animation-metadata.ts:87`
- `packages/presenter/src/animation-metadata.ts:97`
- `packages/presenter/src/animation-metadata.ts:186`
- `packages/presenter/src/animation-metadata.ts:192`
- `packages/presenter/src/animation-metadata.ts:201`
- `packages/content/src/statuses/strength.ts:14`

Plan expectation:

Presenter status presentation metadata should be display-ready and renderer-neutral, including `animationId?: AnimationId`.

Problem:

`strength` has `overlay: { id: animationRefs.status.goldRingPulse.id }`, and `getStatusPresentation('strength')` backfills the animation ID. But the exported `PLAYER_STATUS_PRESENTATION.strength` object itself still has no `animationId`. The new contract covers `getStatusPresentation()`, not direct consumers of the exported metadata constant.

Impact:

The public presenter export can still be consumed in a non-display-ready form. A future caller can bypass the accessor and silently lose Three status ownership for strength, while the current tests remain green.

Suggested fix:

Either put `animationId: animationRefs.status.goldRingPulse.id` directly on `PLAYER_STATUS_PRESENTATION.strength`, or stop exporting the raw map and make `getStatusPresentation()` the only supported presenter API.

Missing validation:

No test asserts that every exported `PLAYER_STATUS_PRESENTATION` entry with a ring directly carries an `animationId`.

## Validation Evidence

Mandatory gates:

- `pnpm run check:fast` - passed.
- `pnpm validate:quick` - passed.
- `pnpm validate` - passed.

Plan-specific browser proof:

- `pnpm exec playwright test tests/e2e/three-animation-backend.spec.ts --reporter=line` - failed 11/11. Every failure timed out in `waitForDungeonE2EReady()` before pixel assertions ran.

## Residual Risk

The implementation is now structurally close enough that the remaining defects are easy to mask with unit tests. Treat the Playwright failure as blocking: until the browser proof is both green and region-specific, the branch still has no reliable evidence that the actual mounted WebGL overlay owns all animation categories in the player-visible dungeon.
