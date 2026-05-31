# Ring-Magic Triage Matrix

Use this reference when the prompt needs a hard classification and an exact next route.

## Bucket matrix

| Bucket | What it looks like | Hidden surfaces | Next route |
| --- | --- | --- | --- |
| Pattern reuse | Existing school, existing spell pattern, tuned numbers, no new platform behavior | spell content, runtime definition, contracts, targeted runtime/presenter proofs | `adding-spell` or `adding-ring` |
| New status or animation work | New persistent effect, new pulse, projectile, impact, aoe, or self visual | status definitions, presenter surfaces for active effects, animation refs, canvas modules, Three ownership proofs | `adding-spell` or `adding-ring` plus `adding-animation` |
| Custom mechanic/runtime work | New behavior that existing ring-spell helpers do not already model cleanly | runtime helpers, events, presenter data, UI wiring, full feature-chain proofs | `adding-spell` or `adding-ring` plus `adding-game-mechanic` |
| New-school or combo-school expansion | New ring school, new damage/progression assumptions, multi-school gating, combo-school study logic | ring-school source files, helper assumptions, presenter/game-view study surfaces, contract allowlists | `adding-ring` or `adding-spell` plus `adding-game-mechanic` |

## Non-obvious repo rules

- Ring spells live in `packages/content/src/ring-spells/`, not `packages/content/src/abilities/`.
- `pnpm generate:indexes` wires ring-spell exports into generated ability surfaces.
- Learned spells live in `player.learnedRingSpellIds`.
- School mastery lives in `player.ringMastery`.
- Study unlocks the spell but does not grant XP.
- `tests/contracts/content-cross-references.contract.test.ts` has hardcoded accepted ring-school strings.
- `packages/game-core/src/abilities/definitions/ring-spell-utils.ts` still contains school-specific assumptions.
- `packages/presenter/src/game-view.ts`, `packages/presenter/src/builders/town-view-builder.ts`, and `packages/presenter/src/builders/player-hud-builder.ts` currently surface one school XP gate most naturally.

## Proof-home hints

| Ask shape | Proofs to name |
| --- | --- |
| Pure reuse | ring-magic contracts plus targeted runtime/presenter tests |
| New animation or status visuals | animation-ref tests, generator tests, Three coverage checks, plus spell proofs |
| New runtime/player-visible behavior | runtime tests, presenter tests, component tests, and any needed contract coverage |
| New school or combo-school work | contract allowlist updates, ring-magic contracts, presenter/game-view tests, and mechanic-chain proofs |

## Known-bad cases

- Treating a new school as only a new file in `packages/content/src/ring-schools/`
- Forgetting presenter/game-view limits for combo-school study surfaces
- Forgetting to route animation-heavy spell asks through animation ownership proofs
- Forgetting that fire-oriented helpers can make non-fire school expansion more expensive than it first appears
