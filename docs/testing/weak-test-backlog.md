# Weak Test Backlog

Source command:

```bash
pnpm run check:test-quality -- --report-all
pnpm run report:test-quality-baseline
```

Machine-readable output is written to `.validate-logs/test-quality-baseline.json`.

## Current Baseline

- Tracked test files checked: 282
- Files with current guardrail violations: 0

## Cleanup Categories

### Missing Test-Intent Header

Current backlog: none reported.

### Weak Assertion-Only Tests

Current backlog: none reported.

### Unit/Property Layer Leaks

Current backlog: none reported.

### GameEngine Usage In Unit/Property Tests

Current backlog: none reported.

### Exact Numeric Assertions In Tunable Runtime Tests

Current backlog: none reported.

### Playwright Presence-Only Tests

Current backlog: none reported.

## Maintenance Rule

`pnpm run check:test-quality` remains changed-file scoped. When nearby behavior changes, strengthen any weak legacy tests discovered in that area instead of broadening the gate or adding blanket allowlists.
