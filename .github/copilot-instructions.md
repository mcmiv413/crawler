# Copilot instructions for this repository

## Testing workflow

1. Start with the smallest affected scope: `pnpm vitest run path/to/file.test.ts` or `pnpm test:changed`.
2. If `pnpm test` or `pnpm validate` fails, rerun the failing scope with full output before diagnosing: use `pnpm test:verbose`, targeted `pnpm vitest run ...`, and `.validate-logs/test.log`. Do not debug from quiet output alone.
3. Decide whether the failure is a product regression or test brittleness. Fix the test when it relies on live balance or content values, exact tuned numbers, or implementation details instead of required behavior.
4. Use the correct layer:
   - unit and property tests use builders or local fixtures plus seeded RNG
   - contract tests validate IDs and cross-references against live content
   - integration, balance, and E2E tests cover player-visible behavior
5. For player-visible behavior, verify the full chain: `state -> event -> presenter -> UI`, not just internal state changes.
6. Only finish on `pnpm validate`. Targeted green tests are evidence, not completion.

## Repo-specific testing rules

- Keep `pnpm test` as the fast-fail path; use `pnpm test:verbose` for full diagnostics.
- Unit and property tests should not import live config when builders or local fixtures are sufficient.
- Prefer comparative, range-based, or invariant assertions over exact values for tunable balance behavior.
- Use `SeededRng` instead of `Math.random()` in tests.
- When a feature references content IDs, add contract coverage in `tests/contracts/`.

See `docs/guides/testing.md` for deeper examples and layer guidance.
