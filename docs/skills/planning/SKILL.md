---
name: planning
description: Create or review implementation plans that are scoped, grounded in current repo files, complexity-rated, vertically sliced, test-backed, and ready for repo validation.
---

# Planning

Use this skill when the user asks for a plan, a plan review, sequencing advice, or scope breakdown.

## Workflow

1. Start from the current repository, not an imagined one. Audit real files, package ownership, and the existing validation path before proposing workstreams.
2. If requirements are still fuzzy, run `task-intake` first. If the plan needs evidence about existing patterns, prior work, or external libraries, run `research` before freezing the plan.
3. Assess complexity with `references/complexity-rubric.md`. Route truly tiny work to `quick-task`; keep everything else in the full planning workflow.
4. Lock scope, assumptions, non-goals, compatibility policy, rollout expectations, and any temporary-regression policy before naming phases.
5. Check layer ownership: content is static declarations, core/server own runtime decisions, presenter owns display-ready views, and web renders `GameView`.
6. Enumerate affected surfaces: entry points, state, events, contracts, persistence, migrations/defaults, restore/session behavior, validators, presenter/read model, UI/store, docs, generated artifacts, and final validation.
7. Convert work into acceptance stories with proof homes. Use the lightest correct test layer: unit/property for pure logic, contract for live IDs and cross-references, integration for flow, presenter/UI for read models and rendering, E2E only when lower layers are not enough.
8. Build workstreams as vertical slices using `references/deliverable-template.md`. Name real files, new files, proof targets, and exit criteria for each slice.
9. Run a readiness pass before presenting the plan:
   - every referenced file path exists or is explicitly declared new
   - workstreams are dependency ordered
   - no `TBD`, `TODO`, `FIXME`, or `???` placeholders remain
   - docs, generated artifacts, and validation are included when relevant
   - the plan finishes on `pnpm validate`

## Required plan structure

Use this section order unless the user explicitly wants a different format:

1. `# <Plan Title>`
2. `## Goal`
3. `## Current-state audit`
4. `## Locked decisions and non-goals`
5. `## Ownership and generated artifacts`
6. `## Acceptance stories`
7. `## Test strategy by layer`
8. `## Workstreams`
9. `## Risks and mitigations`
10. `## Validation plan`
11. `## Done when`

## Planning rules

- Never write `x.ts or equivalent` if the real file can be identified.
- Never assume a system is absent without checking.
- Prefer repo-local patterns over external patterns unless the user explicitly chooses a different approach.
- If research findings conflict, call out the tradeoff and lock the decision instead of blending both implicitly.
- If a feature references content IDs, require contract coverage.
- If player-visible behavior changes, prove the chain through event, presenter, and UI.
- If generated indexes or registries are affected, require `pnpm generate:indexes` and a diff check.
- If docs or examples would teach the old pattern, include docs updates in scope.
- If a confirmed bug is discovered during planning, require a `docs/bugs/` entry before implementation unless the user already scoped bug fixing.
- Never end a plan on partial evidence. Targeted tests are iteration proof; the merge gate is still `pnpm validate`.

## Handoff expectations

- Save approved plans to the session `plan.md`, not to repo-local `.plans/` files.
- Reflect the approved workstreams into SQL todos before implementation starts.
- If the work still fits the `quick-task` threshold after audit, say so explicitly instead of forcing the full workflow.
