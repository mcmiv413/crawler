# Maintaining Documentation

This project uses a **3-tier progressive disclosure** system. Each tier loads different amounts of context.

## The 3 Tiers

| Tier | File(s) | When loaded | What belongs here |
|------|---------|-------------|------------------|
| **1. Agent entrypoints** | `AGENTS.md`, `CLAUDE.md` | Every session | Commands, architecture skeleton, behavioral rules, pointers to guides |
| **2. Reference guides** | `docs/guides/*.md` | On-demand | How-to procedures, detailed explanations, code examples |
| **3. Project memory** | `.Codex/memory/*.md`, `.claude/memory/*.md` | Session start (index) | Lightweight what/how/where pointers organized by domain and tooling |

## When to Update What

### Add to agent entrypoints when:
- New validation commands or dev workflows
- New behavioral guardrails (scope rules, anti-patterns that cost sessions)
- Architecture changes (new packages, changed data flow)
- New gotchas that affect many tasks

### Add to docs/guides/ when:
- How-to procedures for specific tasks
- Detailed explanations with code examples
- New content types (a new "adding-X" guide)
- Design system updates

### Add project memory when:
- Recording domain knowledge (architecture, testing patterns, content guidelines)
- Documenting tool workflows and gotchas
- Creating quick-reference pointers to guides
- No duplicated content — always point to the doc, not quote it

## Rules

1. **Agent entrypoints stay concise.** If they grow too large, move detail to a guide and replace with a pointer.
2. **No code examples in agent entrypoints.** Put them in guides. Agent entrypoints only have command tables and brief descriptions.
3. **Guides are self-contained.** Each guide should be useful without reading an agent entrypoint first.
4. **Memories don't duplicate.** They point to docs, never repeat content from them.
5. **Delete stale docs.** Session artifacts, one-off reports, and resolved bug docs don't belong in the repo.

## Guide Template

When creating a new guide:

```markdown
# How to [Do the Thing]

## Overview
One paragraph explaining what this guide covers.

## Files to Touch
| Step | File | What to do |
...

## Step-by-step
...

## What Happens Automatically
...

## Key Types / Files Reference
...
```

## Current Guide Index

See [docs/README.md](README.md) for the full index.
