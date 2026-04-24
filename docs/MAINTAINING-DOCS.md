# Maintaining Documentation

This project uses a **3-tier progressive disclosure** system. Each tier loads different amounts of context.

## The 3 Tiers

| Tier | File(s) | When loaded | What belongs here |
|------|---------|-------------|------------------|
| **1. CLAUDE.md** | `CLAUDE.md` | Every session | Commands, architecture skeleton, behavioral rules, pointers to guides |
| **2. Reference guides** | `docs/guides/*.md` | On-demand | How-to procedures, detailed explanations, code examples |
| **3. Serena memories** | Serena memory system | Serena sessions only | Lightweight what/how/where pointers to guides |

## When to Update What

### Add to CLAUDE.md when:
- New validation commands or dev workflows
- New behavioral guardrails (scope rules, anti-patterns that cost sessions)
- Architecture changes (new packages, changed data flow)
- New gotchas that affect many tasks

### Add to docs/guides/ when:
- How-to procedures for specific tasks
- Detailed explanations with code examples
- New content types (a new "adding-X" guide)
- Design system updates

### Add a Serena memory when:
- Summarizing a guide for quick lookup (what/how/where only)
- No duplicated content — always point to the doc

## Rules

1. **CLAUDE.md stays under 200 lines.** If it grows past that, move detail to a guide and replace with a pointer.
2. **No code examples in CLAUDE.md.** Put them in guides. CLAUDE.md only has command tables and brief descriptions.
3. **Guides are self-contained.** Each guide should be useful without reading CLAUDE.md first.
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
