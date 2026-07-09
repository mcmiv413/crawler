---
name: implementation
description: Execute an approved implementation plan in this repo while preserving architecture boundaries, plan fidelity, generated artifacts, test-layer rules, and mandatory validation.
---

# Implementation

Use this skill when the user asks to implement an approved plan or clearly approved scope.

## Inputs

- An approved session `plan.md` or equivalent approved scope in the conversation
- The current repo files named by that plan
- Optional SQL todos, research notes, or validation notes

If no approved plan exists, stop and route back to `planning`.

## Workflow

1. Re-read the approved plan and the current files it names before editing anything.
2. Check layer ownership before each slice: content is static declarations, core/server own runtime decisions, presenter owns display-ready views, and web renders `GameView`.
3. Look up the relevant feature in `docs/feature-proofs.yml` before choosing or adding tests. If no entry fits a new major mechanic, update the registry as part of the implementation.
4. Turn the plan into active execution slices. Update SQL todo status before starting and after completing each slice.
5. Prefer central pipelines over local one-offs: command handlers, turn scheduling, ability runtime, equipment grants, event formatting, presenter builders, stores, UI config, and animation/rendering registries.
6. Implement the smallest end-to-end slice that proves behavior. Use TDD when the slice is code-heavy and the proof belongs in tests.
7. Reuse cited research only where it matches repo patterns and constraints. When repo reality disagrees with the plan, treat that as a deviation, not as silent scope drift.
8. For state-shape changes, handle schemas, persistence, migration/defaults, restore behavior, historical save fixtures, validators, and presenter compatibility before calling the slice done.
9. If generated artifacts are affected, update the source files first and then run the appropriate generator instead of hand-editing generated outputs.
10. Test from the smallest affected scope first. If quiet output fails, rerun the failing scope with full output before diagnosing.
11. Run `pnpm run check:feature-proofs` before `pnpm run check:fast`. Browser-facing changes need component proof or `pnpm test:e2e:scenario`; persisted state changes need save compatibility proof.
12. Finish only after `pnpm validate` passes.

## Plan-fidelity rules

- The approved plan is the source of truth.
- Allowed deviations: discovered repo reality, compatibility fixes, validation-required wiring, or explicit user-approved scope changes.
- Required response to a deviation: update the session plan or otherwise record the deviation clearly before continuing.
- Unacceptable deviations: unrelated refactors, opportunistic feature work, or hidden changes that the plan never justified.
- If the implementation uncovers an unrelated confirmed bug, log it under `docs/bugs/` and ask before expanding scope.

## Guardrails

- Do not hand-edit files marked generated.
- Do not put runtime state decisions in `packages/content`.
- Do not make web components query content or duplicate presenter formatting to compensate for missing view data.
- Dot-walk or import content references where practical instead of repeating raw IDs.
- Unit/property tests use builders and local fixtures. Live content checks belong in contract tests.
- Do not use `feature-proof` allowlists unless the diff is demonstrably non-behavioral or browser output truly cannot change, and always include a concrete reason.

## Completion report

Report:

- what changed
- which files or layers were touched
- whether generated artifacts were regenerated
- which deviation decisions were needed, if any
- validation commands run, ending with `pnpm validate`
- any follow-up risks or bugs logged
