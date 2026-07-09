---
name: adding-spell
description: Add or change a ring spell in this repo's ring-magic system. Trigger on direct authoring prompts such as add a new ring spell for the fire school, create a new study spell in the ring system, add a combo spell that needs two schools, or ask what a new ring spell touches. Do not use for generic non-ring abilities or full ring-package asks.
---

# Adding Spell

Add or change a **ring spell**. This skill defaults to the ring-magic path and only redirects away when the prompt is clearly about a generic non-ring ability.

## Load these references when needed

- Read `references/authoring-checklist.md` for the file map, authored fields, escalation rules, and proof homes.
- Read `../ring-magic-triage/references/triage-matrix.md` before committing to scope.
- Read `../../guides/adding-ring-spell.md` for the spell-specific workflow.
- Read `../../guides/adding-ability.md` only when the prompt is clearly about a generic ability instead of a ring spell.

## Core rules

1. Disambiguate first: ring spell or generic ability.
2. If it is a ring spell, run ring-magic triage before listing files.
3. Default to reuse of an existing ring-spell pattern before recommending custom runtime work.
4. Do not duplicate ring spells under `packages/content/src/abilities/`.
5. If the spell needs new visuals, route that branch through `adding-animation`.
6. If the spell adds new runtime/event/presenter/UI behavior, route that branch through `adding-game-mechanic`.
7. Treat new-school or combo-school asks as platform expansion unless repo reality proves otherwise.
8. Use `docs/feature-proofs.yml` to find ring ability proof homes, then run `pnpm run check:feature-proofs` before `pnpm run check:fast`.

## Workflow

1. Decide whether the prompt is really about a ring spell.
2. Classify the ring-spell work with ring-magic triage.
3. Lock the spell's authored fields and school model.
4. Name the content and runtime surfaces.
5. Add any animation or mechanic routes that the classification requires.
6. Return the proof homes, feature-proof registry coverage, and generator step.

## Output contract

Return:

- whether the prompt stays on the ring-spell path or redirects to generic ability guidance
- the classification from ring-magic triage
- the exact content/runtime/presenter/UI files that matter
- whether `adding-animation` or `adding-game-mechanic` is also needed
- the proof homes
- the focused validation commands from `docs/feature-proofs.yml` when a matching feature exists

## Examples

**Example 1:**

Input: "Add a new fire spell with a different mana cost and range."

Output:
- keeps the work on the ring-spell path
- treats the ask as pattern reuse unless the prompt adds more
- names spell content, runtime definition, and proof surfaces

**Example 2:**

Input: "Add a combo spell that needs two schools and a new projectile visual."

Output:
- classifies the ask as combo-school platform expansion plus animation work
- routes to `adding-animation` and `adding-game-mechanic`
- names presenter/game-view and animation ownership surfaces

## Failure modes to avoid

- Do not assume "spell" means generic ability in this repo.
- Do not treat new-school or combo-school work as content-only.
- Do not omit study/mastery implications.
- Do not invent a duplicate `packages/content/src/abilities/` file for the spell.
- Do not stop at the spell content file when the ask clearly needs animation or mechanic work.
- Do not skip ability contract, browser, or save compatibility proof when the changed surfaces require them.
