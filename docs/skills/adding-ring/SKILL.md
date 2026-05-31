---
name: adding-ring
description: Add a new elemental ring package in this repo. Use whenever the prompt asks for a new ring, elemental ring, ring school package, ring item that grants spells, or a ring plus its study and spell wiring, even if the user only says things like "add a new ring", "make a frost ring", "add a new ring school", or "add a ring with a new spell."
---

# Adding Ring

Add a full ring package. This skill is for **ring item + school + grant + spell-package wiring**, not for a spell-only change inside an existing ring package.

## Load these references when needed

- Read `references/authoring-checklist.md` for the file map, hidden repo rules, and proof homes.
- Read `../ring-magic-triage/references/triage-matrix.md` when the scope is still ambiguous.
- Read `../../guides/adding-ring.md` for the full package guide.
- Read `../../guides/adding-ring-spell.md` when the ring work expands into spell-specific complexity.

## Core rules

1. Start with ring-magic triage before listing files.
2. If the task is only a spell change, route to `adding-spell` instead of pretending it is a full ring-package task.
3. Treat a new ring as at least item content, school mapping, enchantment grant, and spell-package wiring.
4. If the ring introduces a new school, include the school source file and `RingSchool` union work.
5. If the ring's spells need new visuals, route that branch through `adding-animation`.
6. If the ring's spells or progression add new player-visible behavior, route that branch through `adding-game-mechanic`.
7. Run `pnpm generate:indexes` and finish on the right proofs, then `pnpm validate`.

## Workflow

1. Classify the ring request with ring-magic triage.
2. Decide whether the ring uses an existing school or introduces a new one.
3. Name the base package files: item, school mapping, enchantment grant, and spell surfaces.
4. Decide whether the ring also needs new spell content, new visuals, or new mechanic/platform work.
5. Return the full file map, generator step, and proof homes.

## Output contract

Return:

- whether the task is a full ring package or should hand off to `adding-spell`
- whether the school already exists
- the exact content/runtime/presenter/UI files that are in scope
- whether `adding-animation` or `adding-game-mechanic` is also needed
- the proof homes

## Examples

**Example 1:**

Input: "Add a new fire ring that grants a tuned variant of an existing fire spell."

Output:
- keeps the work on the ring-package path
- names item, enchantment grant, school mapping, and spell surfaces
- keeps the spell branch in reuse mode unless the prompt adds more complexity

**Example 2:**

Input: "Add a new frost ring school and a starter spell for it."

Output:
- treats the ask as new-school work
- includes school source files, union/allowlist implications, and the ring package surfaces
- routes any runtime/presenter expansion through `adding-game-mechanic`

## Failure modes to avoid

- Do not treat ring work as only an item file.
- Do not forget the enchantment grant path.
- Do not forget `packages/content/src/ring-schools/types.ts` when the school set changes.
- Do not duplicate ring spells under `packages/content/src/abilities/`.
- Do not hide animation or mechanic expansion inside a content-only answer.
