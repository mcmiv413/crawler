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
- Treat `HUMANNOTE`, `TODO`, `FIXME`, and `XXX` comments as leads, not proof. Confirm or reject each with source-level evidence.
- If one instance of a bug pattern is confirmed, search for sibling patterns before calling it isolated.
- For guardrails, prove both sides: the valid command passes and a known-bad example fails.
- For keyed collections, prove write keys and read keys match. Entity-id vs position-key drift is a finding.

---

## TOOLING PROTOCOL

- **Serena is the default proof surface.** Use Serena for repository navigation, symbol lookup, references, and pattern search. If a claim depends on repo code, verify it with Serena-backed reads/searches instead of raw grep output.
- **Fossil CLI is for lead generation, not final evidence.** Run Fossil from the CLI, prefer JSON output, and treat dead-code / clone / scaffolding hits as leads that must be verified in source before they become findings.
- **External semantics need explicit sources.** When a finding depends on Vitest, ESLint, Fastify, or other tool/framework behavior, confirm it with the relevant CLI or authoritative docs/web lookup. Distinguish repo facts from external contract facts.
- **Keep one-off artifacts out of `docs/`.** Store raw audit outputs in session artifacts or ignored files. Commit only durable protocol updates and confirmed bug logs.
- **Log confirmed bugs before fix work.** When the audit proves a real bug, add a `docs/bugs/BUG-*.md` entry before proposing implementation changes.
- **Use the audit helper as topology triage, not final proof.** `pnpm exec tsx scripts/audit-tests.ts` should surface `unit`, `property`, `contract`, `integration`, `balance`, and `e2e`; if a documented layer is missing or collapsed, that mismatch is itself a finding.
- **Humannotes are structured leads.** Search for `HUMANNOTE`, `TODO`, `FIXME`, and `XXX`; classify each as `confirmed`, `stale/resolved`, or `INSUFFICIENT EVIDENCE`. For confirmed notes, search nearby code and sibling packages for the same pattern.
- **Runner truth beats audit metadata.** If an audit script says a test is included, verify that the configured runner actually lists or executes it. A mismatch between classification and runner behavior is a finding.
- **Guardrails need negative controls.** `pnpm run check:audit-guardrails` is the merge-blocking home for deterministic topology, mocked-subject, optional import, reference-literal, docs-path, and centralized-literal checks. When adding a guardrail, include a known-bad fixture and the command that proves it fails.

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
- Test-layer metadata matches actual runner behavior

Flag:
- unreachable test suites
- brittle assertions
- config leakage into tests
- tests that encode unsafe behavior as the expected result
- Playwright/E2E specs collected or reported as Vitest coverage

You MUST run at least one runner-truth check when auditing test topology:
- list tests through the configured runner
- directly execute one representative file from each documented test layer
- compare audit-helper classification against the runner result

---

### 4. SOURCE OF TRUTH

Trace:
- balance/config → usage
- content registry → runtime behavior
- content id → presenter/UI usage
- generated index → importing package

Find:
- duplicated values
- embedded constants
- drift between docs and code
- drift between content metadata and runtime definitions
- hardcoded gameplay or presentation meaning outside the declared source of truth
- generated indexes that omit or duplicate source files

You MUST check for dual registries when a concept appears in more than one package:
- abilities
- statuses
- items/equipment
- sprites
- animation/effect metadata
- balance tables

If two packages define the same concept, require either:
- a single canonical source and generated consumers
- or a contract test proving parity

---

### 5. DATA SHAPES AND STATE BOUNDARIES

Audit:
- `Map` and object key conventions
- repository save/load boundaries
- serialization/deserialization paths
- presenter projections from `GameState`

Find:
- writes keyed by position but reads keyed by entity id
- state objects returned by reference from repositories
- tests that rely on mutation leakage
- presenter assumptions that are not enforced by contracts
- serialization paths that silently change runtime shape

You MUST trace at least one high-risk collection from writer to reader. For each confirmed bug, add a focused test that fails on the key mismatch or boundary leak.

---

### 6. GUARDRAIL ENFORCEMENT

Audit:
- eslint config
- custom plugin
- CI scripts
- audit scripts
- package exports checks
- test-layer advisors

Find:
- rules not enforced as errors
- checks not wired into CI
- gaps between "intended" vs "actual" enforcement
- documented hard test rules that still pass as warnings (for example, numeric literal `.toBe(...)` assertions in guarded test scopes)
- guardrails that only report warnings for mandatory policy
- guardrails that pass despite a checked-in known-bad example

You MUST include a negative-control check for at least one mandatory rule. Examples:
- a unit/property test importing live `@dungeon/content`
- a Playwright spec being treated as a Vitest test
- a forbidden exact-value assertion in a guarded test scope

---

### 7. PRESENTATION POLICY LEAKS

Audit:
- presenter animation builders
- web canvas/rendering code
- UI hooks that interpret domain ids
- config modules that are supposed to own sizing or presentation constants

Find:
- hardcoded status ids in components
- animation durations, scales, radii, or timing logic scattered across presenter/web
- gameplay meaning embedded in renderer code
- `Date.now()` or wall-clock logic mixed into deterministic state/event generation

Presentation-only wall-clock logic is acceptable only when it stays outside game state and is covered by UI/presenter tests.

---

### 8. AI SAFETY

Evaluate:
- Is the code predictable for AI edits?
- Are patterns consistent?
- Are there guardrails preventing unsafe changes?
- Would a future AI agent know the single source of truth?
- Would a future AI agent know which tests actually protect a change?

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

### 7. BUG LOGS AND PLAN HANDOFF

For every confirmed bug:
- create or update `docs/bugs/BUG-*.md`
- include evidence files and observed behavior
- explain why existing tests or guardrails missed it
- name the smallest test that should fail before the fix

For the remediation plan:
- group findings by shared cause, not just by package
- keep workstreams vertically testable
- separate quick runtime fixes from larger source-of-truth refactors
- explicitly list final validation commands

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
- Classifies humannotes as confirmed, stale/resolved, or insufficient evidence
- Proves test topology with runner behavior, not only audit metadata
- Logs confirmed bugs before fix work
- Produces a remediation handoff grouped by root cause

---

## Related Guides

- [Architecture](./architecture.md)
- [Testing](./testing.md)
- [Adding a Game Mechanic](./adding-mechanic.md)
- [Maintaining Docs](../MAINTAINING-DOCS.md)
