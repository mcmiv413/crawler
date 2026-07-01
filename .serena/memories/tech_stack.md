---
memory_type: reference
status: active
---

# Tech Stack

## Summary
TypeScript 5.7 strict ESM monorepo managed with pnpm. Backend: Fastify 5 + optional SQLite. Frontend: React 18 + Vite + Zustand + canvas tilemap renderer. Testing: Vitest 3 + Playwright. Custom ESLint plugin enforces domain conventions.

## Durable Knowledge

### Core
- **Language:** TypeScript ^5.7 (strict mode), ESM throughout (`"type": "module"`)
- **Runtime:** Node.js >=18 (CI/dev use Node 20 types)
- **Package manager:** pnpm >=9 (pinned `pnpm@10.32.1`), pnpm workspaces monorepo
- **Build:** TypeScript project references (`tsc -b`), per-package `dist/`

### Backend (`apps/server`)
- **Fastify 5** HTTP API (default :3000)
- **better-sqlite3** for optional durable persistence (`DUNGEON_DB_PATH`); in-memory `Map` repository by default
- Composite AI service: LM Studio (HTTP, optional via `LM_HOST`/`LM_PORT`) + static fallback
- Vercel serverless entrypoint at `api/index.ts`

### Frontend (`apps/web`)
- **React 18 + Vite** SPA (dev :5173)
- **Zustand** state store
- Canvas tilemap renderer using the DawnLike Atlas (16x16 sprites); falls back to ASCII when PNG absent or `VITE_ASCII_MODE=true`
- Keyboard + touch controls

### Validation / Tooling
- **Zod** — runtime schema validation for all API/command/event shapes (contracts)
- **ESLint 9** (flat config `eslint.config.mjs`) + `typescript-eslint` + custom workspace plugin `eslint-plugin-dungeon` + react/react-hooks/vitest plugins
- **Vitest 3** — unit, property (`fast-check` / `@fast-check/vitest`), integration, contract, and balance tests; coverage via `@vitest/coverage-v8`
- **Playwright** — E2E (`tests/e2e/`)
- **tsx** — running TS scripts directly
- Docker: `Dockerfile.server`, `Dockerfile.web`, `docker-compose.yml`
- Codecov configured (`codecov.yml`)

### TS compiler settings (`tsconfig.base.json`)
target ES2022, module ESNext, moduleResolution bundler, `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`, `composite`. `exactOptionalPropertyTypes` is false.

### Workspace aliases
`@dungeon/contracts`, `@dungeon/core`, `@dungeon/content`, `@dungeon/presenter` (with selected subpath exports). See `tsconfig.base.json` paths.

## Evidence
- `tsconfig.base.json` — compiler settings and workspace path aliases
- `eslint.config.mjs` — ESLint flat config
- `vitest.config.ts` — test configuration
- `vitest.base.ts` — shared vitest base config
- `playwright.config.ts` — E2E configuration
- `docker-compose.yml`, `Dockerfile.server`, `Dockerfile.web`
- `codecov.yml`
- `package.json` (root) — pnpm version pin and workspace scripts

## Relationships
- `codebase_structure` — directory layout of all packages and apps using this stack
- `code_conventions` — conventions enforced on top of this stack (ESM imports, strict mode, etc.)

## Update Guidance
Update when major dependency versions change (Fastify, React, Vitest, TypeScript), when new tooling is added, or when the pnpm version pin changes.
