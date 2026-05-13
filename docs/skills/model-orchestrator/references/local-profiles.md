# Local Profile Ontology

Use this reference when Maggy needs to reason about Cody, Pluto, or the difference between shell profiles and Task-tool specialists.

## Live discovery procedure

When live file access is available, confirm the current setup in this order:

1. `~/.claude/bin/cody`
2. `~/.claude/bin/pluto`
3. `~/.claude/profiles/cody-settings.json`
4. `~/.claude/profiles/pluto-settings.json`
5. `~/.claude/profiles/cody-prompt.md`
6. `~/.claude/profiles/pluto-prompt.md`
7. `~/.claude/bin/maggy`
8. `~/.claude/profiles/maggy-settings.json`

Treat this file as the pinned snapshot. If the live files disagree, trust the live files and call out the drift.

## Current local snapshot

| Profile | Launcher | Default model | Permission mode | Primary role | Important boundaries |
| --- | --- | --- | --- | --- | --- |
| Cody | `~/.claude/bin/cody` | `haiku` in settings, but caller can override with `--model` | `acceptEdits` | Implementation worker | Follows existing plans, should not create/rewrite plans, can edit code |
| Pluto | `~/.claude/bin/pluto` | `opus` in settings, but caller can override with `--model` | `plan` | Planning / architecture / review worker | Does not write production code |
| Maggy | `~/.claude/bin/maggy` | `haiku` | `plan` by default | Orchestration / gating / synthesis | Top-level session model stays fixed for this skill's first pass |

## Shell profile vs Task-tool specialist

- **Shell profiles** (`cody`, `pluto`) are separate Claude sessions launched through Bash wrappers. They have their own prompts, settings, permission modes, hooks, and can run non-interactively with `-p`.
- **Task-tool specialists** (`explore`, `task`, `general-purpose`, `code-review`) are built-in subagent surfaces selected through the Task tool and configured with a Task `model` field.
- **Goofy** is neither of those. It is a separate local worker CLI and should be treated as its own constrained worker surface.
- Do not describe Cody or Pluto as Agent-tool types. "Use Cody as the `general-purpose` agent" is incorrect.

## Role mapping

- **Cody**: use for implementation-heavy delegated work, especially when a plan already exists and an accept-edits worker should execute it.
- **Pluto**: use for separate planning, review, architectural thinking, risk analysis, and code review sessions.
- **Maggy**: keep local when the routing decision itself is the hard part, or when multiple workers need coordination.

## Fallbacks

- If **Cody** is unavailable: route implementation work to the `general-purpose` Task agent on `sonnet`.
- If **Pluto** is unavailable: keep planning/review in Maggy or use the `code-review` / `general-purpose` Task agent on `opus`.
- If a profile exists but its prompt/settings drift materially from this snapshot: explain the drift, then route using the live files as source of truth.
