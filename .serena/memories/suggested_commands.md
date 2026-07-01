---
memory_type: operation
status: active
---

# Suggested Commands

## Summary
Dev, test, build, and validation commands for the pnpm monorepo, plus WSL2/Linux system environment notes.

## Durable Knowledge

### Setup & Dev
- `pnpm install` — install all deps
- `pnpm dev` — Fastify (:3000) + Vite (:5173) concurrently
- `pnpm dev:server` / `pnpm dev:web` — server or web only
- `VITE_ASCII_MODE=true pnpm dev:web` — force ASCII renderer (no sprite PNG)

### Build
- `pnpm build` — build all packages/apps (`pnpm -r run build`)
- `pnpm clean` / `pnpm clean:artifacts` — remove dist/.turbo/tsbuildinfo

### Test (Vitest 3)
- `pnpm test` — fast-fail (quiet, --bail 1, max 2 threads)
- `pnpm test:verbose` — full output; use when diagnosing failures
- `pnpm test:changed` — only changed tests
- `pnpm test:watch` — watch mode
- `pnpm test:balance` — balance simulation suites (`**/*.balance.test.ts`)
- `pnpm vitest run <file>` — single file
- `pnpm vitest run --config tests/vitest.config.ts tests/integration/<x>.integration.test.ts` — root-level tests
- `pnpm test:e2e` / `pnpm test:e2e:ui` — Playwright (auto-starts server+web)
- `pnpm test:docker` — build + runtime-test Docker images

### Lint / Typecheck
- `pnpm lint` — build eslint plugin → cached ESLint → full typecheck
- `pnpm lint:eslint:fix` — auto-fix
- `pnpm lint:types:all` — tsc -b src + tests typecheck
- `pnpm lint:structural` / `pnpm lint:structural:hotspots` — extra structural pass

### Validation Gates (use smallest matching your stage)
- `pnpm run check:fast` — pre-commit gate: tracked-artifacts + audit-guardrails + three-animations + workspace-wiring + cached ESLint + full typecheck
- `pnpm validate:quick` — local confidence: generation + check:fast + ability contracts + changed tests + build
- `pnpm validate` — canonical merge gate (same as CI): generation + guardrails + lint + full tests + build + exports
- `pnpm run ci:verify` — clean-room: clean artifacts → frozen install → build → exports → verbose tests

### Individual Guardrails
- `pnpm run check:tracked-artifacts` — staged/tracked cache/sourcemap files
- `pnpm run check:workspace-wiring` — undeclared deps, src-internal imports, unexported subpaths
- `pnpm run check:ability-contracts` — ability metadata/payload/animation drift
- `pnpm run check:exports` — built-output/consumer-context resolution (needs build first)

### Codegen / Assets
- `pnpm generate:indexes` — regenerate catalog index.ts files (run after adding entities)
- `pnpm parse-atlas` — parse DawnLike sprite atlas

### Balance
- `pnpm balance` / `pnpm balance:lm` — run balance simulations

### Docker
- `pnpm docker:build` / `docker:up` / `docker:down` / `docker:restart`

### WSL2 (Linux) System Notes
Shell is **zsh**. **GNU coreutils** (not BSD) — `find`, `sed`, `grep` behave as GNU Linux variants (no BSD `-E` quirks in sed, etc.). Inline Python (`python3 -c`) is **blocked** by a PreToolUse hook — write a `.py` script file instead. Project uses Serena MCP tools for code navigation; prefer them over raw grep/find.

## Evidence
- Root `package.json` scripts define all commands
- `.github/workflows/test-validation.yml` — canonical CI gate matches `pnpm validate`
- `.githooks/` — pre-commit hook runs `check:fast`
- `.claude/settings.local.json` — documents hook-blocked bash patterns (inline python)
- OS: `uname -r` → `6.6.87.2-microsoft-standard-WSL2` (confirmed Linux, not macOS)

## Relationships
- [[task_completion_checklist]] — when to run each gate
- [[tech_stack]] — runtime versions (Node.js, pnpm)
- [[tools/delegation]] — worker dispatching for delegated runs

## Update Guidance
Update when pnpm scripts are added or renamed, validation gates change, or system environment changes. This is WSL2/Linux — never assume macOS/Darwin/BSD coreutils. The pre-commit hook always runs `check:fast`.
