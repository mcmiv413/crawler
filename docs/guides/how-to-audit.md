# CODEBASE AUDIT PROTOCOL (AI EXECUTION MODE)

## OBJECTIVE

Perform a **hostile, evidence-based audit** of the codebase.

Assume the codebase is flawed. Your job is to **prove where and how**.

Do NOT summarize. Do NOT praise. Only surface issues that matter.

---

## HARD RULES

- Every claim MUST include file-level evidence
- If evidence is missing, state: "INSUFFICIENT EVIDENCE"
- Do NOT infer architecture without verification
- Do NOT assume tests run — prove it
- Prefer contradictions over observations
- If docs and code disagree → this is a finding
- If a guardrail exists but is unenforced → this is a finding
- Do NOT treat lead-generation tool output as proof until source-level verification is complete

---

## TOOLING PROTOCOL

- **Serena is the default proof surface.** Use Serena for repository navigation, symbol lookup, references, and pattern search. If a claim depends on repo code, verify it with Serena-backed reads/searches instead of raw grep output.
- **Fossil CLI is for lead generation, not final evidence.** Run Fossil from the CLI, prefer JSON output, and treat dead-code / clone / scaffolding hits as leads that must be verified in source before they become findings.
- **External semantics need explicit sources.** When a finding depends on Vitest, ESLint, Fastify, or other tool/framework behavior, confirm it with the relevant CLI or authoritative docs/web lookup. Distinguish repo facts from external contract facts.
- **Keep one-off artifacts out of `docs/`.** Store raw audit outputs in session artifacts or ignored files. Commit only durable protocol updates and confirmed bug logs.
- **Log confirmed bugs before fix work.** When the audit proves a real bug, add a `docs/bugs/BUG-*.md` entry before proposing implementation changes.

## CLI PATHS

- **Serena CLI:** `/home/michael/.local/bin/serena`
- **Fossil CLI:** `/home/michael/.local/bin/fossil-mcp`
- **Resolve paths safely on the current machine:** `command -v serena` and `command -v fossil-mcp`
- **External semantics fallback:** there is no stable `context7-mcp` binary in `PATH` here, so use authoritative docs/web lookup unless that changes

## TOOL GUIDES

- [Serena audit workflow](./audit-tooling.md#serena-cli)
- [Fossil CLI audit workflow](./audit-tooling.md#fossil-cli)
- [External semantics fallback](./audit-tooling.md#external-semantics-fallback)

---

## AUDIT DIMENSIONS

### 1. ARCHITECTURE
Prove or disprove:
- Clear boundaries between packages
- No circular dependencies
- No hidden coupling

You MUST:
- Identify at least one real dependency chain
- OR explicitly state none found

---

### 2. EXECUTION PATHS (HIGH RISK)

Audit:
- apps/server/src/app.ts
- game-engine
- turn scheduler
- presenter

Find:
- mutation of immutable data
- mixed responsibilities
- non-determinism (Date.now, Math.random, etc.)

---

### 3. TEST VALIDITY (NOT COVERAGE)

You MUST prove:
- Tests are actually executed (via config)
- Tests validate behavior (not config/constants)

Flag:
- unreachable test suites
- brittle assertions
- config leakage into tests

---

### 4. SOURCE OF TRUTH

Trace:
- balance/config → usage

Find:
- duplicated values
- embedded constants
- drift between docs and code

---

### 5. GUARDRAIL ENFORCEMENT

Audit:
- eslint config
- custom plugin
- CI scripts

Find:
- rules not enforced as errors
- checks not wired into CI
- gaps between "intended" vs "actual" enforcement

---

### 6. AI SAFETY

Evaluate:
- Is the code predictable for AI edits?
- Are patterns consistent?
- Are there guardrails preventing unsafe changes?

---

## REQUIRED OUTPUT

### 1. CRITICAL ISSUES (High Risk Only)
Each must include:
- Problem
- Evidence (file + behavior)
- Why it matters
- Concrete fix

---

### 2. STRUCTURAL WEAKNESSES

---

### 3. TESTING GAPS

---

### 4. QUICK WINS

---

### 5. STRATEGIC RECOMMENDATIONS

---

### 6. SCORECARD (1–10 with justification)

- Architecture
- Code Quality
- Testing
- Config Integrity
- Guardrails
- AI Compatibility

---

## FAILURE CONDITIONS

If you cannot:
- find real issues
- or produce file-level evidence

You MUST return:

"Audit failed due to insufficient context or inaccessible code paths"

---

## SUCCESS CRITERIA

A successful audit:
- Identifies contradictions
- Surfaces non-obvious risks
- Produces actionable fixes
- Avoids generic statements

---

## Related Guides

- [Architecture](./architecture.md)
- [Testing](./testing.md)
- [Adding a Game Mechanic](./adding-mechanic.md)
- [Maintaining Docs](../MAINTAINING-DOCS.md)
