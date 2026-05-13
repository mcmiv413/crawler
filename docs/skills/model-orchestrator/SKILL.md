---
name: model-orchestrator
description: Choose the delegate/profile and model for Maggy-style orchestration. Use whenever the prompt asks who should handle work, whether to use Cody, Pluto, Goofy, Maggy, or a Task agent, which model tier to pick for a bugfix, refactor, architecture review, repo scan, or tiny deterministic local task, whether cheap local Goofy should replace Maggy or Pluto for planning or routing, what Cody, Pluto, or Goofy mean in the local setup, or whether a shell/local worker is being confused with a Task-tool agent. Trigger even when the user only asks "who should do this", "what model should I use", "should this go to Cody or Pluto", "is Cody the general-purpose agent", "should this go to Goofy", "can Goofy do planning because it's cheaper", or "explain Cody/Pluto/Goofy in my setup."
---

# Model Orchestrator

Choose the worker surface and delegated model for Maggy-style orchestration. This skill is about **delegated work**, not about changing Maggy's own top-level session model.

## Load these references when needed

- Read `references/local-profiles.md` when Cody or Pluto might be involved, or when you need the shell-profile-vs-Agent distinction.
- Read `references/goofy-baseline.md` when Goofy might be involved or when you need its delegation boundaries.
- Read `references/installation.md` when install, sync, rollback, or prompt refresh behavior matters.
- Read `references/eval-playbook.md` when rerunning trigger evals, the benchmark workspace, or the review viewer.

## Core rules

1. Preserve Maggy as the planner/gatekeeper when the work is routing, synthesis, or conflict resolution.
2. Prefer an exact Task-tool specialist before a generic worker.
3. Treat Cody and Pluto as **shell-launched Claude profiles**, not Task-tool agent types.
4. Treat Goofy as a **separate local worker CLI**, not as a Claude profile and not as a Task-tool agent.
5. Prefer the cheapest safe route: Goofy first when it clearly fits, then Haiku paths, and only then Sonnet or Opus escalation.
6. Apply the chosen model or worker explicitly at the delegated layer. Do not rely on defaults when routing is the point of the skill.
7. Escalate from Haiku to Sonnet only when the task is ambiguous, cross-cutting, repeatedly failing, or clearly outside a cheap first pass.
8. If a profile or worker is missing, renamed, or blocked, degrade to the nearest viable path and say so.
9. When the user is already asking a routing question, answer it directly. Do not tell the user to invoke `model-orchestrator`; you are already applying it.

## Routing workflow

1. If the user is already asking for routing guidance, produce the route now instead of redirecting them to the skill.
2. Classify the task: exploration, implementation, planning/review, deterministic-local, specialist-only, or mixed.
3. Decide whether Maggy should keep orchestration locally or hand off to one worker.
4. Choose the worker surface:
   - exact Task-tool specialist when it clearly fits
   - Goofy for narrow local tasks with explicit files and easy verification
   - Cody for implementation-heavy delegated work
   - Pluto for separate planning/review sessions
   - Maggy local when routing itself is the work
5. Choose the delegated model tier explicitly when the worker uses one.
6. Return or execute an actionable route instead of vague advice.

## Routing rubric

| Task shape | Default surface | Model | Why |
| --- | --- | --- | --- |
| Broad read-only search, surface mapping, inventory work | `explore` Task agent | `haiku` | Cheap, fast, structured exploration |
| Straightforward command execution, builds/tests, mechanical triage | `task` Task agent | `haiku` | Command-heavy work does not need premium reasoning |
| Tiny deterministic local work with explicit files and easy verification | Goofy local worker | `local` | Avoids Anthropic quota and is good at narrow, verifiable tasks |
| Implementation, debugging, refactor, TDD, follow-an-existing-plan execution | Cody shell profile or `general-purpose` Task agent | `haiku` first, escalate to `sonnet` only if needed | Start cheap when the work is bounded and explicit |
| Cross-cutting implementation with significant ambiguity or architectural risk | `general-purpose` Task agent, sometimes Cody with a very explicit brief | `sonnet`, escalate to `opus` only when ambiguity dominates | Keep premium reasoning for genuinely hard decisions |
| Architecture, plan authoring, security review, code review, tradeoff analysis | Maggy local first, Pluto shell profile or `code-review` Task agent when depth or independence is required | `haiku` first-pass triage, `opus` when genuinely needed | Keep deep review expensive only when the task actually demands it |
| Multi-worker routing, tie-breaks, or operator-facing orchestration choices | Maggy stays local | `opus` | The routing decision is itself the hard part |

## Surface-selection tie-breaks

- Prefer Cody over a Task agent when the worker should behave like a long-running implementation specialist that follows an existing plan.
- Prefer a Task agent over Cody when the work is bounded, tool-specific, or easier to keep inside Maggy's normal subagent workflow.
- Prefer Goofy over Cody or a Task agent when the task is tightly scoped, explicit, local, and easy to verify afterward; that is the cheapest safe route.
- Prefer Haiku implementation paths first when the work is bounded and explicit; upgrade to Sonnet only after a real escalation trigger.
- Do not send planning, routing, plugin/MCP-dependent work, or ambient-context-sensitive work to Goofy.
- Prefer Pluto only when the operator wants a separate planning/review session. Do not bounce simple planning away from Maggy just because Pluto exists.
- If the user asks for Cody to do planning, correct the mismatch and explain Pluto vs Cody from local artifacts.
- If the user asks for Pluto to implement code, keep Pluto for plan/review and route the coding step to Cody or a Task agent.
- If the user asks Goofy to "figure it out" from repo context, tighten the brief or route elsewhere.

## Profile discovery and drift handling

When Cody or Pluto are relevant:

1. Read `references/local-profiles.md`.
2. If live file access exists, confirm the launcher and settings files before making a strong claim about current behavior.
3. If the live files disagree with the reference, call out the drift and route using the live files as source of truth.
4. If a profile is absent, route to the fallback listed in the reference instead of pretending the profile is available.

When Goofy is relevant:

1. Read `references/goofy-baseline.md`.
2. Keep the brief explicit: file set, task shape, exact output, and verification step.
3. Assume weak literal-format compliance unless you post-validate.
4. If the task needs ambient Claude context, plugin/MCP access, or planning judgment, route away from Goofy.

## Applying the route

### Task-tool workers

- Set the `model` field explicitly on the Task tool call.
- Keep the brief narrow: task, constraints, expected outputs, and save paths.

### Cody / Pluto shell profiles

- Use the wrapper directly and pass `--model` plus `-p` for non-interactive runs.
- Preferred command shapes:
  - `~/.claude/bin/cody -p "<delegation brief>"` for the cheap first pass on Cody's default Haiku lane
  - `~/.claude/bin/cody --model sonnet -p "<delegation brief>"` only after an explicit escalation decision
  - `~/.claude/bin/pluto --model opus -p "<delegation brief>"`
- Keep the top-level Maggy session on its existing model. Only the delegated worker changes.

### Goofy local worker

- Use Goofy only for narrow, explicit, verifiable work.
- Within that safe lane, bias toward Goofy first because local execution is cheaper than remote delegation.
- Preferred command shape:
  - `goofy --permission-mode acceptEdits -p "<tight brief with explicit files, exact output shape, and a verification step>"`
- Report the model as `local` because the routing choice is the local worker itself rather than an Anthropic model tier.

## Output contract

Always return these fields when the user wants a recommendation instead of immediate execution:

- **Surface**: `maggy-local`, `task-agent`, `shell-profile`, or `local-worker`
- **Worker**: exact agent/profile name
- **Model**: `haiku`, `sonnet`, `opus`, or `local`
- **Confidence**: high / medium / low
- **Why**: one concise rationale tied to task shape
- **Apply now**: exact tool choice or shell command
- **Fallback**: what to do if the primary route is unavailable

If the user asked you to execute the routing, think through the same contract first and then perform the chosen action.

## Examples

**Example 1:**

Input: "Who should handle this medium-sized bugfix? I already have a plan."

Output:
- Surface: `shell-profile`
- Worker: `cody`
- Model: `haiku`
- Why: implementation work with an existing plan should try the cheapest viable coding lane first
- Apply now: `~/.claude/bin/cody -p "<brief>"`

**Example 2:**

Input: "I need a deep architecture review of this rollout."

Output:
- Surface: `maggy-local` / `shell-profile`
- Worker: `maggy` first, `pluto` only if deeper independent review is needed
- Model: `haiku` first, `opus` on escalation
- Why: start cheap, escalate only if the review truly needs stronger independent reasoning

**Example 3:**

Input: "Scan the repo and tell me which modules look relevant."

Output:
- Surface: `task-agent`
- Worker: `explore`
- Model: `haiku`
- Why: broad read-only exploration is cheap and parallelizable

**Example 4:**

Input: "This is a tiny one-file local fix with an explicit check script. Should I give it to Goofy?"

Output:
- Surface: `local-worker`
- Worker: `goofy`
- Model: `local`
- Why: narrow, deterministic, and easy to verify afterward
- Apply now: `goofy --permission-mode acceptEdits -p "<explicit file + fix + verification brief>"`

**Example 5:**

Input: "Should I send planning and routing work to Goofy since it runs locally and avoids Anthropic limits?"

Output:
- Surface: `maggy-local` / `shell-profile`
- Worker: `maggy` for routing, `pluto` for separate planning sessions
- Model: `opus`
- Why: Goofy is cheaper, but planning and routing are outside its safe lane
- Apply now: keep routing in the current Maggy session, or use `~/.claude/bin/pluto --model opus -p "<plan brief>"`

## Failure modes to avoid

- Do not call Cody or Pluto Task-agent types.
- Do not call Goofy a Claude profile or a Task-agent type.
- Do not recommend changing Maggy's own top-level model in the first pass.
- Do not answer a routing question by telling the user to go use `model-orchestrator`; return the actual route.
- Do not stop at "use sonnet" without also naming the worker surface.
- Do not pick a worker without saying how the route will actually be applied.
- Do not send planning/routing or ambient-context-heavy work to Goofy.
