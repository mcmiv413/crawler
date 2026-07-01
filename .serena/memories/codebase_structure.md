---
memory_type: reference
status: active
---

# Codebase Structure

## Summary
pnpm monorepo with two layers: shared logic packages and client/server apps. Five core packages, two apps, root-level test suites, CI config, and supporting scripts.

## Durable Knowledge

### Packages (shared logic)
| Package | Alias | Purpose |
|---------|-------|---------|
| `packages/game-contracts` | `@dungeon/contracts` | Shared types, Zod schemas, command/event discriminated unions, service interfaces. Subdirs: `commands/`, `events/`, `interfaces/`, `schemas/`, `types/` |
| `packages/content` | `@dungeon/content` | Static game data: `abilities/`, `archetypes/`, `biomes/`, `enemies/`, `enchantments/`, `factions/`, `items/`, `quests/`, `statuses/`, `ring-spells/`, `ring-schools/`, `sprites/`, `balance/`, `fallback-text/`, `ambient-profiles/`, `objects/`, `animation-refs/` |
| `packages/game-core` | `@dungeon/core` | `GameEngine`, all game systems, generation, AI service interface. Subdirs: `engine/`, `systems/`, `generation/`, `abilities/`, `ai/`, `state/`, `utils/`, `validation/`, `testing/` |
| `packages/presenter` | `@dungeon/presenter` | Builds `GameView` read-models from `GameState` (CQRS read side). `builders/`, `targeting/`, `event-formatter.ts`, `game-view-builder.ts` |
| `packages/eslint-plugin-dungeon` | — | Custom ESLint rules (built before linting) |

### Apps
| App | Purpose |
|-----|---------|
| `apps/server` | Fastify API. Key files: `app.ts`, `dev-server.ts`, `in-memory-repository.ts`, `sqlite-repository.ts`, `ai/`, `routes/`, `services/`, `game-command/`. Vercel handler in `api/index.ts` |
| `apps/web` | React+Vite SPA. Key dirs: `store/` (Zustand), `components/`, `hooks/`, `rendering/`, `sprites/`, `animations/`, `animation-runtime/`, `api/`, `config/`, `testing/` |

### Game Engine internals (`packages/game-core/src/engine/`)
- `game-engine.ts` — `GameEngine.submitCommand(state, cmd, rng)` -> `{ state, events }`
- `command-handler.ts` — routes commands to system handlers; `handlers/` subdir
- `turn-scheduler.ts` — enemy turns after player acts
- `action-pipeline.ts`, `quest-evaluator.ts`, `run-consequence-orchestrator.ts`, `floor-transition-service.ts`, `event-history.ts`

### Systems (`packages/game-core/src/systems/`)
Each system is a stateless pure function `(state, params) -> { state, events }`. Approximately 40 systems: combat, damage, movement, equipment, inventory, abilities, enemy-ai, enemy-ai-engine, death, loot, progression, status-effects, town, factions, quests, mana, magic-xp, fov, weapon-mastery, world-consequences, world-modifiers, burn-spread, retreat, npc, threat/threat-rating, traps, hazards, enemy-respawn, ambient-behavior-engine, etc.

### Generation (`packages/game-core/src/generation/`)
Map generator (cellular automata caves), floor populator, spawn validator.

### Root config / supporting
- `tsconfig.base.json` (shared), per-package `tsconfig.json`
- `eslint.config.mjs`, `vitest.config.ts` / `vitest.base.ts` / `vitest.setup.ts`, `playwright.config.ts`, `vite-helpers.ts`
- `scripts/` — guardrails (`check-*.mjs`/`.ts`), `generate-indexes.ts`, `balance/`, `generators/`, `reporters/` (incl. `vitest-quiet.js`)
- `.github/workflows/test-validation.yml` — CI pipeline
- `.githooks/` (pre-push, prepare-commit-msg); pre-commit installed via `prepare` script

### Key file quick reference
- GameState type: `packages/game-contracts/src/types/game-state.ts`
- Commands/Events: `packages/game-contracts/src/commands/`, `packages/game-contracts/src/events/`
- Combat: `packages/game-core/src/systems/combat.ts`
- View building: `packages/presenter/src/game-view-builder.ts`
- Server routes: `apps/server/src/app.ts`
- Zustand store: `apps/web/src/store/game-store.ts`

## Evidence
- `packages/game-contracts/src/types/game-state.ts`
- `packages/game-core/src/engine/game-engine.ts`
- `packages/presenter/src/game-view-builder.ts`
- `apps/server/src/app.ts`
- `apps/web/src/store/game-store.ts`
- `tsconfig.base.json`
- `.github/workflows/test-validation.yml`

## Relationships
- `architecture_and_patterns` — describes how these packages interact at the design level
- `code_conventions` — naming and organization rules that apply across these directories
- `tech_stack` — language and tooling choices that underpin this layout

## Update Guidance
Update when packages are added or removed, when major directories are reorganized, or when new significant source files are created. Keep the key file quick reference current.
