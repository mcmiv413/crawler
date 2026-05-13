---
name: issue-report
description: Capture a structured repo or workflow issue report and route it to a repo-native destination such as docs/bugs/ or a GitHub-ready issue draft.
---

# Issue Report

Use this skill when the user wants to report a bug, broken workflow, or repo issue rather than immediately fix it.

## Default destination

Default to a repo-local bug note under `docs/bugs/` unless the user explicitly asks for a GitHub issue draft or another destination.

Suggested filename:

`docs/bugs/<YYYY-MM-DD>-<slug>.md`

## Intake fields

Collect missing fields one at a time with `ask_user`:

1. summary
2. actual behavior
3. expected behavior
4. reproduction steps
5. affected files, skill, or workflow surface
6. additional evidence or constraints

## Workflow

1. Collect the issue details one question at a time.
2. Normalize them into a concise report with:
   - summary
   - actual behavior
   - expected behavior
   - reproduction
   - affected surface
   - evidence
3. Preview the report before writing anything.
4. On confirmation, either:
   - create/update a `docs/bugs/` note, or
   - prepare a GitHub-ready issue title/body if the user asked for that route
5. End by asking whether the bug should also be fixed in the current session when that question matters.

## Guardrails

- Do not silently fix the issue from this skill unless the user explicitly asks for implementation too.
- Do not create duplicate issue notes when an existing report already covers the same bug.
- Keep the report factual and reproducible; avoid root-cause claims unless they are confirmed.
