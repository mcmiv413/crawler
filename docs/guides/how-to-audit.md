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
