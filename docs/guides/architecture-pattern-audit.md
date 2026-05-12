# Architecture Pattern Audit

Use this guide for future sweeps that look for drift from [Architecture Patterns](architecture-patterns.md). The goal is to classify findings cleanly, log confirmed bugs, and avoid mixing audit work with broad refactors.

## Audit Scope

Check for:

- Runtime decisions in `packages/content`.
- Static catalog declarations outside their entity files.
- Hand-edited generated indexes or registries.
- Raw string IDs where an imported definition or dot-walked ref should be used.
- Presenter data missing enough shape for the web to render without duplicating content logic.
- Web components querying content or reconstructing core rules.
- Feature behavior bypassing central command, ability, event, presenter, or UI pipelines.
- State changes without migration, restore, validation, or old-save compatibility checks.
- Test-layer drift, especially unit/property tests importing live `@dungeon/content`.
- Stale docs or guides that point contributors toward old patterns.

## Finding Classes

| Class | Meaning | Default action |
|---|---|---|
| Immediate bug | Shipped behavior is broken, data is invalid, saves cannot restore, or a player-visible flow fails | Log under `docs/bugs/`, ask whether to fix now |
| Boundary drift | Code works but ownership moved to the wrong package or layer | Record in audit notes or a follow-up refactor plan |
| Missing guardrail | The repo lacks a test, contract check, lint rule, or generator check for a known risk | Add a focused guardrail plan or implement if scoped |
| Stale docs | A guide, skill, or checklist teaches an outdated workflow | Patch docs in the audit pass |
| Generated-index violation | A generated artifact was hand-edited or source files are missing | Restore generator ownership and rerun `pnpm generate:indexes` |
| Follow-up refactor | A cleanup is valuable but not blocking current behavior | Track separately from confirmed bugs |

## Required Bug Logging

When a finding is a confirmed bug, create or update an entry under `docs/bugs/` before fixing it. Include:

- Observed behavior.
- Expected behavior.
- Impact.
- Reproduction or evidence.
- Suspected files.
- Proposed validation.

After logging, ask the user whether the bug should be fixed in the current session unless they already asked for bug fixing.

## Audit Workflow

1. Read [Architecture Patterns](architecture-patterns.md), [Architecture](architecture.md), and [Testing](testing.md).
2. Define the sweep scope before searching.
3. Inspect source files and generated artifacts without editing implementation code.
4. Classify each finding using the classes above.
5. Patch stale docs or skills when that is the stated task.
6. Log confirmed bugs under `docs/bugs/`.
7. Keep refactors separate unless the user approves expansion.
8. Run `pnpm generate:indexes` if generated artifacts are touched or suspected stale.
9. Finish with `pnpm validate`.

## Evidence Checklist

Each finding should name:

- Real file path and line reference.
- Violated pattern.
- Why it matters.
- Suggested owner layer.
- Correct validation layer.
- Whether it is a bug, guardrail gap, docs issue, generated-index issue, or follow-up refactor.
