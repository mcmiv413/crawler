---
memory_type: operation
status: active
---

# Task Completion Checklist

## Summary
Ordered gate sequence for completing coding tasks in this repo. Run gates in order: fast feedback during iteration, `validate:quick` before review, `validate` before merge (matches CI). Never report success based on a partial subset of steps.

## Durable Knowledge

### While iterating (fast feedback)
1. If you added/edited a catalog entity (enemy, item, ability, biome, faction, quest, status, ring, etc.): run `pnpm generate:indexes` — never hand-edit generated indexes.
2. `pnpm run check:fast` — tracked artifacts + audit guardrails + animation coverage + workspace wiring + cached ESLint + full typecheck. This is exactly what the installed pre-commit hook runs.

### Before review
3. `pnpm validate:quick` — generation + check:fast + ability contracts + changed tests + build.

### Before merge (canonical gate, same as CI)
4. `pnpm validate` — generation + tracked artifacts + audit guardrails + workspace wiring + ability contracts + lint + full Vitest suites + build + check:exports.

### Before push (optional clean-room)
5. `pnpm run ci:verify` — clean artifacts, frozen install, build, check:exports, verbose tests. Catches "works on my machine" fresh-checkout failures.

### Special cases
- Changed browser flows: also run `pnpm test:e2e` (Playwright).
- Changed balance/tuning: run `pnpm test:balance` (balance suites are OUTSIDE the default gate).
- Changed Docker setup: run `pnpm test:docker`.
- Edited a shared repo skill: edit the source in `docs/skills/`, then run `pnpm skills:generate` and verify with `pnpm skills:check`.

### Testing expectations
- Tests are colocated with source: `foo.ts` -> `foo.test.ts`; property tests `foo.property.test.ts` (fast-check); integration `*.integration.test.ts`; contract `*.contract.test.ts`; e2e in `tests/e2e/`.
- Target 80%+ coverage. TDD encouraged (write failing test first).
- Respect custom test lint rules: no numeric `.toBe`, no unsafe contract casts, no executing mocked subjects — see `code_conventions`.

### Security / commit hygiene
- No hardcoded secrets. Stage files by name, not `git add -A`.
- `.env`, `*.db`, `*.sqlite`, binary sprite PNGs are gitignored — do not commit them.
- Do not commit cache/sourcemap/Zone.Identifier artifacts (check:tracked-artifacts guards this).

## Evidence
- `CLAUDE.md` — lists all validation commands and their composition
- `.github/workflows/test-validation.yml` — CI pipeline running `pnpm validate`
- `.githooks/pre-commit` — runs `pnpm run check:fast` on every commit
- `scripts/check-tracked-artifacts.mjs` — tracked-artifact guardrail
- `scripts/check-workspace-wiring.mjs` — workspace wiring guardrail

## Relationships
- `code_conventions` — the conventions these gates enforce
- `architecture_and_patterns` — guardrails referenced in check:fast

## Update Guidance
Update when a new validation gate is added, when the gate composition changes, or when special-case test commands are added (e.g., a new test suite type).
