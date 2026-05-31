# Architecture & Design Patterns

## Layered data flow (CQRS-ish)
```
apps/web (React SPA, Zustand)  --HTTP-->  apps/server (Fastify)
                                              | repository (in-memory or SQLite)
                                              v
                          packages/presenter  buildGameView(state) -> GameView  (read model)
                                              v
                          packages/game-core  GameEngine.submitCommand(state, cmd, rng) -> { state, events }
                                              v
                          packages/game-contracts (types/Zod) + packages/content (static data)
```

## Request lifecycle
1. Web POSTs `/api/games/:id/commands` with a `GameCommand`.
2. Server loads `GameState` -> `GameEngine.submitCommand()` -> `{ state, events }`.
3. Server saves new state, runs `buildGameView(state)`, returns `GameView`.
4. Zustand store updates -> React re-renders. Frontend only ever sees `GameView`,
   never raw `GameState`.

## Key design rules
- **GameState is immutable** — authoritative source of truth, never mutated in place.
- **Content is static** — `packages/content` declares catalog facts only;
  `game-core` and `server` own runtime decisions.
- **Entities live in source files** — one file per entity; run `pnpm generate:indexes`;
  never hand-edit generated `index.ts`. Generated coverage: enemies, biomes, objects,
  archetypes, ambient profiles, enchantments, statuses, factions, quests, item
  subcategories, ability metadata, ring spells, ring schools.
- **Presenter is pure** — `buildGameView` has zero side effects.
- **Systems are pure functions** — `(state, params) -> { state, events }`, stateless.
- **AI is optional** — `CompositeAiService` tries LM Studio (2s timeout), falls back
  to static `@dungeon/content` text; game always works offline.
- **Commands use SCREAMING_SNAKE_CASE** discriminated unions.
- **Strict ESM** — all relative imports use `.js` extension even in `.ts` files.

## Repository pattern
Server abstracts persistence behind a repository interface: `InMemoryRepository`
(`Map<id, GameState>`, default) and `SqliteRepository` (durable, via
`DUNGEON_DB_PATH`). Server logs which mode + which AI mode at startup.

## Presenter <-> core dependency
Presenter uses selected public `@dungeon/core/systems/*` helpers for derived stats
and quest text. Intentional, but always via workspace exports, never sibling src/.

## Custom guardrails (deterministic, kept separate by responsibility)
- `check:tracked-artifacts` — cache/sourcemap/Zone.Identifier files that .gitignore can't fully stop
- `check:workspace-wiring` — undeclared workspace deps, src-internal imports, unexported subpaths
- `check:ability-contracts` — ability metadata/payload/animation drift invariants
- `check:exports` — built-output + consumer-context package resolution (needs build)
- `check:three-animations` — animation coverage
- `check:audit-guardrails` — audit invariants

## Custom ESLint plugin (`eslint-plugin-dungeon`)
Enforces the conventions in [[code_conventions]]: no-array-mutation,
no-implicit-boolean, prefer-await-over-then-chain, impure-getter, no-numeric-toBe,
no-unsafe-test-contract-cast, no-mocked-subject-call.

## Runtime modes
| Mode | Server entry | Web | Persistence | AI |
|------|-------------|-----|-------------|-----|
| Local dev | `tsx watch src/dev-server.ts` | Vite (proxy :3000) | in-memory | LM Studio optional |
| Docker | `node dist/dev-server.js` | nginx | in-memory or SQLite | LM Studio optional |
| Vercel | serverless `api/index.ts` | static SPA | in-memory (non-durable) | fallback unless LM_HOST |

## Further reading (in repo)
- `docs/guides/architecture.md` — full architecture
- `docs/guides/architecture-patterns.md` — normative cross-project patterns (read first)
- `docs/guides/adding-*.md` — how-tos for enemies/abilities/biomes/items/etc.
- `docs/guides/testing.md`, `docs/guides/audit-tooling.md`

See also: [[project_overview]], [[codebase_structure]], [[code_conventions]].
