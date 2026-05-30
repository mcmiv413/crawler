# dungeon-rpg

A browser-based, turn-based dungeon crawler with persistent world consequences, powered by a local LLM (LM Studio) for narrative enrichment and NPC dialogue.

## Quick Start

### Prerequisites
- **Node.js** 18 or higher
- **pnpm** 9 or higher

### Get Running in 3 Steps

```bash
# 1. Install dependencies
pnpm install

# Optional: enable LM Studio-driven dialogue/summaries
# cp .env.example .env
# export $(grep -v '^#' .env | xargs)

# 2. Start dev servers (Fastify :3000, Vite :5173 concurrently)
pnpm dev

# 3. Open your browser and play
# → http://localhost:5173
```

The game is **fully playable without LM Studio**. To enable LM Studio locally, set `LM_HOST` (and optionally `LM_PORT`, default `1234`) in your shell before starting the server. If those variables are unset or unreachable, the game falls back to static content after a 2-second timeout.

---

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start dev servers: Fastify server (:3000) + Vite web (:5173) concurrently |
| `pnpm dev:server` | Server only — tsx watch mode, auto-reload on changes |
| `pnpm dev:web` | Web only — Vite dev server with hot module reload |
| `pnpm build` | Build all packages and apps for production |
| `pnpm lint` | Run ESLint plus TypeScript checks across the monorepo |
| `pnpm test` | Run the Vitest suites (unit, property, contract, integration, and balance) with the fast-fail reporter |
| `pnpm test:verbose` | Run the full Vitest suite with standard output |
| `pnpm test:watch` | Vitest watch mode — re-run tests on file changes |
| `pnpm test:e2e` | Run Playwright E2E tests (automatically starts server+web) |
| `pnpm validate` | Run the repository validation gate: tracked-artifact checks -> audit guardrails -> lint -> test -> build |
| `pnpm skills:generate` | Rebuild `.github/skills/`, `.claude/skills/`, and `.agents/skills/` from `docs/skills/` |
| `pnpm skills:check` | Verify the generated skill mirrors still match `docs/skills/` |
| `pnpm test:docker` | Build and test Docker images (builds, starts containers, verifies health) |
| `pnpm vitest run <file>` | Run a single Vitest file, e.g., `pnpm vitest run packages/game-core/src/systems/combat.test.ts` |
| `docker-compose up` | Production mode: server :3000, web :8080 (uses prebuilt Docker images) |

---

## Project Structure

This is a **pnpm monorepo** organized into two layers:

### Packages (Shared Logic)

| Package | Alias | Purpose |
|---------|-------|---------|
| `packages/game-contracts` | `@dungeon/contracts` | Shared types, Zod validation schemas, command/event unions, service interfaces |
| `packages/content` | `@dungeon/content` | Enemy archetypes, weapons, armor, consumables, biome definitions, balance tables, fallback AI text |
| `packages/game-core` | `@dungeon/core` | `GameEngine`, all game systems (combat, movement, inventory, loot, etc.), AI service interface |
| `packages/presenter` | `@dungeon/presenter` | Builds `GameView` read-models (safe copies) from `GameState` |

### Apps (Client & Server)

| App | Purpose |
|-----|---------|
| `apps/server` | Fastify 5 HTTP API, in-memory game state repository, composite AI service (LM Studio + fallback) |
| `apps/web` | React + Vite single-page app, Zustand state store, keyboard controls, DungeonView canvas renderer |

### Data Flow

```
1. Web sends POST /api/games/:id/commands with a GameCommand
   ↓
2. Server loads GameState → GameEngine.submitCommand() → returns { state, events }
   ↓
3. Server saves updated state, runs presenter.buildGameView(state)
   ↓
4. Server returns GameView to client
   ↓
5. Zustand store updates React components
```

### Key Design Principles

- **GameState is immutable** — the authoritative source of truth, never modified in-place
- **Presenter is pure** — frontend only sees `GameView`, never raw `GameState`
- **AI is optional** — `CompositeAiService` tries LM Studio (2s timeout), falls back to static content; game always works offline
- **Commands use SCREAMING_SNAKE_CASE** discriminants (`'MOVE'`, `'EQUIP'`, `'USE_ITEM'`)
- **All imports use `.js` extension** — strict ESM throughout, even for `.ts` source files

---

## Testing

### Test Organization

- **Unit tests** are colocated with source: `foo.ts` → `foo.test.ts`
- **Property tests** use fast-check: `foo.property.test.ts`
- **E2E tests** live in `tests/e2e/` and use Playwright
- **Test target**: 80%+ coverage

### Running Tests

```bash
# Fast-fail Vitest suites
pnpm test

# Full Vitest output when you need the failing set
pnpm test:verbose

# Watch mode (fast iteration during development)
pnpm test:watch

# Playwright E2E only (auto-starts server+web)
pnpm test:e2e

# Single test file
pnpm vitest run packages/game-core/src/systems/combat.test.ts

# Root tests/ single file (uses the root Vitest config)
pnpm vitest run --config tests/vitest.config.ts tests/integration/package-exports.integration.test.ts

# Final validation gate before merge
pnpm validate

# Docker build & runtime tests
pnpm test:docker
```

### Docker Testing

The `pnpm test:docker` command:
1. Builds both server and web Docker images
2. Starts containers and verifies they're healthy
3. Tests API endpoints
4. Verifies the web app loads
5. Cleans up containers

This ensures the Docker build works and the containerized app is fully functional before deployment.

### Validation Gate

Use `pnpm validate` as the merge gate. It runs audit guardrails, linting, the Vitest suites, and the production builds in the same order CI uses.

The repo intentionally keeps its deterministic smoke checks split by responsibility instead of folding them into one opaque meta-validator:

- `pnpm run check:tracked-artifacts` catches staged or already tracked cache files, Zone.Identifier files, and source-map noise that `.gitignore` alone cannot stop.
- `pnpm run check:workspace-wiring` catches undeclared workspace dependencies, `src`-internal imports, and unexported subpaths.
- `pnpm run check:ability-contracts` catches live ability metadata, payload, and animation drift with invariant checks.
- `pnpm run check:exports` catches built-output and consumer-context package resolution failures that source-only tests can miss.

---

## Game Overview

### How to Play

**Goal**: Defeat the floor boss at dungeon floor ≥5 and return to town alive.

**Town Phase**:
- Explore the town, talk to NPCs, manage your inventory
- Buy/sell equipment and consumables at the shop
- Upgrade your skills and abilities
- Plan your dungeon run

**Dungeon Phase**:
- Clear floors one at a time (turn-based exploration)
- Fight enemies with action points and abilities
- Collect loot and equipment
- Use consumables (potions, food) when needed

**Combat**:
- Turn-based: you act, then all enemies act
- Use auto-attacks or activate abilities (Power Strike, Second Wind, etc.)
- Manage status effects (burn, poison, slow, shock)
- Equip weapons and armor to boost stats

**Progression**:
- Unlock weapon masteries through use
- Find enchanted items that boost stats or abilities
- Named nemesis enemies grow stronger as you face them
- World state (prosperity, corruption, fear) affects NPC behavior

**Permadeath**:
- Losing all health triggers game over
- Taking overkill damage (>50% of max HP) is permanent — you can't come back
- Clear completed floors stay cleared in the world

### Featured Systems

- ✓ Persistent world state (nemeses, floor cache, faction disposition)
- ✓ Dual-weapon swapping
- ✓ Equipment enchantments (quick_draw, lifesteal, resistance boosts)
- ✓ 5 enemy ability types with cooldown management
- ✓ 4 status effect types with element resistance
- ✓ Dynamic NPC dialogue (LM Studio + static fallback)
- ✓ Procedural dungeon generation per biome

---

## Sprite Assets

The web client uses the **DawnLike Atlas** (16x16 sprites) for the canvas renderer.

### One-Time Setup

1. Place the atlas image at `apps/web/public/sprites/dawnlike.png`
2. Keep the filename stable so `apps/web/src/sprites/sprite-registry.ts` can load it in both dev and production

Without the PNG, the renderer falls back to ASCII characters on a dark background. To force ASCII mode:

```bash
VITE_ASCII_MODE=true pnpm dev:web
```

Named atlas lookups live in `packages/content/src/sprites/dawnlike-name-map.ts`, and keyed tile/entity sprite rectangles live in `packages/content/src/sprites/dawnlike-sprite-map.ts`.

**Note**: Binary assets are gitignored — do not commit the PNG.

---

## Deployment

### Runtime Modes

The application supports three runtime modes, selected by entrypoint and environment:

| Mode | Server Entrypoint | Web Build | Persistence | AI |
|------|-------------------|-----------|-------------|-----|
| **Local dev** | `tsx watch src/dev-server.ts` | Vite dev server (proxy to :3000) | In-memory | LM Studio (optional) |
| **Docker** | `node dist/dev-server.js` | nginx (proxy to server:3000) | In-memory or SQLite | LM Studio (optional) |
| **Vercel (hosted)** | Serverless function (`api/index.ts`) | Static SPA | In-memory (non-durable) | Fallback-only (unless LM_HOST configured) |

### Environment Variables

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `PORT` | Server | `3000` | HTTP listen port (local/Docker only) |
| `HOST` | Server | `0.0.0.0` | Bind address (local/Docker only) |
| `DUNGEON_DB_PATH` | Server | (unset) | Path to SQLite database file. If unset, uses in-memory storage (non-durable). |
| `LM_HOST` | Server | (unset) | LM Studio host. If unset, AI uses static fallback content only. |
| `LM_PORT` | Server | `1234` | LM Studio port |
| `VITE_API_BASE_URL` | Web | `/api` | Full API base URL for hosted deployments (e.g., `https://your-server.vercel.app/api`) |
| `VITE_ASCII_MODE` | Web | (unset) | Set to `true` to force ASCII renderer |

### Persistence Modes

- **In-memory** (default): Game state lives in server memory. Restarting the server loses all games. Suitable for development, demos, and stateless hosted deployments.
- **SQLite**: Set `DUNGEON_DB_PATH=/path/to/dungeon.db` for durable storage. Required for any deployment where game state should survive restarts.

The server logs which mode is active at startup.

### AI Runtime Modes

- **LM Studio + fallback**: When `LM_HOST` is set, the server attempts LM Studio for NPC dialogue, rumors, and run summaries with a 2-second timeout. On failure, static fallback content is used.
- **Fallback-only**: When `LM_HOST` is unset, static content from `@dungeon/content` is used for all AI features. The game is fully playable without LM Studio.

The server logs which AI mode is active at startup.

### Deploying to Vercel

The app deploys as **two separate Vercel projects**: one for the web client, one for the server API.

#### Web (apps/web)

1. Create a new Vercel project
2. Set **Root Directory** to `apps/web`
3. Framework preset: **Vite**
4. Add environment variable: `VITE_API_BASE_URL` = your deployed server URL + `/api` (e.g., `https://dungeon-server.vercel.app/api`)
5. Deploy

#### Server (apps/server)

1. Create a new Vercel project
2. Set **Root Directory** to `apps/server`
3. Framework preset: **Other**
4. The serverless handler at `api/index.ts` handles all API routes
5. Add environment variables as needed:
   - `LM_HOST` / `LM_PORT` (optional, for AI features)
   - `DUNGEON_DB_PATH` (optional, for SQLite persistence)
6. Deploy

> **Note**: The first hosted version uses in-memory persistence by default. Game state will not survive between serverless function cold starts. This is demo-grade; configure SQLite with durable storage for production use.

### Docker (unchanged)

Local Docker deployment continues to work exactly as before:

```bash
docker-compose up         # server on :3000, web on :8080
docker-compose up --build # rebuild and start
```

---

## Contributing

When adding new features or tests:

1. Keep code modular: systems in `packages/game-core/src/systems/`, content in `packages/content/src/`
2. Write tests colocated with source files
3. Use Zod schemas for all API shapes (contracts)
4. Use the repo gate that matches your stage: `pnpm run check:fast` while iterating, `pnpm validate:quick` before review, `pnpm validate` before merge
5. Ensure E2E tests pass with `pnpm test:e2e` when browser flows change
6. Edit shared repo skills in `docs/skills/`, not in the generated `.github/skills/`, `.claude/skills/`, or `.agents/skills/` mirrors

### Repo Skills

Shared repo skills now use a single canonical source in `docs/skills/`.

- Rebuild runtime mirrors with `pnpm skills:generate`
- Check for drift with `pnpm skills:check`
- See [docs/guides/repo-skills.md](docs/guides/repo-skills.md) for the PSRE capability map and maintenance workflow

### Validation Gates

Use the smallest repo gate that matches what you are doing:

```bash
pnpm run check:fast   # pre-commit: tracked artifacts + audit + workspace wiring + cached ESLint + full typecheck
pnpm validate:quick   # local confidence: generation + check:fast + ability contracts + changed tests + build
pnpm validate         # canonical merge gate: generation + tracked artifacts + guardrails + lint + full tests + build + exports
```

The installed pre-commit hook runs `pnpm run check:fast`.

`pnpm validate` is the canonical repository gate and the same command CI enforces. It runs tracked-artifact checks, audit guardrails, workspace wiring, ability contract checks, lint, the default workspace Vitest suites, the build, and package export validation.

`check:exports` intentionally stays out of pre-commit because it depends on built artifacts and consumer-context package resolution.

Balance suites (`tests/balance/**/*.balance.test.ts` and `packages/game-core/src/**/*.balance.test.ts`) stay outside the default gate. Run `pnpm test:balance` when you are changing tuning or balance simulations.

### Clean-Room Pre-Push Verification

If you want the same checks from a fresh install before pushing, run:

```bash
pnpm run ci:verify
```

This command:
- Cleans all build artifacts (`dist/`, `node_modules/.vite`, etc.)
- Performs a fresh install (`pnpm install --frozen-lockfile`)
- Primes workspace `dist/` exports with `pnpm build`
- Validates package exports in the clean-room build
- Runs the full verbose Vitest suite

This catches fresh-checkout export/runtime issues that `pnpm validate` can miss when your local workspace already has built artifacts.

**Why?** Local machines accumulate state (old `dist/` files, cached symlinks) that CI doesn't have on a fresh checkout. Running `ci:verify` before push catches "works on my machine" failures early.

See [docs/guides/architecture.md](docs/guides/architecture.md) for monorepo structure and [docs/guides/testing.md](docs/guides/testing.md) for export-validation guardrails.

---

## License

This project is provided as-is for educational and personal use.
