# Repo Skills Workflow

## Overview

This repo now treats `docs/skills/` as the single canonical source for shared skills. The runtime skill trees under `.github/skills/`, `.claude/skills/`, and `.agents/skills/` are generated mirrors, so contributors only edit `docs/skills/` and then regenerate the mirrors.

The rollout keeps the strongest PSRE workflow ideas - structured intake, evidence-based research, complexity-aware planning, plan-fidelity implementation, guardrail-focused review, quick-task triage, retrospectives, and structured issue capture - while replacing Jira, Glean, and `.plans/` dependencies with repo-native tooling.

## Files to Touch

| Step | File | What to do |
|------|------|------------|
| 1 | `docs/skills/**/*` | Edit the canonical skill source, references, and templates |
| 2 | `scripts/generate-repo-skills.mjs` / `scripts/check-repo-skills.mjs` | Maintain mirror generation and drift detection |
| 3 | `.github/skills/**/*`, `.claude/skills/**/*`, `.agents/skills/**/*` | Generated output only; regenerate instead of hand-editing |
| 4 | `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` | Keep contributor-facing workflow docs current |

## Canonical Source and Mirrors

| Location | Role | Policy |
|----------|------|--------|
| `docs/skills/` | Canonical, versioned skill source | Edit here |
| `.github/skills/` | GitHub-facing runtime mirror | Generated |
| `.claude/skills/` | Claude-facing runtime mirror | Generated |
| `.agents/skills/` | Project skill runtime mirror | Generated |

Do not hand-edit the mirror trees. If the mirrors drift, regenerate them from `docs/skills/`.

## PSRE Capability Map

| PSRE capability | Repo-native home | Status | Repo-native replacement |
|-----------------|------------------|--------|-------------------------|
| `define-task` | `task-intake` | New | Sequential `ask_user` intake, scoped brief, and routing to the right workflow |
| `research-task` | `research` | New | Local repo search first, then GitHub search and Context7 with confidence grading |
| `plan-task` | `planning` | Merged into existing skill | Complexity assessment, research handoff, deliverable templates, and readiness checks |
| `implement-task` | `implementation` | Merged into existing skill | Plan-fidelity execution, explicit deviation handling, SQL todo tracking, and repo validation |
| `review-task` | `post-implementation-review` | Merged into existing skill | Plan-adherence review, deviation classification, and guardrail-focused findings |
| `retro-task` | `retrospective` | New | Plan/diff/validation review with deterministic guardrail recommendations |
| `quick-task` | `quick-task` | New | Lightweight path for <=3 files, <=200 LOC, with explicit escalation triggers |
| `report-issue` | `issue-report` | New | Structured repo-native issue capture via `docs/bugs/` or GitHub-ready drafts |

## Tool Substitutions

| Old dependency | Repo-native replacement |
|----------------|-------------------------|
| Jira issue intake and hierarchy | `ask_user`, repo docs, optional GitHub issues, and session planning state |
| Glean research | Local repo search, session history, GitHub search, and Context7 |
| `.plans/plan-<id>.md` | Session `plan.md` plus SQL todos |
| Jira-only implementation/review workflow | Repo-aware planning, implementation, and post-implementation-review skills |

## Step-by-step Maintenance

1. Edit the canonical files under `docs/skills/`.
2. Rebuild the runtime mirrors:

   ```bash
   pnpm skills:generate
   ```

3. Verify the mirrors still match the canonical source:

   ```bash
   pnpm skills:check
   ```

4. Run the targeted tooling test:

   ```bash
   pnpm vitest run tests/integration/repo-skills.integration.test.ts
   ```

5. Finish on the normal repo gates:

   ```bash
   pnpm run check:fast
   pnpm validate:quick
   pnpm validate
   ```

## What Happens Automatically

- `pnpm skills:generate` replaces the repo runtime mirrors with fresh copies from `docs/skills/`.
- `pnpm skills:check` fails when any mirror is missing, stale, or content-divergent.
- `pnpm run skill:model-orchestrator:sync` now installs the canonical `docs/skills/model-orchestrator/` tree into `~/.claude/skills/model-orchestrator/`.

## Key Files / Commands Reference

| Item | Purpose |
|------|---------|
| `docs/skills/planning/` | Canonical planning skill plus planning references |
| `docs/skills/model-orchestrator/` | Canonical source for the existing model-orchestrator skill |
| `scripts/repo-skills-lib.mjs` | Shared helper for generation and drift checks |
| `scripts/generate-repo-skills.mjs` | Mirror generator |
| `scripts/check-repo-skills.mjs` | Mirror drift checker |
| `tests/integration/repo-skills.integration.test.ts` | Temp-fixture coverage for the sync/check tooling |
