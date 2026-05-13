---
name: retrospective
description: Review a completed implementation against its plan, diff, validation failures, and review notes to capture lessons learned and recommend deterministic guardrails.
---

# Retrospective

Use this skill after work is complete when the user wants lessons learned or preventive guardrail ideas.

## Workflow

1. Gather the approved plan, final diff, validation failures, and review findings.
2. Compare planned slices with actual work:
   - what landed as planned
   - what deviated
   - what was added late
   - what caused churn
3. Group recurring or severe problems into patterns.
4. Recommend deterministic checks only for patterns that are either:
   - repeated
   - severe enough to justify automation
   - realistically enforceable by lint, tests, audit scripts, or CI
5. Exclude one-off mistakes, taste-only style issues, or context-heavy problems that are not worth automating.

## Output contract

Return:

- **What worked**
- **What did not work**
- **Recurring patterns**
- **Proposed guardrails**
- **Not worth automating**

For each proposed guardrail, name the likely home:

- ESLint or type rule
- audit or repo script
- pre-commit hook
- CI or validation gate
- test helper or fixture pattern

## Guardrails

- Retrospective is analysis-only unless the user explicitly asks to implement the guardrail.
- Base recommendations on observed evidence, not hypothetical future concerns.
- Favor cheap deterministic checks over manual process rules.
