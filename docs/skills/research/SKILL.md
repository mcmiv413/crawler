---
name: research
description: Discover repo-native and external patterns before planning by searching the local codebase first, then GitHub and Context7 as needed, and grade every finding by evidence confidence.
---

# Research

Use this skill when the user wants evidence about existing patterns before planning or implementation.

## Confidence tiers

Every finding must carry one of these tiers:

| Tier | Meaning | Required support |
| --- | --- | --- |
| **Confirmed** | Directly observed in code, docs, configuration, or authoritative library docs | file path, URL, or doc citation |
| **Deduced** | Reasonable conclusion from confirmed evidence | explicit reasoning tied to confirmed sources |
| **Hypothesized** | Plausible but unconfirmed | a concrete "verification needed" step |

Do not present a Hypothesized finding as established fact.

## Workflow

1. Clarify the research question and the decision it should inform.
2. Search the local repo first using semantic/code tools before falling back to broad text search.
3. If prior work matters, search session history or linked GitHub issues/PRs.
4. When local patterns are insufficient, search GitHub for neighboring repos or examples.
5. When library/framework behavior matters, query Context7 for authoritative external docs.
6. Group findings by source and confidence.
7. End with a planning handoff:
   - patterns to reuse
   - conflicts or open questions
   - verification steps for anything still Hypothesized

## Source priority

Prefer sources in this order:

1. this repo's current code and docs
2. prior work in this repo or its linked issues/PRs
3. GitHub code/examples in adjacent repos
4. Context7 or other external library docs

If a stronger external pattern conflicts with current repo practice, call that out explicitly instead of quietly preferring one.

## Output contract

For each finding include:

- source
- confidence tier
- citation
- short note on why it matters

Then end with:

- **Recommended reuse**
- **Questions for planning**
- **Verification needed**

## Guardrails

- Research is read-only: no code changes.
- Stay scoped to the user's actual decision.
- Prefer fewer high-signal findings over an exhaustive dump.
