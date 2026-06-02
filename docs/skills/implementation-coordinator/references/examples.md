# Implementation Coordinator Examples

Examples showing how the skill routes implementation work.

## Example 1: Clear one-file fix -> Goofy

**User:** `/implementation-coordinator`

**Execution:**
1. Detects branch `PSRE-349/fix-empty-label`, loads `.plans/plan-PSRE-349.md`.
2. Effort assessment:
   - Plan names one component and one focused test.
   - Required behavior is explicit.
   - Verification is a single targeted test.
   - `EFFORT: low`, `WORKER: goofy`.
3. Goofy implements from the plan path and returns structured success.
4. Review confirms the mechanical change.
5. Summary presents changed files and final test status.

**Outcome:** Fast local execution for a narrow, easy-to-verify task.

---

## Example 2: Standard multi-file feature -> Cody

**User:** `/implementation-coordinator .plans/plan-API-782.md`

**Execution:**
1. Loads explicit plan file for a new REST endpoint with validation.
2. Effort assessment:
   - Plan outlines route, service, schema, and tests.
   - Existing patterns are available, but several files must coordinate.
   - `EFFORT: medium`, `WORKER: cody`.
3. Cody implements the feature and tests.
4. Cody reviews against the plan and fixes quality issues.
5. Summary presents review iterations and validation status.

**Outcome:** Cody handles the normal implementation-worker path.

---

## Example 3: Security-sensitive change -> Codex

**User:** `/implementation-coordinator`

**Execution:**
1. Loads plan from branch `SEC-450/jwt-validation-hardening`.
2. Effort assessment:
   - Change is modest in size but touches authentication.
   - Security-sensitive auto-escalation fires.
   - `EFFORT: high`, `WORKER: codex`.
3. Codex implements with high-risk validation in mind.
4. Codex reviews for plan adherence and security-sensitive edge cases.
5. Summary explains that high effort was selected due to security impact.

**Outcome:** High-risk work routes to Codex regardless of LOC.

---

## Example 4: Ambiguous architecture -> Codex

**User:** `/implementation-coordinator`

**Execution:**
1. Loads plan from branch `ARCH-100/refactor-state-management`.
2. Effort assessment:
   - Plan requires interpretation and architectural judgment.
   - Existing patterns do not fully answer the design.
   - `EFFORT: high`, `WORKER: codex`.
3. Codex implements, keeping changes inside the approved plan.
4. Codex reviews for unacceptable deviations and test coverage.
5. Summary reports the reasoning and remaining risks.

**Outcome:** Ambiguity routes to Codex even when the file count is moderate.

---

## Example 5: Large but mechanical -> Cody

**User:** `/implementation-coordinator`

**Execution:**
1. Loads plan from branch `DATA-200/migrate-api-models`.
2. Effort assessment:
   - Many files change, but exact field mappings are specified.
   - Pattern repeats mechanically across the codebase.
   - `EFFORT: medium`, `WORKER: cody`.
3. Cody performs the repeated transformation.
4. Cody reviews all changed surfaces against the mapping.
5. Summary shows the broad diff and validation status.

**Outcome:** Volume alone does not force Codex when the work is clear and repetitive.

---

## Example 6: Force Codex

**User:** `/implementation-coordinator --force-worker codex`

**Execution:**
1. Assessment would normally choose Cody.
2. User override selects Codex.
3. Codex implements and reviews.
4. Summary records that `--force-worker codex` overrode the assessment.

**Outcome:** User can explicitly choose the high-effort route.

---

## Example 7: Review finds blocking issues

**User:** `/implementation-coordinator`

**Execution:**
1. Assessment selects Cody for a medium feature.
2. Cody implements.
3. Cody review finds unacceptable deviations:
   - Added feature not in plan.
   - Changed data structure without justification.
   - Refactored unrelated module.
4. Review worker reverts deviations, fixes tests, and returns clean status.
5. Summary reports two review iterations.

**Outcome:** Plan enforcement catches scope creep before completion.

---

## Example 8: Worker upgrade before manual intervention

**User:** `/implementation-coordinator`

**Execution:**
1. Assessment selects Cody.
2. Cody implements.
3. Review finds a deviation and attempts fixes.
4. Cody review still fails after the allowed iterations.
5. Coordinator upgrades to Codex and reruns review with the compact failure summary.
6. If Codex fixes the issue, summary reports `cody -> codex`.
7. If Codex still fails, coordinator stops and reports the structured error line.

**Outcome:** The coordinator tries the stronger worker before asking for manual intervention, without inspecting files itself.

---

## Example 9: Split recommendation accepted

**User:** `/implementation-coordinator`

**Execution:**
1. Loads plan from branch `ARCH-100/migrate-auth-system`.
2. Effort assessment:
   - 10+ files, multiple phases, security-sensitive behavior.
   - `EFFORT: high`, `WORKER: codex`.
3. Skill prompts:
   ```
   This implementation is high effort. Options:

   1. Proceed with Codex
   2. Split into phases
   3. Manual implementation with step-by-step human oversight

   Recommendation: Split for better control and incremental testing.

   Your choice? (1/2/3)
   ```
4. User selects "2".
5. Skill gives phase boundaries and waits for confirmation.

**Outcome:** Large high-risk work can be split before implementation.

---

## Example 10: Force Goofy on medium work

**User:** `/implementation-coordinator --force-worker goofy`

**Execution:**
1. Assessment suggests Cody for a moderate feature.
2. User forces Goofy.
3. Because the override lowers the worker, coordinator warns before proceeding.
4. Goofy attempts the task, but summary/review must verify carefully.

**Outcome:** Lower-worker overrides are allowed but should be treated as higher risk.

---

## Routing Summary

| Example | Worker Used | Effort | Success | Notes |
| --- | --- | --- | --- | --- |
| 1. Clear fix | Goofy | Low | Yes | Best for narrow, explicit local work |
| 2. Standard feature | Cody | Medium | Yes | Default implementation-worker route |
| 3. Security | Codex | High | Yes | Required escalation |
| 4. Ambiguous | Codex | High | Yes | Justified by interpretation |
| 5. Large mechanical | Cody | Medium | Yes | Clarity matters more than LOC |
| 6. Force Codex | Codex | Override | Yes | User preference |
| 7. Scope creep | Cody | Medium | Yes | Review caught deviations |
| 8. Upgrade | Cody -> Codex | Medium -> High | Maybe | Escalates before manual intervention |
| 9. Split | Codex or split | High | Yes | Avoided risky single-shot work |
| 10. Force Goofy | Goofy | Override | Risky | Requires careful verification |

**Key insights:**
- Goofy is for low-effort work with explicit inputs and easy proof.
- Cody is the default for medium implementation work.
- Codex is for high-effort, ambiguous, or high-risk work.
- Failed lower-worker attempts upgrade through `goofy -> cody -> codex`.
- Lower-worker overrides increase verification burden.
