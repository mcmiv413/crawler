# Six-Hop Mechanic Checklist

Use this reference when the request needs exact layer ownership, file targets, or proof-home selection.

Before selecting proof homes, check `docs/feature-proofs.yml` for the closest existing feature owner. The diff-aware guardrail requires matching proof files for every changed production surface.

## The 6 hops

| Hop | Question | Typical files |
| --- | --- | --- |
| Entry | How is the feature triggered? | `packages/game-contracts/src/commands/index.ts`, `packages/game-contracts/src/schemas/index.ts`, `packages/game-core/src/engine/command-handler.ts`, `packages/game-core/src/systems/town.ts`, or another explicit trigger surface |
| State | What changes in `GameState`? | `packages/game-core/src/systems/*.ts` |
| Event | What tells the player it happened? | `packages/game-contracts/src/events/index.ts`, `packages/presenter/src/event-formatter.ts` |
| Presenter | What view data exposes it? | `packages/presenter/src/game-view.ts`, `packages/presenter/src/builders/*.ts`, `packages/presenter/src/game-view-builder.ts` |
| UI | Where is it rendered? | `apps/web/src/components/*.tsx` |
| Test | What proves the chain? | runtime tests, presenter tests, component tests, contract tests, and `assertFeatureChain()` helpers |

## Extra surfaces when the ask expands

| Expansion | Surfaces |
| --- | --- |
| New content IDs | `packages/content/src/**`, generated indexes, `tests/contracts/**` |
| Persisted state shape change | schemas, validators, defaults, restore compatibility, presenter builders |
| Town-only feature | `packages/game-core/src/systems/town.ts`, `packages/presenter/src/builders/town-view-builder.ts`, `apps/web/src/components/TownPhase.tsx` |
| Combat-facing feature | combat handlers/systems, presenter HUD builders, combat-oriented web components |
| New animation support | animation refs, canvas modules, Three modules, renderer ownership proofs |

## Non-obvious repo rules

- `assertFeatureChain()` is the preferred end-to-end proof helper for new mechanics.
- `pnpm run check:feature-proofs` must pass before `pnpm run check:fast`.
- Browser-facing changes need component proof or `pnpm test:e2e:scenario`.
- Persisted state shape changes need save compatibility proof and historical fixture coverage when older saves must keep loading.
- Player-visible behavior should prove `state -> event -> presenter -> UI`, not just internal state changes.
- Unit/property tests should use builders or local fixtures rather than live content imports when possible.
- Contract tests belong in `tests/contracts/` when live IDs or cross-references are involved.
- Generated indexes are source-derived; run `pnpm generate:indexes` instead of hand-editing generated files.
- Finish on `pnpm validate`, even if the iteration loop used narrower proofs first.

## Known-bad cases

- A system change with no command or trigger path
- An emitted event with no formatter or no UI-facing presenter data
- A component path with duplicated presenter formatting logic
- A mechanic that references content IDs but never validates them against live registries
- A test that only checks state and never proves the feature is visible or triggerable
