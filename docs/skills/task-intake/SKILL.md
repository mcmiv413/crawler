---
name: task-intake
description: Turn a rough request into a locked repo-native implementation brief by collecting scope, constraints, and Definition of Done, then routing to quick-task, research, planning, or issue-report.
---

# Task Intake

Use this skill when the user has a rough idea, bug report, or request but the execution path is not locked yet.

## Intake fields

Collect these one question at a time with `ask_user`:

1. **Objective** - what outcome the user wants
2. **Work type** - bugfix, feature, refactor, docs/tooling, or research spike
3. **Constraints and guardrails** - rules, boundaries, dependencies, rollout limits
4. **Definition of Done** - what proves the work is complete
5. **Existing context** - relevant issue links, files, screenshots, or prior notes

Only ask a question when the answer will change scope or routing.

## Workflow

1. Collect missing intake fields sequentially with `ask_user`.
2. Normalize the request into a concise implementation brief:
   - problem statement
   - in-scope work
   - out-of-scope work
   - constraints
   - Definition of Done
3. Search for existing context only as needed:
   - repo files and docs
   - GitHub issues or PRs when history matters
   - session history when prior work is likely relevant
4. Choose the next route explicitly:
   - `quick-task` for <=3 files, <=200 LOC, and no architectural decisions
   - `research` when patterns, dependencies, or external library behavior are unclear
   - `planning` for anything multi-surface, ambiguous, or higher risk
   - `issue-report` when the user is reporting a workflow or product issue rather than requesting implementation
5. Return the locked intake brief plus the recommended next skill.

## Output contract

Always return:

- **Problem**
- **In scope**
- **Out of scope**
- **Constraints**
- **Definition of Done**
- **Recommended route**
- **Why that route fits**

## Guardrails

- Do not invent missing constraints.
- Do not start implementing from this skill unless the routed next step is explicitly `quick-task`.
- If the user is clearly reporting a bug that should be logged, prefer `issue-report` over silently treating it as implementation scope.
