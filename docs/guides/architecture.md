# Architecture Guide

## Overview

Dungeon crawl roguelike — pnpm monorepo, TypeScript, Fastify backend + React frontend.

```
Frontend (React SPA)          → HTTP API →  Fastify Server
  apps/web                                   apps/server
  Zustand store, canvas renderer             Routes, repository, AI service
                                                ↓
                              Presenter Layer (Read Model)
                              packages/presenter
                              buildGameView(state) → GameView
                                                ↓
                              Game Engine (Business Logic)
                              packages/game-core
                              GameEngine.submitCommand(state, cmd) → { state, events }
                                                ↓
                              Contracts & Content (Shared Types + Game Data)
                              packages/game-contracts    packages/content
```

---

## Packages

| Package | Alias | What it does |
|---------|-------|-------------|
| `packages/game-contracts` | `@dungeon/contracts` | Shared types, Zod schemas, command/event discriminated unions |
| `packages/content` | `@dungeon/content` | Game data: enemies, items, biomes, balance tables, fallback AI text |
| `packages/game-core` | `@dungeon/core` | GameEngine, all game systems (pure functions), AI service interface |
| `packages/presenter` | `@dungeon/presenter` | Converts GameState → GameView (CQRS read model) |

## Apps

| App | What it does |
|-----|-------------|
| `apps/server` | Fastify 5 HTTP API (:3000), InMemoryRepository, CompositeAiService |
| `apps/web` | React + Vite SPA (:5173), Zustand store, keyboard/touch controls |

---

## Data Flow

1. **Web** sends `POST /api/games/:id/commands` with a `GameCommand`
2. **Server** loads GameState → `GameEngine.submitCommand()` → returns `{ state, events }`
3. **Server** saves state, runs `buildGameView(state)` (presenter), returns `GameView`
4. **Web** Zustand store updates → React re-renders

---

## Key Design Rules

- **GameState is immutable** — never modified in place, always return new state
- **Presenter is pure** — `buildGameView(state)` has zero side effects; frontend only sees `GameView`
- **AI is optional** — CompositeAiService tries LM Studio (2s timeout), falls back to static content from `@dungeon/content`
- **Commands use SCREAMING_SNAKE_CASE** — `'MOVE'`, `'ATTACK'`, `'USE_ITEM'`, `'USE_ABILITY'`
- **All imports use `.js` extension** — strict ESM, even for `.ts` source files

---

## Game Engine Internals

### Command Processing (`packages/game-core/src/engine/`)

- `game-engine.ts` — `GameEngine.submitCommand(state, cmd, rng)` → `{ state, events }`
- `command-handler.ts` — Routes commands to system handlers (MOVE → movement, ATTACK → combat, etc.)
- `turn-scheduler.ts` — After player acts, enemies take turns (AI pathfinding, attacks, status procs)

### Systems (`packages/game-core/src/systems/`)

Each system is a **stateless pure function**: `(state, params) → { state, events }`

| System | File | Handles |
|--------|------|---------|
| Combat | `combat.ts` | Damage calc, crits, miss, status application |
| Movement | `movement.ts` | Pathfinding, FOV, collision |
| Equipment | `equipment.ts` | Equip/unequip, stat bonuses |
| Inventory | `inventory.ts` | Pickup, drop, consume items |
| Abilities | `abilities.ts` | Ability execution, AP costs, cooldowns |
| Enemy AI | `enemy-ai.ts` | NPC pathfinding, ability selection, retreat |
| Nemesis | `nemesis.ts` | Nemesis creation, tier-locking, special drops |
| Death | `death.ts` | Player death handling, death summary |
| Loot | `loot.ts` | Drop generation, rarity weighting |
| Progression | `progression.ts` | XP → Level, unlocks |
| Status Effects | `status-effects.ts` | Apply/remove/proc status effects |
| Town | `town.ts` | Rest, shop, quests, NPC interaction |

### Generation (`packages/game-core/src/generation/`)

- `map-generator.ts` — Cellular automata → cave systems
- `floor-populator.ts` — Spawn enemies, items, biome-specific content
- `spawn-validator.ts` — Ensures valid spawn placement

### Utilities (`packages/game-core/src/utils/`)

- `rng.ts` — Seeded RNG state
- `grid.ts` — 2D grid math, neighbors, distance
- `pathfinding.ts` — A* implementation
- `dice.ts` — RNG dice rolls

---

## Presenter Layer (`packages/presenter/`)

- `game-view-builder.ts` — Main orchestrator: `buildGameView(state) → GameView`
- `event-formatter.ts` — `formatEvent(event) → FormattedEvent | null`
- `builders/` — Sub-builders for player HUD, inventory, map, town, actions, death summary

The `GameView` type (`game-view.ts`) is what the frontend receives:
```
GameView = {
  player: PlayerHud, run?: RunView, town?: TownView,
  combatLog: FormattedEvent[], inventory: InventoryView,
  actions: AvailableAction[], screen?: ScreenModal
}
```

Presenter code also uses selected public `@dungeon/core/systems/*` helpers for derived stat and quest-text calculations. That dependency is intentional, but tests and other packages should consume it through workspace exports rather than sibling `src/` imports.

---

## Server (`apps/server/`)

- `src/app.ts` — Fastify routes: POST `/api/games/:id/commands`, GET `/api/games/:id`, POST `/api/games`
- `src/in-memory-repository.ts` — Dev/test: games in `Map<id, GameState>`
- `src/sqlite-repository.ts` — Production: SQLite persistence
- `src/ai/ai-service-composite.ts` — Tries LM Studio → falls back to static text

---

## Web Frontend (`apps/web/`)

- `src/store/game-store.ts` — Zustand store: game state, submitCommand(), startGame()
- `src/components/` — Phase-based: StartScreen, TownPhase, DungeonPhase, GameOverPhase
- `src/sprites/canvas-renderer.ts` — Pixel tilemap renderer (DawnLike Atlas 16×16)
- `src/sprites/sprite-map.ts` — Entity → pixel offset mapping
- `src/hooks/` — useKeyboard, useAutoWalk, useBreakpoint
- `src/config/ui-config.ts` — Centralized UI sizing constants

---

## Config Centralization

Two source-of-truth files — never hardcode values elsewhere:

| What | Where |
|------|-------|
| UI sizing (tile size, viewport, panels, breakpoints, touch targets) | `apps/web/src/config/ui-config.ts` |
| Game balance (player stats, combat formulas, economy, thresholds) | `packages/content/src/balance/tables.ts` |

Architectural fitness tests enforce this:
- `apps/web/src/config.test.ts`
- `packages/game-core/src/config.test.ts`

---

## File Quick Reference

| What | Where |
|------|-------|
| GameState type | `packages/game-contracts/src/types/game-state.ts` |
| Commands/Events | `packages/game-contracts/src/commands/index.ts`, `src/events/index.ts` |
| Combat logic | `packages/game-core/src/systems/combat.ts` |
| Enemy data | `packages/content/src/enemies/*.ts` |
| Dungeon generation | `packages/game-core/src/generation/*.ts` |
| Event formatting | `packages/presenter/src/event-formatter.ts` |
| View building | `packages/presenter/src/game-view-builder.ts` |
| Game engine | `packages/game-core/src/engine/game-engine.ts` |
| Server routes | `apps/server/src/app.ts` |
| Zustand store | `apps/web/src/store/game-store.ts` |
| Sprite rendering | `apps/web/src/sprites/canvas-renderer.ts` |
