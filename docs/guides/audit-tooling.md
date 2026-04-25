# Audit Tooling Guide

## Overview

Use different tools for different kinds of audit evidence:

- **Serena** proves repository truth: symbols, references, file-local logic, and targeted pattern search.
- **Fossil CLI** generates leads: dead code, scaffolding, and clone candidates that must be verified before they become findings.
- **Authoritative docs/web lookup** resolves external tool or framework semantics when no usable standalone CLI exists.

## Serena CLI

**Path:** `/home/michael/.local/bin/serena`

**Resolve locally:** `command -v serena`

**Repo-specific role**

- Use Serena-backed symbol and pattern tools as the default replacement for raw grep when auditing code.
- Prefer Serena for:
  - symbol lookup
  - reference tracing
  - targeted code-pattern searches
  - reading the exact source that backs a finding

**Audit workflow**

1. Identify the likely file or subsystem.
2. Use Serena symbol or pattern search to find the relevant code.
3. Read only the symbols or file ranges needed to prove the claim.
4. Treat the Serena-backed source read as the primary repo evidence in the final finding.

## Fossil CLI

**Path:** `/home/michael/.local/bin/fossil-mcp`

**Resolve locally:** `command -v fossil-mcp`

**Repo-specific role**

- Use Fossil to generate high-signal leads before manual verification.
- Do **not** treat Fossil output as final proof; verify every promoted finding in source.

**Core commands**

```bash
fossil-mcp scan --format json .
fossil-mcp scaffolding --include-todos --language typescript --format json .
fossil-mcp dead-code --language typescript --min-confidence medium --format json .
fossil-mcp clones --language typescript --min-lines 6 --format json .
```

**Audit workflow**

1. Run Fossil with JSON output.
2. Bucket findings into runtime bugs, guardrail drift, dead surfaces, and low-value noise.
3. Re-check each promising lead with Serena before writing it up.

## External semantics fallback

Some audit claims depend on external contracts rather than repo code, such as Vitest discovery rules or ESLint behavior.

- If a reliable standalone CLI exists, prefer that.
- If not, use authoritative docs/web lookup.
- Keep repo facts and external-contract facts separate in the final write-up.
