# Critical Mutation Config Baseline

## Scope

`pnpm test:mutation:critical` validates the `stryker.config.mjs` baseline for the high-risk seams without running Stryker by default:

- command handling
- save snapshot export/load
- event formatting
- GameView building and presenter builders
- ability runtime and effects

## Initial Baseline

Status: report-only configuration baseline.

Stryker is configured with thresholds `high: 80`, `low: 60`, and `break: 50`, but the repo does not yet declare Stryker packages in `package.json` or the lockfile. The local command validates the target list and thresholds now; after adding `@stryker-mutator/core` and the Vitest runner intentionally, run:

```bash
MUTATION_EXECUTE=true pnpm test:mutation:critical
```

Record the first executed mutation score here before making the workflow blocking. Mutation failures should drive stronger tests for required behavior, not production changes made only to satisfy a mutant.
