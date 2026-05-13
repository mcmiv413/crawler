# Goofy Baseline

Use this reference when deciding whether a task can be delegated to Goofy.

## What Goofy is

Goofy is a **local worker CLI**, not a Claude profile and not a Task-tool agent. In the current local setup, it runs in a stripped-down local mode and is not subject to Anthropic API limits in the same way Maggy/Cody/Pluto are.

The important consequence is that Goofy does **not** bring ambient Claude context with it. Do not assume automatic CLAUDE.md loading, plugin/MCP availability, hooks, or repo-specific guidance unless the brief provides what it needs.

## Baseline results

| Eval | Result | Meaning |
| --- | --- | --- |
| Exact literal reply | Fail | Literal/case-perfect compliance is weak |
| Exact JSON | Pass | Structured output can be good when the target shape is explicit |
| Read local file | Pass | Can handle narrow file reads |
| Simple tool use | Pass | Can execute small deterministic tool tasks |
| Simple one-file bugfix | Pass | Viable for tiny explicit fixes with verification |
| Repo read/reason task | Pass | Can answer small repo questions when told to inspect files directly |

## Safe to delegate

- Small read-only repo questions
- Deterministic tool tasks
- Structured-output tasks with clear schemas
- Simple single-file fixes with an explicit verification step

## Safe with constraints

- Repo-specific work only when the brief names the files, rules, and success criteria
- Format-sensitive or case-sensitive tasks only when Maggy post-validates the result

## Do not delegate

- Planning, routing, or architecture decisions
- Plugin/MCP-dependent work
- Tasks that rely on ambient repo instructions or hidden context
- Brittle automations that require exact sentinel text with no validation

## Practical routing rule

Delegate to Goofy only when all of these are true:

1. The scope is tight.
2. The inputs are explicit.
3. Success is easy to verify.
4. Failure is cheap to catch.

If all four are true, **prefer Goofy first** because local execution is cheaper than remote Claude work.

If any of those are false, prefer Cody, Pluto, Maggy, or a Task-tool agent.
