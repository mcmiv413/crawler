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
| `pnpm lint` | TypeScript type check across monorepo (tsc --noEmit) |
| `pnpm test` | Run all unit tests + property tests + E2E tests (Vitest + Playwright) |
| `pnpm test:watch` | Vitest watch mode — re-run tests on file changes |
| `pnpm test:e2e` | Run Playwright E2E tests (automatically starts server+web) |
| `pnpm test:docker` | Build and test Docker images (builds, starts containers, verifies health) |
| `pnpm test -- <file>` | Run a single test file, e.g., `pnpm test -- packages/game-core/src/systems/combat.test.ts` |
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
# All tests (unit + property + E2E)
pnpm test

# Watch mode (fast iteration during development)
pnpm test:watch

# E2E tests only (auto-starts server+web)
pnpm test:e2e

# Single test file
pnpm test -- packages/game-core/src/systems/combat.test.ts

# Test a specific pattern
pnpm test -- --grep "combat"

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

### Current Test Status

- ✓ **596+ unit & property tests** — all passing
- ✓ **14 E2E scenarios** — all passing (full game-loop coverage)
- ✓ **TypeScript lint** — 0 errors
- ✓ **Build** — clean, no warnings

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

The web client uses **Kenney Tiny Dungeon** (CC0, 16×16 tileset) for the canvas renderer (`DungeonCanvas`).

### One-Time Setup

1. Download from [kenney.nl/assets/tiny-dungeon](https://kenney.nl/assets/tiny-dungeon) (free, CC0)
2. Copy `Tilemap/tilemap_packed.png` to `apps/web/public/sprites/kenney-tiny-dungeon.png`

Without the PNG, the renderer falls back to ASCII characters on a dark background. To force ASCII mode:

```bash
VITE_ASCII_MODE=true pnpm dev:web
```

Sprite positions are defined in `apps/web/src/sprites/sprite-map.ts`. Grid formula: tile at column `c`, row `r` (0-indexed, 16px each) → `{ x: c*16, y: r*16, w: 16, h: 16 }`.

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
4. Run `pnpm lint` and `pnpm test` before committing
5. Ensure E2E tests pass: `pnpm test:e2e`

### Pre-Push Verification

Before pushing to a branch, run:

```bash
pnpm run ci:verify
```

This command:
- Cleans all build artifacts (`dist/`, `node_modules/.vite`, etc.)
- Performs a fresh install (`pnpm install --frozen-lockfile`)
- Rebuilds all packages from scratch
- Validates package exports (ordering + runtime resolution)
- Runs the full test suite

This mirrors the exact CI environment, catching package contract issues and environment-parity problems that local development can mask.

**Why?** Local machines accumulate state (old `dist/` files, cached symlinks) that CI doesn't have on a fresh checkout. Running `ci:verify` before push catches "works on my machine" failures early.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details on the monorepo structure and export validation.

---

## License

This project is provided as-is for educational and personal use.
