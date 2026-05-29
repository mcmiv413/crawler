# Three.js Overlay Post-Implementation Review - Round 7

Review basis:

- Plan: `.plan/threejs.md`
- Prior review: `docs/threejs-post-implementation-review-round-6.md`
- Implementer handoff note dated 2026-05-29

Review date: 2026-05-29

Branch/worktree: `threejs`

Bottom line: the round-6 implementation findings are resolved for the Three.js repair slice. I found no new blocking implementation issues in the repaired files. The broad branch scope remains outside the Three MVP, but it is now explicitly documented by the implementer as git-history cleanup left out of this repair slice; treat that as a PR hygiene follow-up if this branch is still intended to merge directly.

## Validation Evidence

- `pnpm vitest run apps/web/src/components/DungeonCanvas.test.tsx apps/web/src/rendering/three/ThreeEffectsOverlay.test.tsx apps/web/src/rendering/three/three-effects.contract.test.ts` - passed, 98 tests.
- `PLAYWRIGHT_HTML_OPEN=never E2E_API_BASE=http://127.0.0.1:3001/api E2E_APP_BASE=http://127.0.0.1:8081/ pnpm exec playwright test tests/e2e/three-effects-overlay.spec.ts --reporter=line` - passed, 1 browser test.
- `pnpm run check:fast` - passed with 7 warnings.
- `pnpm validate:quick` - passed; changed tests reported 202 passed.

## Findings

No unresolved code findings found in the round-6 repair slice.

## Round-6 Closure Notes

- `DungeonCanvas` now rejects missing, hidden, and non-walkable clicked tiles before pathing, preserving the pre-refactor click guard.
- `ThreeEffectsOverlay` no longer mutates the Three effect registry during render; built-ins are registered from the effects module initialization path.
- The renderer factory now uses `preserveDrawingBuffer: true`, enabling direct browser-side WebGL pixel sampling.
- The Playwright proof now targets the overlay WebGL canvas directly with `readPixels(...)`, so the test no longer passes merely because the 2D canvas fallback changed pixels.
- `docs/guides/adding-animation.md` now documents `setPosition(...)`, tile-relative scaling, and the overlay-to-Three Y-axis flip in line with the shipped effect contract.

## Accepted Deviation / Follow-Up

The branch still contains broader history than the locked Three MVP, and round 6 correctly flagged that as incompatible with reviewing the whole branch as a narrow implementation. The implementer explicitly left rebase/splitting out of this repair pass because it is branch hygiene rather than code behavior. If this work is headed to a PR as-is, the broad branch scope should still be addressed or clearly documented in the PR description.

## Residual Risk

The default `pnpm validate` gate does not run the Playwright Three overlay proof, so the explicit E2E command remains required evidence for this feature. Keep the isolated-port override path documented because reused local 3000/8080 servers can serve stale code in this environment.
