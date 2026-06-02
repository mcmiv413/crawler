# Implementation Notes

Technical details for the ultra-thin coordinator pattern.

## Core Principle: Context Protection

The coordinator's ONLY job is dispatching. All cognitive work lives in workers.

**Context budget:** ~70 lines total across an entire execution run, regardless of:
- Plan size (50 lines or 500 lines)
- Implementation scope (2 files or 20 files)
- Test output volume
- Diff size

This is achieved by:
1. Never reading file contents (workers read what they need)
2. Requiring structured responses from workers (fixed-format, ~5-7 lines each)
3. Never running tests or linters (workers do this internally)
4. Delegating summary generation to a worker

## Worker Communication Protocol

All workers MUST return structured responses in a fixed format. This prevents variable-length output from consuming coordinator context.

### Response Format Rules

1. Responses use `KEY: value` format, one per line
2. No prose, no explanations, no markdown formatting
3. Fixed number of fields per step (predictable context consumption)
4. ERROR field captures failure details in one line

### Why Not JSON?

Plain `KEY: value` format is:
- Easier for models to produce consistently
- Simpler to parse (string split on first `: `)
- Less prone to formatting errors (no bracket matching)
- More readable in logs

## Worker Prompt Pattern

Every worker prompt follows this structure:

```
[WHAT TO DO - 1-3 sentences]

[CONTEXT - only what the worker needs, usually just a file path]

[RULES - behavioral constraints]

[OUTPUT FORMAT - exact template to follow]
```

Key: the coordinator passes **paths**, not content. Workers read files themselves.

### Anti-pattern (DO NOT DO)

```
# BAD: Coordinator reads plan, then passes content to worker
planContent = read(".plans/plan-PSRE-349.md")  # 200 lines into coordinator context!
Agent({ prompt: "Implement this plan:\n" + planContent })
```

### Correct pattern

```
# GOOD: Coordinator passes path, worker reads it
Agent({ prompt: "Read and implement the plan at: .plans/plan-PSRE-349.md" })
```

## Worker Selection

| Step | Worker | Rationale |
|------|-------|-----------|
| Effort assessment | cody | Reads the plan and classifies the effort without loading it into coordinator context |
| Low-effort implementation | goofy | Narrow, explicit, easy-to-verify local work |
| Medium-effort implementation | cody | Implementation-heavy delegated work with standard repo patterns |
| High-effort implementation | codex | Ambiguous, high-risk, architectural, or security-sensitive work |
| Review | same as implementation worker | Reviewing needs the same level of care as implementing |
| Summary generation | same as implementation worker | Keeps the selected low/medium/high route consistent through final reporting |

Upgrade ladder:

```
goofy -> cody -> codex
```

The coordinator upgrades only after a structured failure from implementation or review. It never downgrades, and it never retries the same failed worker from the coordinator.

## Coordinator State

The coordinator maintains minimal state between steps - just the structured response fields it needs to route decisions:

```
storyId: string        (from branch name or argument)
planPath: string       (inferred or explicit)
forceWorker: string?   (from --force-worker flag)
skipReview: boolean    (from --skip-review flag)
workerAttempts: string[] (selected worker plus any upgrades)

# Populated as steps complete:
selectedWorker: string (from Step 1: WORKER field)
currentWorker: string  (worker currently handling implementation/review/summary)
implStatus: string     (from Step 2: STATUS field)
reviewStatus: string   (from Step 3: STATUS field)
lastFailure: string?   (compact ERROR line or one-line failed review summary)
```

Total state: ~10 short strings. No arrays, no file contents, no output buffers.

## Error Recovery Philosophy

The coordinator does NOT inspect or repair failed work. Its recovery is limited to upgrading workers:

1. Check the STATUS field from the worker response
2. If implementation or review failed and current worker is `goofy`, upgrade to `cody`
3. If implementation or review failed and current worker is `cody`, upgrade to `codex`
4. If implementation or review failed and current worker is `codex`, report the ERROR field and stop
5. Never read files to investigate
6. Never retry the same failed worker from the coordinator
7. Never attempt to fix issues itself

This keeps the coordinator simple and predictable. Complex error recovery belongs in the upgraded worker.

## Upgrade Prompt Context

When upgrading, keep the prompt compact and avoid copying logs, diffs, or plan content:

```
The previous worker could not complete this phase.

Plan file: {planPath}
Failed phase: implementation|review
Previous worker: {worker}
Attempt chain: {workerAttempts}
Failure summary: {lastFailure}

Read the plan and current diff yourself. Fix the failed phase without expanding scope.
Return the same structured response format required for this phase.
```

## Git Operations

### Branch Name -> Story ID (coordinator does this)

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
STORY_ID=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+' | head -1)
```

### Plan Path Inference (coordinator does this)

```bash
# Try lowercase first (convention)
PLAN_FILE=".plans/plan-$(echo $STORY_ID | tr '[:upper:]' '[:lower:]').md"

# Fallback to original case
if [ ! -f "$PLAN_FILE" ]; then
  PLAN_FILE=".plans/plan-${STORY_ID}.md"
fi
```

### All Other Git Operations (workers do these)

- `git diff --stat` -> summary worker
- `git add` / `git commit` -> NOT done by coordinator (user handles after confirmation)
- `git log` -> summary worker if needed

## Test/Linter Detection

The coordinator does NOT detect test frameworks. The implementation worker (Step 2) detects and runs tests as part of its work. The summary worker (Step 4) runs a final test pass.

Detection logic (for worker reference):

| Indicator | Command |
|-----------|---------|
| `pytest.ini` or pytest in setup | `pytest` |
| `package.json` with test script | `npm test` |
| `go.mod` | `go test ./...` |
| `Cargo.toml` | `cargo test` |
| `Makefile` with test target | `make test` |

## Scaling Properties

Because the coordinator never reads variable-length content:

- **10-line plan**: coordinator uses ~70 lines of context
- **500-line plan**: coordinator uses ~70 lines of context
- **2 files changed**: coordinator uses ~70 lines of context
- **20 files changed**: coordinator uses ~70 lines of context
- **1 review iteration**: coordinator uses ~70 lines of context
- **3 review iterations**: coordinator uses ~70 lines of context (worker handles retries)

The coordinator's context usage is O(1) relative to project complexity.
