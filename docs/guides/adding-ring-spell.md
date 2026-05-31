# How to Add a Ring Spell

Use this guide when the task is **adding or changing a ring spell**. If the work also introduces a new ring item, new enchantment grant, or new school package, start with [adding-ring.md](adding-ring.md) and use this guide for the spell-specific branch.

Ring spells are not just content rows. A complete spell can touch content, core runtime, presenter/UI, animation refs, Three modules, contract tests, and sometimes ring-school platform code.

## Quick Start

1. Classify the ask: pattern reuse, new status/animation work, custom mechanic/runtime work, or new-school/combo expansion.
2. Add spell metadata in `packages/content/src/ring-spells/<spell>.ts`.
3. Add or update runtime logic in `packages/game-core/src/abilities/definitions/<spell>.ts`.
4. Add new statuses in `packages/content/src/statuses/` when the spell applies new ongoing effects.
5. Add or reuse animation refs in `packages/content/src/animation-refs/`, and add a web/Three module when the spell needs new visuals.
6. Run `pnpm generate:indexes`.
7. Prove the right surfaces, then finish on `pnpm validate`.

## Complexity Triage

| Spell shape | Typical scope | Also read |
| --- | --- | --- |
| Reuse an existing ring-spell pattern | Content spell file, runtime definition, contracts, targeted runtime/presenter tests | This guide |
| New status or new animation | Spell file plus status definitions and/or animation refs/modules | [adding-animation.md](adding-animation.md) |
| Custom mechanic or new player-visible behavior | Runtime, events, presenter, UI, and end-to-end proofs | [adding-mechanic.md](adding-mechanic.md) |
| New school, combo-school gating, or platform expansion | Ring-school files, runtime helpers, presenter study/magic views, contract allowlists | [adding-ring.md](adding-ring.md) and [adding-mechanic.md](adding-mechanic.md) |

Do **not** pretend a new-school or combo-school spell is a one-file content change. Those asks often require platform work.

## Required Surfaces

| Surface | Files |
| --- | --- |
| Spell content | `packages/content/src/ring-spells/<spell>.ts` |
| Core runtime | `packages/game-core/src/abilities/definitions/<spell>.ts` |
| Runtime helpers reused by many spells | `packages/game-core/src/abilities/definitions/ring-spell-utils.ts` |
| Status definitions | `packages/content/src/statuses/<status>.ts` |
| Animation refs | `packages/content/src/animation-refs/{impact,projectile,self,aoe,status,utility}.ts` |
| Canvas animation modules | `apps/web/src/animations/modules/<module>.ts` |
| Three animation modules | `apps/web/src/rendering/three/modules/<category>/<module>.ts` |
| Study + mastery runtime | `packages/game-core/src/systems/ring-spell-availability.ts`, `packages/game-core/src/systems/magic-xp.ts` |
| Equipment grant flow | `packages/game-core/src/systems/equipment.ts` |
| Town study surfaces | `packages/game-core/src/systems/town.ts`, `packages/presenter/src/builders/town-view-builder.ts`, `apps/web/src/components/TownPhase.tsx` |
| Player magic HUD/view | `packages/presenter/src/builders/player-hud-builder.ts`, `packages/presenter/src/game-view.ts`, `apps/web/src/components/PlayerHud.tsx`, `apps/web/src/components/CharacterScreen.tsx` |
| New ring-school platform work | `packages/content/src/ring-schools/<school>.ts`, `packages/content/src/ring-schools/types.ts`, `tests/contracts/content-cross-references.contract.test.ts` |

## Spell Decisions to Lock Before Coding

1. **Reuse vs custom runtime**  
   Reuse an existing ring-spell pattern first. Only branch into `effectKind: 'custom'`, new runtime helpers, or new effect handlers when the spell cannot fit existing patterns cleanly.

2. **School model**  
   Decide whether the spell belongs to one school or multiple schools. Multi-school spells are platform-sensitive because study and presenter views currently surface only one school XP gate cleanly.

3. **Authored tuning fields**  
   Lock `range`, `baseDamage`, `manaCost`, `xpGainOnCast`, `studyRequirements`, and any `statusEffects` before implementation. These are content decisions, but their proofs often live in runtime and presenter tests.

4. **Animation strategy**  
   Reuse an existing animation ref/module when it already matches the player-visible behavior. If not, add the content ref and follow [adding-animation.md](adding-animation.md) for the module, generator, and Three ownership path.

5. **Proof homes**  
   Decide early which tests prove this spell: contract, runtime/unit, presenter/UI, animation, or a full mechanic chain. Do not leave this implicit until the end.

## Non-obvious Repo Rules

- Ring spells live in `packages/content/src/ring-spells/`. Do **not** duplicate them under `packages/content/src/abilities/`; `pnpm generate:indexes` wires them into generated ability exports.
- Learned spells live in `player.learnedRingSpellIds`.
- School mastery lives in `player.ringMastery[schoolId] = { xp }`.
- Studying unlocks a spell and charges gold, but does **not** grant XP.
- Successful casts grant school XP through each spell's authored `xpGainOnCast`.
- New schools are not data-only. They often require runtime, presenter, and contract work because parts of the current system are still fire-oriented.
- `tests/contracts/content-cross-references.contract.test.ts` includes hardcoded accepted ring-school strings. If you add a genuinely new school, update that allowlist too.

## Hidden Escalation Cases

### New status work

If the spell introduces a new persistent effect:

- add the content status definition
- wire any runtime application/removal logic
- check presenter/UI surfaces that show active statuses
- add or reuse status animations, including Three coverage if the overlay owns the presentation

### New animation work

If the spell needs a new projectile, impact, self, aoe, or status visual:

- add the content `AnimationRef`
- add or update the canvas module
- add the Three module when the effect needs overlay-owned behavior
- rerun `pnpm generate:indexes`
- prove registry coverage and Three ownership

### Custom mechanic work

If the spell adds new events, new view data, or new interaction rules:

- follow the 6-hop chain in [adding-mechanic.md](adding-mechanic.md)
- update contracts, presenter output, and UI render paths instead of hiding the behavior inside content only
- add contract coverage when the mechanic references live IDs

### New school or combo expansion

If the spell adds a new school or multi-school progression:

- update ring-school source files and union types
- inspect `packages/game-core/src/abilities/definitions/ring-spell-utils.ts` for damage-type assumptions
- inspect `packages/game-core/src/systems/magic-xp.ts` and `packages/game-core/src/engine/handlers/combat.ts` for school-specific progression hooks
- inspect `packages/presenter/src/game-view.ts`, `packages/presenter/src/builders/town-view-builder.ts`, and `packages/presenter/src/builders/player-hud-builder.ts` for single-school XP-gate assumptions

## Checklist

- [ ] Spell file exists in `packages/content/src/ring-spells/` with stable IDs and locked authored tuning fields
- [ ] Runtime definition exists in `packages/game-core/src/abilities/definitions/`
- [ ] Reuse-vs-custom runtime choice is explicit
- [ ] New statuses live in `packages/content/src/statuses/`
- [ ] Animation reuse/new-module decision is explicit
- [ ] New-school or combo-school asks include the platform surfaces above
- [ ] `pnpm generate:indexes` has been run instead of hand-editing generated files
- [ ] Presenter/UI surfaces are updated when the player should see new state, study info, or animations
- [ ] Contract coverage proves spell IDs, animation refs, and cross-references
- [ ] Runtime/presenter/UI proofs match the spell class
- [ ] Work finishes on `pnpm validate`

## Validation

Use the lightest proofs that match the spell:

- `tests/contracts/ring-magic.contract.test.ts`
- `tests/contracts/content-cross-references.contract.test.ts`
- targeted runtime or command-handler tests under `packages/game-core/src/`
- presenter/UI tests under `packages/presenter/src/builders/` and `apps/web/src/components/`
- `packages/content/src/animation-refs/index.test.ts`
- `tests/integration/animation-refs-generator.integration.test.ts`
- `pnpm run check:three-animations` when the spell adds or changes overlay-owned animation coverage

Always finish on:

```bash
pnpm validate
```
