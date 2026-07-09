# Spell Authoring Checklist

Use this reference when the prompt needs exact ring-spell surfaces, tuning fields, or escalation rules.

Use `docs/feature-proofs.yml` to find ring ability proof homes before editing. Run `pnpm run check:feature-proofs` before `pnpm run check:fast`.

## Base spell surfaces

| Surface | Files |
| --- | --- |
| Spell content | `packages/content/src/ring-spells/<spell>.ts` |
| Runtime definition | `packages/game-core/src/abilities/definitions/<spell>.ts` |
| Shared runtime helpers | `packages/game-core/src/abilities/definitions/ring-spell-utils.ts` |
| Study/mastery runtime | `packages/game-core/src/systems/ring-spell-availability.ts`, `packages/game-core/src/systems/magic-xp.ts` |
| Town study flow | `packages/game-core/src/systems/town.ts`, `packages/presenter/src/builders/town-view-builder.ts`, `apps/web/src/components/TownPhase.tsx` |
| Magic HUD/view | `packages/presenter/src/builders/player-hud-builder.ts`, `packages/presenter/src/game-view.ts`, `apps/web/src/components/PlayerHud.tsx`, `apps/web/src/components/CharacterScreen.tsx` |
| New status definitions | `packages/content/src/statuses/<status>.ts` |
| Animation surfaces | `packages/content/src/animation-refs/**`, `apps/web/src/animations/modules/**`, `apps/web/src/rendering/three/modules/**` |

## Authored fields to lock

- `schools`
- `studyRequirements`
- `manaCost`
- `xpGainOnCast`
- `range`
- `baseDamage`
- `statusEffects`
- animation refs
- reuse-vs-custom runtime choice

## Non-obvious repo rules

- Ring spells are generated into ability exports by `pnpm generate:indexes`.
- Learned spells live in `player.learnedRingSpellIds`.
- School mastery lives in `player.ringMastery`.
- Study unlocks the spell but does not grant XP.
- Some runtime and progression logic is still fire-oriented, so new-school work can spill beyond content.
- Presenter study and HUD views currently handle one school XP gate most naturally, which matters for combo-school asks.

## Escalation rules

| If the spell ask also needs... | Route |
| --- | --- |
| New projectile, impact, pulse, aoe, or other visual ownership | `adding-animation` |
| New runtime behavior, events, presenter data, or UI state | `adding-game-mechanic` |
| New ring item or new package-level school wiring | `adding-ring` |
| New school or combo-school progression behavior | `adding-game-mechanic` plus ring-school/platform surfaces |

## Proof homes

| Ask shape | Proofs to name |
| --- | --- |
| Pattern reuse | `tests/contracts/ring-magic.contract.test.ts` plus targeted runtime/presenter tests |
| New visuals | spell proofs plus animation-ref, generator, and Three ownership proofs |
| Custom mechanic | feature-chain proofs plus ring-magic contracts |
| New school or combo-school work | content cross-reference contracts, presenter/game-view proofs, and mechanic-chain coverage |

Browser-facing spell changes need component or `pnpm test:e2e:scenario` proof. Persisted state shape changes need save compatibility coverage.

## Known-bad cases

- Creating a duplicate ability content file for the spell
- Forgetting `xpGainOnCast`, `studyRequirements`, or school-model implications
- Forgetting presenter/game-view limitations for combo-school study surfaces
- Treating non-fire school work as cheap data-only authoring
- Forgetting `pnpm generate:indexes`
