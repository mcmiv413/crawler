# Suggested Commands

## Setup & Dev
- `pnpm install` — install all deps
- `pnpm dev` — Fastify (:3000) + Vite (:5173) concurrently
- `pnpm dev:server` — server only (tsx watch, auto-reload)
- `pnpm dev:web` — web only (Vite HMR)
- `VITE_ASCII_MODE=true pnpm dev:web` — force ASCII renderer (no sprite PNG)

## Build
- `pnpm build` — build all packages/apps (`pnpm -r run build`)
- `pnpm clean` / `pnpm clean:artifacts` — remove dist/.turbo/tsbuildinfo

## Test (Vitest 3)
- `pnpm test` — fast-fail suites (quiet reporter, `--bail 1`, max 2 threads)
- `pnpm test:verbose` — full output (use to see the failing set)
- `pnpm test:changed` — only changed tests
- `pnpm test:watch` — watch mode
- `pnpm test:balance` — balance simulation suites (`**/*.balance.test.ts`)
- `pnpm vitest run <file>` — single file, e.g.
  `pnpm vitest run packages/game-core/src/systems/combat.test.ts`
- `pnpm vitest run --config tests/vitest.config.ts tests/integration/<x>.integration.test.ts`
  — root-level integration/contract tests use the root config
- `pnpm test:e2e` / `pnpm test:e2e:ui` — Playwright (auto-starts server+web)
- `pnpm test:docker` — build + runtime-test Docker images

## Lint / Typecheck
- `pnpm lint` — build eslint plugin -> cached ESLint -> full typecheck
- `pnpm lint:eslint:fix` — auto-fix
- `pnpm lint:types:all` — `tsc -b` src + tests typecheck
- `pnpm lint:structural` / `pnpm lint:structural:hotspots` — extra structural lint pass

## Validation Gates (use smallest matching your stage)
- `pnpm run check:fast` — pre-commit gate (the installed pre-commit hook runs this):
  tracked-artifacts + audit-guardrails + three-animations + workspace-wiring +
  cached ESLint + full typecheck
- `pnpm validate:quick` — local confidence: generation + check:fast + ability
  contracts + changed tests + build
- `pnpm validate` — **canonical merge gate (same as CI)**: generation + tracked
  artifacts + guardrails + workspace wiring + ability contracts + lint + full
  tests + build + exports
- `pnpm run ci:verify` — clean-room: clean artifacts -> frozen install -> build ->
  check:exports -> verbose tests (catches fresh-checkout issues)

## Individual guardrails
- `pnpm run check:tracked-artifacts` — staged/tracked cache/sourcemap files
- `pnpm run check:workspace-wiring` — undeclared deps, src-internal imports, unexported subpaths
- `pnpm run check:ability-contracts` — ability metadata/payload/animation drift
- `pnpm run check:exports` — built-output/consumer-context resolution (needs build first)

## Codegen / Assets
- `pnpm generate:indexes` — regenerate catalog index.ts files (run after adding entities)
- `pnpm parse-atlas` — parse DawnLike sprite atlas

## Balance
- `pnpm balance` / `pnpm balance:lm` — run balance simulations

## Docker
- `pnpm docker:build` / `docker:up` / `docker:down` / `docker:restart`

## Darwin (macOS) system notes
Shell is zsh. Standard BSD coreutils. `git`, `ls`, `grep`, `find` behave as on
macOS (BSD `find`/`sed` differ slightly from GNU). Project uses Serena MCP tools
for code navigation — prefer them over raw grep/find for code.

See also: [[task_completion_checklist]], [[tech_stack]].
