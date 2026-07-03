---
name: pr-review-loop
description: Resolve all open PR review comments by looping: fetch unresolved threads → delegate fixes to subagents → push → reply/resolve via gh → request re-review → wait → repeat until clean. Works with any GitHub PR URL or PR number.
---

# PR Review Loop

Use this skill when the user provides a GitHub PR URL or PR number and wants all open review comments addressed automatically. Everything from code fixes to comment replies is delegated to subagents — this skill orchestrates the loop, not the implementation.

## Input

Accept any of:
- A full GitHub PR URL: `https://github.com/OWNER/REPO/pull/NUMBER`
- A short `OWNER/REPO#NUMBER` reference
- A bare PR number (uses the current repo's remote `origin`)

Parse owner, repo, and number from whichever form is given.

## Prerequisites

Check once at the start, stop with a clear message if any fail:

1. `gh auth status` — `gh` CLI must be authenticated. If not: `gh auth login`.
2. Current branch matches the PR's head branch (`gh pr view NUMBER --json headRefName`). If not, switch or warn.
3. Working tree is clean (`git status --short`). If dirty, stash or abort.

If `gh` is unavailable, fall back to `curl` with a token from `git credential fill`:
```bash
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')
```

## Loop

Run this sequence until the termination condition is met. Track the iteration count; stop and report after 10 iterations to prevent runaway loops.

### Step 1 — Fetch unresolved threads

```bash
gh api graphql -f query='
  query($owner:String!,$repo:String!,$number:Int!){
    repository(owner:$owner,name:$repo){
      pullRequest(number:$number){
        reviewThreads(first:50){
          nodes{
            id
            isResolved
            comments(first:5){
              nodes{ author{login} path startLine line body }
            }
          }
        }
      }
    }
  }' \
  -F owner=OWNER -F repo=REPO -F number=NUMBER \
  --jq '.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved == false))'
```

If the result is an empty array `[]`, jump to **Termination**.

### Step 2 — Group and brief subagents

Group unresolved threads by file path. For each distinct file (or logical cluster of related comments), spawn one `general-purpose` subagent with a self-contained brief that includes:

- The file path and the full body of every unresolved comment touching that file
- Line numbers and authors
- The explicit task: make the minimal code change that satisfies each comment
- The constraint: run `pnpm run check:fast` (or the repo's pre-commit gate) and confirm it passes before returning
- The output contract: summarize what was changed and confirm the gate passed

Run subagents for independent files **in parallel**. Do not spawn more than 5 subagents at once; batch if there are more.

Wait for all subagents in the current batch to return before proceeding.

### Step 3 — Validate locally

After all subagents return, run the repo's fast gate yourself:

```bash
pnpm run check:fast
```

If it fails: spawn a `everything-claude-code:build-error-resolver` subagent with the error output. Do not proceed to push until the gate is green.

### Step 4 — Commit and push

Stage only files changed by the subagents (list them explicitly — do not `git add .`):

```bash
git add <changed-file-1> <changed-file-2> ...
git commit -m "fix: address PR review comments (batch N)"
git push
```

### Step 5 — Reply and resolve each thread

For each thread that was addressed in this iteration, post a reply then resolve it:

**Reply:**
```bash
gh api graphql -f query='
  mutation($tid:ID!,$body:String!){
    addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$tid,body:$body}){
      comment{ id }
    }
  }' \
  -F tid=THREAD_ID \
  -F body="Addressed in <commit SHA>: <one-sentence summary of the change>"
```

**Resolve:**
```bash
gh api graphql -f query='
  mutation($tid:ID!){
    resolveReviewThread(input:{threadId:$tid}){
      thread{ isResolved }
    }
  }' \
  -F tid=THREAD_ID
```

Only resolve threads whose comments were actually addressed. Leave threads for comments that subagents explicitly flagged as skipped or requiring human judgment.

### Step 6 — Request re-review

After all threads are replied to and resolved, request a fresh review from whoever last reviewed (or Copilot if that was the reviewer):

```bash
# For Copilot re-review:
gh api repos/OWNER/REPO/pulls/NUMBER/requested_reviewers \
  -X POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'

# For a human reviewer (use their GitHub login):
gh pr request-review NUMBER --reviewer LOGIN
```

### Step 7 — Wait for the review

Poll every 60 seconds for a new completed review:

```bash
gh api repos/OWNER/REPO/pulls/NUMBER/reviews \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED" or .state == "APPROVED")] | last'
```

Wait up to 10 minutes. If no review arrives, proceed to the next loop iteration anyway (the next fetch in Step 1 will show whether new threads were opened).

### Termination

Stop the loop when:
- Step 1 returns zero unresolved threads AND the most recent review state is `APPROVED`, OR
- Step 1 returns zero unresolved threads AND no new review has arrived within the wait window

Report a summary: iterations run, threads resolved, files changed, final review state.

## Subagent brief template

When spawning a subagent for a file, use this structure:

```
You are fixing code review comments on a pull request.

PR: OWNER/REPO#NUMBER
File: path/to/file.ts
Branch: BRANCH_NAME (already checked out)

Unresolved review comments on this file:
---
[Thread 1 — line N, author: LOGIN]
COMMENT_BODY
---
[Thread 2 — line N, author: LOGIN]
COMMENT_BODY
---

Task:
1. Read the file and understand what each comment is asking.
2. Make the minimal change that satisfies each comment. Do not refactor unrelated code.
3. Run `pnpm run check:fast` and confirm it passes.
4. Report: what you changed for each comment (one sentence each), and whether the gate passed.

Do not commit or push — only edit files.
```

## Guardrails

- Never resolve a thread without posting a reply first.
- Never push a commit when the fast gate is failing.
- If a subagent returns saying a comment requires human judgment (e.g., architectural disagreement, ambiguous requirement), skip that thread, note it in the final report, and do not mark it resolved.
- If the same thread keeps reappearing after fixes (reviewer keeps re-opening), after 2 iterations flag it to the user and stop the loop.
- Cap the outer loop at 10 iterations regardless.

## Output at each iteration

After each full iteration report:
- Iteration N of max 10
- Threads found / threads addressed / threads skipped
- Files changed
- Gate status
- Push SHA
- Threads resolved
- Re-review requested: yes/no
- Next action: waiting for review / looping immediately / terminated

## Final report

When the loop ends:

| Field | Value |
|-------|-------|
| Iterations | N |
| Threads resolved | N |
| Threads skipped | N (list) |
| Final review state | APPROVED / CHANGES_REQUESTED / PENDING |
| PR status | link |
