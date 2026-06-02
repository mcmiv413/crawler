---
name: implementation-coordinator
description: Ultra-thin orchestrator that delegates ALL work to workers. Reads no files, runs no tests, generates no summaries itself. Only dispatches and routes between workers based on their brief structured responses. Use after plan approval to automate the full implement -> review -> fix -> commit cycle.
argument-hint: "[plan-file-path] [--force-worker goofy|cody|codex] [--skip-review]"
---

# Implementation Coordinator

Ultra-minimal dispatcher. Protects context window by delegating EVERYTHING.

**Cardinal rule:** This coordinator NEVER reads file contents, NEVER runs tests, NEVER parses plans, NEVER generates summaries. It only launches workers and routes based on their short structured responses.

---

## Design Philosophy

This skill is a **traffic controller**, not a worker. Every cognitive task - reading, analyzing, implementing, reviewing, summarizing - is dispatched to a worker. The coordinator's context window stays nearly empty regardless of project size or plan complexity.

**What the coordinator does:**
- Parse arguments (plan path, flags)
- Run 3 quick bash commands for prerequisites (branch name, clean tree, plan exists)
- Launch workers sequentially
- Upgrade to a stronger worker when the current worker cannot complete or correct the work
- Report 1-line status updates between steps
- Ask user for confirmation at the end

**What the coordinator NEVER does:**
- Read plan files
- Parse plan content
- Run tests or linters
- Read implementation output
- Generate summaries
- Analyze effort (worker does this)
- Construct detailed prompts from file content

---

## Procedure

### Step 0: Prerequisite Checks (coordinator does this directly - 3 quick bash commands)

```bash
# 1. Get branch name
git rev-parse --abbrev-ref HEAD

# 2. Check clean working tree
git diff-index --quiet HEAD --

# 3. Check plan file exists (infer path from branch or use argument)
test -f ".plans/plan-<STORY-ID>.md"
```

If any fail: report the one-line error and stop. Do NOT investigate further.

**Argument parsing:**
- First positional arg: plan file path (or infer from branch)
- `--force-worker goofy|cody|codex`: override the effort assessment
- `--skip-review`: skip Step 3

---

### Step 1: Analyze Plan & Assess Effort (WORKER)

Launch a **single worker** that reads the plan AND returns effort assessment. This keeps ALL plan content out of the coordinator's context.

**Worker call:**
- **Worker:** `cody` for the assessment pass
- **Description:** "Analyze plan and assess effort for <STORY-ID>"
- **Prompt:**

```
Read the plan file at: {planPath}

Return a structured assessment in EXACTLY this format (no other text):

EFFORT: low|medium|high
WORKER: goofy|cody|codex
RATIONALE: <one sentence why>
DELIVERABLES_COUNT: <number>
FILES_COUNT: <number>
LOC_ESTIMATE: <number>
SECURITY_SENSITIVE: yes|no
AUTO_ESCALATE: yes|no
ESCALATE_REASON: <reason or "none">

Assessment criteria (in priority order):
1. Clarity: "Could a junior dev implement from this plan alone?" Yes -> low/goofy, Mostly -> medium/cody, No -> high/codex
2. Pattern familiarity: Copying existing -> low/goofy, Adapting standard -> medium/cody, Novel -> high/codex
3. Error impact: Low/isolated -> low/goofy, Medium -> medium/cody, High/production/security -> high/codex
4. LOC as tiebreaker only

Auto-escalate to high/codex for: security, data migrations, breaking API changes, critical systems, plan marks "high risk"
```

**Coordinator receives:** ~8 lines of structured text. Parse WORKER field.

If `--force-worker` was specified, override the WORKER value.

If AUTO_ESCALATE is "yes" and user forced a lower worker, warn:
```
Warning: Plan triggers auto-escalation ({reason}) but --force-worker overrides to {worker}. Proceed? (yes/no)
```

Report: `Plan analyzed: {STORY-ID} -> {worker} ({effort}; {rationale})`

**Upgrade ladder:** `goofy -> cody -> codex`.

Use the selected worker as the first attempt. If that worker fails or cannot correct the implementation, upgrade one step and retry the failed phase. Do not retry the same worker from the coordinator. If `codex` fails, stop and report manual intervention required.

---

### Step 2: Implement (WORKER)

Launch implementation worker with the selected route. The worker reads the plan itself - coordinator passes only the path.

**Worker call:**
- **Worker:** {selected worker from Step 1}
- **Description:** "Implement {STORY-ID}"
- **Prompt:**

```
You are implementing a plan. Read it at: {planPath}

Rules:
- Follow ALL specifications exactly
- Complete ALL testable deliverables
- Use patterns specified in the plan
- Write tests as specified
- Do NOT add features beyond plan scope
- Do NOT refactor unrelated code
- Run all tests and ensure they pass before finishing

When complete, report in EXACTLY this format (no other text):

STATUS: success|failure
FILES_MODIFIED: <comma-separated list>
TESTS_STATUS: passing|failing|no-tests
ERROR: <error description or "none">
SUMMARY: <one sentence of what was implemented>
```

**Coordinator receives:** ~5 lines. Check STATUS field.

If STATUS is "failure":
- If current worker is `goofy` or `cody`, upgrade to the next worker and rerun Step 2 with the same plan path.
- Include the prior ERROR line in the upgraded worker prompt as context.
- If current worker is `codex`, report the ERROR line to user and stop.

Report: `Implementation complete: {SUMMARY}`

---

### Step 3: Review (WORKER) - skip if `--skip-review`

Launch review worker. It reads the plan and diffs itself.

**Worker call:**
- **Worker:** {same worker as implementation}
- **Description:** "Review {STORY-ID} implementation against plan"
- **Prompt:**

```
Execute the review-task skill for story {STORY-ID}.

Plan file: {planPath}
Enforce plan adherence: true

Review the implementation for:
- Plan compliance (all deliverables met)
- No unauthorized deviations (revert any found)
- Code quality standards
- Tests passing

If you find issues, fix them directly. You have up to 3 fix iterations.

When complete, report in EXACTLY this format (no other text):

STATUS: clean|fixed|failed
ITERATIONS: <number>
ISSUES_FOUND: <number>
ISSUES_FIXED: <number>
DEVIATIONS_REVERTED: <number>
TESTS_STATUS: passing|failing
ERROR: <error description or "none">
```

**Coordinator receives:** ~7 lines. Check STATUS field.

If STATUS is "failed":
- If current worker is `goofy` or `cody`, upgrade to the next worker and rerun Step 3 with the same plan path and current diff.
- Include the prior ERROR line, issue counts, and iteration count in the upgraded worker prompt as context.
- If current worker is `codex`, report ERROR to user with suggestion for manual intervention, then stop.

Report: `Review {STATUS}: {ITERATIONS} iteration(s), {ISSUES_FIXED} issues fixed`

---

### Step 4: Final Summary (WORKER)

Launch summary worker to generate user-facing report. Coordinator does NOT read the diff or test output.

**Worker call:**
- **Worker:** {same worker as implementation}
- **Description:** "Generate implementation summary for {STORY-ID}"
- **Prompt:**

```
Generate a final implementation summary for story {STORY-ID}.

Context (from coordinator):
- Plan file: {planPath}
- Implementation worker: {worker}
- Worker attempts: {worker attempt chain, e.g. "goofy -> cody"}
- Implementation status: {step2 STATUS}
- Review status: {step3 STATUS or "skipped"}
- Review iterations: {step3 ITERATIONS or "N/A"}

Do the following:
1. Run `git diff --stat` to see changed files
2. Run tests one final time to confirm passing
3. Generate a markdown summary with:
   - Worker used and rationale
   - Any worker upgrades and why they happened
   - Files changed (from git diff --stat)
   - Review results
   - Test status
   - "Ready for commit confirmation"

Output the summary directly - it will be shown to the user.
```

**Coordinator receives:** The formatted summary. Display it to the user verbatim.

---

### Step 5: User Confirmation (coordinator does this directly)

Ask the user: `Confirm changes are ready? (yes/no)`

If yes: report complete.
If no: ask what needs adjustment.

---

## Context Window Budget

| Step | Coordinator context consumed |
|------|------------------------------|
| Prerequisites | ~10 lines (bash output) |
| Step 1 result | ~8 lines |
| Step 2 result | ~5 lines |
| Step 3 result | ~7 lines |
| Step 4 result | ~30 lines (summary shown to user) |
| Status updates | ~5 lines |
| **Total** | **~70 lines** regardless of project size |

Compare to old approach: coordinator would read plan (50-200 lines), read diffs (100+ lines), run tests (50+ lines), parse output - easily 500+ lines consumed.

---

## Error Handling (coordinator-level only)

| Error | Coordinator Action |
|-------|-------------------|
| Not on feature branch | One-line error, stop |
| Dirty working tree | One-line error, stop |
| Plan file missing | One-line error, stop |
| Step 1 worker fails | Report "Effort assessment failed", stop |
| Step 2 STATUS=failure on `goofy` or `cody` | Upgrade one worker level and rerun Step 2 |
| Step 2 STATUS=failure on `codex` | Report ERROR line, stop |
| Step 3 STATUS=failed on `goofy` or `cody` | Upgrade one worker level and rerun Step 3 |
| Step 3 STATUS=failed on `codex` | Report ERROR line + "Manual intervention required", stop |
| Step 4 worker fails | Report "Summary generation failed" + basic status from prior steps |

In ALL cases: the coordinator reports the short structured error. It does NOT investigate, read files, or fix issues itself. Recovery is limited to upgrading through the worker ladder.

---

## Integration with Other Skills

Workers invoke these skills (coordinator never invokes them directly):
- **review-task**: Invoked by Step 3 worker

---

## Safety & Boundaries

- Only operates on feature branch (checked in Step 0)
- Requires clean working tree (checked in Step 0)
- User confirmation required before considering complete
- Max 3 review iterations (enforced by Step 3 worker, not coordinator)
- Max 2 upgrades per run (`goofy -> cody -> codex`)
- Never downgrade after upgrading; final summary reports the full worker attempt chain
- Coordinator never writes code or modifies files

---

## Usage Examples

```bash
# Auto-detect plan from branch name
/implementation-coordinator

# Explicit plan file
/implementation-coordinator .plans/plan-PSRE-349.md

# Force worker (overrides effort assessment)
/implementation-coordinator --force-worker codex

# Skip review (faster, less safe)
/implementation-coordinator --skip-review

# Combined flags
/implementation-coordinator .plans/plan-PSRE-349.md --force-worker cody --skip-review
```

---

## References

- **[complexity-assessment.md](references/complexity-assessment.md)**: Detailed criteria workers use for effort routing
- **[examples.md](references/examples.md)**: 10 execution scenarios with outcomes
- **[implementation-notes.md](references/implementation-notes.md)**: Worker prompt patterns and technical details
