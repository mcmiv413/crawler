---
name: quick-task
description: Handle trivial, well-scoped work in one pass when the change should stay under 3 files, under roughly 200 lines, and outside major planning overhead.
---

# Quick Task

Use this skill for small, explicit work where the full intake -> research -> planning -> implementation -> review chain would be overhead.

## Quick-task threshold

Stay in this skill only when all of these are true:

- the change should touch **3 or fewer files**
- the change should stay under **about 200 lines**
- requirements are already clear
- no architectural decision, migration, or cross-surface rollout is needed
- no research spike is required

If the task grows beyond that threshold, stop and route to `planning`.

## Workflow

1. Confirm the task and expected outcome.
2. Estimate touched files, LOC, and validation scope.
3. If it still fits the threshold, write a short inline mini-plan:
   - files to touch
   - approach
   - proof or test command
4. Implement the change. Use TDD when code behavior changes.
5. Re-check scope during implementation. If new files, higher risk, or design questions appear, stop and escalate to `planning`.
6. Do a brief self-review for edge cases, naming, and security-sensitive mistakes.
7. Run the smallest relevant validation first, then end on the repo gate that matches the change. Code changes should still finish on `pnpm validate`.
8. When deterministic proof planning is in scope, run the released `proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA` and keep the selected obligations intact.
9. Do not require `proofctl validate` or `proofctl verify` today; those authoritative remote steps arrive with PR0B/PR0C.

## Escalation triggers

Escalate out of `quick-task` immediately if:

- the change grows past the file or LOC threshold
- the user adds new scope during implementation
- a migration, schema, or generated-artifact story appears
- the right fix is no longer obvious from current repo context

## Guardrails

- Do not create repo-local planning files.
- Do not silently turn a quick task into a medium-sized rollout.
- If the task is actually a bug report or workflow problem, consider `issue-report` instead of implementing immediately.
- A small diff is not exempt from advisory `proofctl plan` when deterministic proof planning is in scope, and it will not be exempt from remote proof once PR0B/PR0C make validation and attestation verification available.
