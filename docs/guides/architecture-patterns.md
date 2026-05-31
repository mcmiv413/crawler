# Architecture Patterns

This guide is the normative reference for cross-project architecture patterns. Use it when adding catalog content, feature behavior, presenter fields, UI surfaces, migrations, tests, or docs.

## Layer Ownership

| Layer | Owns | Must not own |
|---|---|---|
| `packages/game-contracts` | Shared state, command, event, and schema contracts | Content catalogs or runtime decisions |
| `packages/content` | Static declarations: abilities, items, enemies, biomes, statuses, ring schools, ring spells, animation refs, balance tables, fallback text | Player-specific state changes, world decisions, command handling, persistence |
| `packages/game-core` | Runtime game rules: command handling, systems, AI turns, generation, combat, equipment, ability execution | Display formatting or browser concerns |
| `apps/server` | API orchestration, repositories, save/restore, migrations, AI service composition | Core rule duplication or UI presentation logic |
| `packages/presenter` | Display-ready `GameView` read models and formatted events | Mutating game state or requiring frontend code to interpret raw state |
| `apps/web` | Rendering and input using `GameView`, commands, and shared UI pipelines | Raw content lookup, duplicate display derivation, game rule decisions |

When a change seems to need logic in more than one layer, decide which layer owns the decision and pass a typed result downstream. Do not duplicate the same rule in core, presenter, and web.

## Entity Definition Files

Catalog data belongs in individual source files. New abilities, items, enemies, statuses, biomes, enchantments, quests, archetypes, factions, ambient profiles, ring schools, ring spells, animation refs, objects, traps, weapons, armor, and consumables should be defined as one entity per file unless a local guide says otherwise.

Examples:

| Entity | Source file pattern | Generated or catalog artifact |
|---|---|---|
| Ability metadata | `packages/content/src/abilities/<ability>.ts` (non-ring abilities) | `packages/content/src/abilities/index.ts` |
| Enemy template | `packages/content/src/enemies/<enemy>.ts` | `packages/content/src/enemies/index.ts` |
| Biome | `packages/content/src/biomes/<biome>.ts` | `packages/content/src/biomes/index.ts` |
| Status | `packages/content/src/statuses/<status>.ts` | `packages/content/src/statuses/index.ts` |
| Ring school | `packages/content/src/ring-schools/<school>.ts` | `packages/content/src/ring-schools/index.ts` |
| Ring spell metadata | `packages/content/src/ring-spells/<spell>.ts` | `packages/content/src/ring-spells/index.ts`, plus generated inclusion in `packages/content/src/abilities/index.ts` |
| Item | `packages/content/src/items/<category>/<item>.ts` | `packages/content/src/items/<category>/index.ts` |
| Animation ref | `packages/content/src/animation-refs/<category>.ts` | `packages/content/src/animation-refs/index.ts` catalog |
| Web animation module | `apps/web/src/animations/modules/<module>.ts` | `apps/web/src/animations/generated/index.ts` when generator support is enabled |

Run this after adding or renaming generated-index content:

```bash
pnpm generate:indexes
```

Generated `index.ts` files that start with `// Auto-generated` are artifacts. Do not hand-edit them. If a generated export is missing, fix the source entity file or the generator, then rerun `pnpm generate:indexes`.

Some catalogs have helper files such as `types.ts`, `utilities.ts`, `mastery.ts`, or `utils.ts`; those are hand-authored support files, not entity definitions. Keep new entity data out of aggregate files when a per-entity file pattern exists.

Ring spells are authored only under `packages/content/src/ring-spells/`. Do **not** create duplicate `packages/content/src/abilities/<spell>.ts` files for them; `pnpm generate:indexes` emits ring spells into `ABILITY_DEFINITIONS` automatically for compatibility.

## References Over Literals

Prefer dot-walked or imported references over raw strings when one content object references another:

```ts
import { animationRefs } from '../animation-refs/index.js';
import { burn } from '../statuses/index.js';

animation: { id: animationRefs.projectile.emberBolt.id },
statusEffects: [{ statusId: burn.id, duration: 3, target: 'target' }],
```

Use raw IDs only at the declaration boundary where the entity defines its own stable ID. Cross-reference coverage belongs in contract tests.

## Static Content, Runtime Decisions

`packages/content` describes what exists. `packages/game-core` and `apps/server` decide what happens at runtime.

Content can declare:

- IDs, names, descriptions, static stats, tags, refs, requirements, costs, and balance tables.
- Data needed by core systems to make a decision.

Content should not:

- Mutate `GameState`.
- Decide player-specific availability from live state.
- Persist, migrate, restore, or summarize a run.
- Format UI copy beyond static fallback text.

## Central Pipelines

Shared behavior should route through central pipelines instead of one-off feature code.

| Behavior | Pipeline |
|---|---|
| Commands | `packages/game-core/src/engine/command-handler.ts` |
| Player/enemy turns | `packages/game-core/src/engine/turn-scheduler.ts` |
| Ability execution | `packages/game-core/src/abilities/runtime/` |
| Equipment grants | `packages/game-core/src/systems/equipment.ts` |
| Events to log text | `packages/presenter/src/event-formatter.ts` |
| View construction | `packages/presenter/src/game-view-builder.ts` and `packages/presenter/src/builders/` |
| Web commands/state | `apps/web/src/store/game-store.ts` |
| UI sizing | `apps/web/src/config/ui-config.ts` |

If a new feature bypasses a central pipeline, the plan or review must explain why.

## Deterministic Guardrails

Repo-wide pattern checks live behind `pnpm run check:audit-guardrails`. Use that home for cheap deterministic checks that protect repeated architecture failures, and keep each check pattern-level with a known-bad fixture. Current guardrails cover tracked test topology, mocked-subject tests, optional backend import boundaries, generated/catalog reference literals, docs path validity, and configured centralized literal drift.

Exceptions must be narrow and documented in the guardrail config or fixture root. Do not add broad directory skips to get a branch green.

## Presenter Views

The presenter is the frontend-facing read model. `GameView` should expose display-ready data so web components do not need to reconstruct game rules, query live content, or format domain events.

Use the presenter for:

- Derived readiness, labels, costs, cooldowns, status summaries, and action availability.
- Combat log text from domain events.
- View-specific grouping and ordering.

Use the web app for:

- Layout, controls, local interaction state, and rendering.
- Submitting typed commands from user input.

## Persistence And Restore

Any change to saved state must check:

- `GameState` and schema contracts.
- Repository serialization and deserialization.
- Save migration or defaulting behavior.
- Restore/session behavior.
- Presenter behavior for old saves where new fields may be absent.

Prefer additive migrations. Do not make old saves unopenable without an explicit migration plan.

## Test Layers

Use the layer that matches the risk:

| Risk | Test layer |
|---|---|
| Pure helper behavior | Unit or property test with local fixtures |
| Live content IDs and cross-references | Contract test |
| Engine command or multi-step game behavior | Integration test |
| Tuned distributions | Balance test |
| Read model behavior | Presenter test |
| Browser workflow | E2E test |

Unit and property tests must not import live `@dungeon/content` or build integrated live state. Contract tests are the right place to validate generated registries and live cross-references.

## Change Checklist

- Source entities live in individual files.
- Generated indexes or registries are regenerated, not hand-edited.
- Content declares static facts; core/server owns runtime decisions.
- Cross-references dot-walk through imported definitions where practical.
- Shared behavior uses the established central pipeline.
- Presenter exposes display-ready data; web does not duplicate content logic.
- State shape changes include migration/restore checks.
- Tests are at the correct layer.
- Related guides and examples are updated.
- Final validation ends with `pnpm validate`.
