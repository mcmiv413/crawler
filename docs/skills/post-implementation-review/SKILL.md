---
name: post-implementation-review
description: Review completed changes against the approved plan, plan deviations, architecture boundaries, generated-artifact ownership, test-layer rules, docs updates, and validation evidence.
---

# Post-Implementation Review

Use this skill after implementation work when the user asks for review or when a final self-review is needed before handoff.

## Review workflow

1. Load the approved plan or locked scope first.
2. Review the actual diff or changed files against that plan, not just against general code quality expectations.
3. Classify deviations:
   - **accepted**: documented and justified by repo reality or user direction
   - **follow-up required**: understandable but not documented cleanly enough
   - **finding**: out-of-scope, unsafe, or contradictory to the approved plan
4. Check package boundaries: content stays static, core/server own runtime decisions, presenter owns read models, and web renders views.
5. Check generated artifacts, persistence compatibility, presenter/UI split, docs, and validation evidence.
6. Produce findings ordered by severity, then summarize residual risk.

## Review checklist

- Plan conformance: implemented scope matches the approved plan and non-goals remain out of scope.
- Deviations: any departure from plan is either documented and justified or surfaced as a finding.
- Entity files: new catalog data lives in individual source files.
- Generated artifacts: generated indexes or registries were not hand-edited and the right generator was run when needed.
- References: avoid raw literals where imported definitions or dot-walked refs should be used.
- Central pipelines: shared behavior routes through command, ability, equipment, event, presenter, store, or renderer pipelines.
- Presenter/UI split: presenter exposes display-ready data; UI does not duplicate content display logic.
- Persistence and restore: state-shape changes include schema, migration/default/defaults, restore, and old-save compatibility checks.
- Test layers: unit/property tests use builders/local fixtures; live content checks are in contract tests.
- Docs: guides, checklists, and examples changed with the behavior.
- Validation: final evidence includes `pnpm validate`.

## Finding format

Lead with findings ordered by severity. For each finding include:

- file and line
- plan section or expectation that was missed
- problem
- impact
- suggested fix or owner layer
- missing validation, if any

If no issues are found, say so and note any residual risk or test gap.
