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
8. Check `docs/feature-proofs.yml` for existing proof ownership. Plans that add a major mechanic or new proof home should update the registry.
9. For pull-request work intended to merge under deterministic proof, push the branch, open a draft pull request, run `proofctl plan --pr=PR_NUMBER`, copy the selected obligations into the implementation plan, and do not choose a smaller proof set.
10. Identify guardrails for repeated, severe, or easy-to-regress patterns. Prefer deterministic checks with a clear enforcement home: ESLint/type rule, audit script, generator check, test helper, CI gate, or validation gate. Avoid one-off checks that only match the current incident unless they enforce a documented repo pattern.
11. Build workstreams as vertical slices using `references/deliverable-template.md`. Name real files, new files, proof targets, guardrail homes, and exit criteria for each slice.
12. Run a readiness pass before presenting the plan:
   - every referenced file path exists or is explicitly declared new
   - workstreams are dependency ordered
   - no `TBD`, `TODO`, `FIXME`, or `???` placeholders remain
   - every proposed guardrail names the pattern it protects, the enforcement home, the known-bad case it catches, and the command that proves it
   - docs, generated artifacts, and validation are included when relevant
   - new tests are tracked by git, not ignored, and run in the intended validation layer
   - the plan includes `pnpm run check:feature-proofs` before `pnpm run check:fast`
   - the local validation plan includes `pnpm validate`
   - merge-intended pull-request work ends on `proofctl validate --pr=PR_NUMBER` followed by `proofctl verify --pr=PR_NUMBER`
   - selected remote proof obligations from `proofctl plan --pr=PR_NUMBER` are present and not narrowed

## Required plan structure

Use this section order unless the user explicitly wants a different format:

1. `# <Plan Title>`
2. `## Goal`
3. `## Current-state audit`
4. `## Locked decisions and non-goals`
5. `## Ownership and generated artifacts`
6. `## Acceptance stories`
7. `## Test strategy by layer`
8. `## Guardrail plan`
9. `## Workstreams`
10. `## Risks and mitigations`
11. `## Validation plan`
12. `## Done when`

## Planning rules

- Never write `x.ts or equivalent` if the real file can be identified.
- Never assume a system is absent without checking.
- Prefer repo-local patterns over external patterns unless the user explicitly chooses a different approach.
- If research findings conflict, call out the tradeoff and lock the decision instead of blending both implicitly.
- If a feature references content IDs, require contract coverage.
- If player-visible behavior changes, prove the chain through event, presenter, and UI.
- If browser-facing files change, require component proof or `pnpm test:e2e:scenario`.
- If persisted state shape changes, require historical save compatibility proof.
- If generated indexes or registries are affected, require `pnpm generate:indexes` and a diff check.
- If the plan proposes a guardrail, make it pattern-level, deterministic, and cheap enough for the named validation gate. Include a known-bad fixture or test where practical.
- If a guardrail needs exceptions, require a narrow allowlist with comments that point to the owning pattern or source of truth.
- If optional or feature-flagged code adds a heavy dependency, require an import-boundary or bundle guard that proves the disabled path does not eagerly load it.
- If tests are added outside colocated unit tests, require evidence that they are tracked and included in the intended runner or contract suite.
- If docs or examples would teach the old pattern, include docs updates in scope.
- If a confirmed bug is discovered during planning, require a `docs/bugs/` entry before implementation unless the user already scoped bug fixing.
- Never end a plan on partial evidence. Targeted tests are iteration proof, `pnpm validate` is local confidence, and merge-intended pull requests still require `proofctl validate --pr=PR_NUMBER` followed by `proofctl verify --pr=PR_NUMBER`.

## Handoff expectations

- Save approved plans to the session `plan.md`, not to repo-local `.plans/` files.
- Reflect the approved workstreams into SQL todos before implementation starts.
- If the work still fits the `quick-task` threshold after audit, say so explicitly instead of forcing the full workflow.
