# Code Conventions

## Immutability (CRITICAL — enforced by custom ESLint rule)
- **Never mutate.** GameState is immutable; always return new objects via spread.
  E.g. `{ ...state, run: { ...state.run, enemies: newEnemies } }`,
  `const newEnemies = new Map(state.run.enemies)` before edits.
- Custom rule **`dungeon/no-array-mutation`** forbids `push`/`splice`/`sort` etc.
  Escape hatch: prefix the variable with `mutable` (e.g. `mutableCache`).

## Explicit booleans (enforced by `dungeon/no-implicit-boolean`)
- Use explicit comparisons: `if (killed === true)`, `if (x !== undefined)`,
  `if (state.run === null)` — NOT `if (killed)` / `if (!x)`.

## ESM imports (CRITICAL)
- Strict ESM. **All relative imports use the `.js` extension even in `.ts` source**
  (e.g. `import { foo } from './foo.js'`). `verbatimModuleSyntax` is on, so use
  `import type` for type-only imports.
- Cross-package imports go through workspace aliases (`@dungeon/core` etc.),
  never sibling `src/` paths. Enforced by `check:workspace-wiring`.

## Naming
- Commands/events use **SCREAMING_SNAKE_CASE** discriminants (`'MOVE'`, `'ATTACK'`,
  `'USE_ITEM'`, `'USE_ABILITY'`) on a discriminated-union `type` field.
- Files kebab-case; functions/vars camelCase; types/classes PascalCase.
- Systems are pure functions named by action (e.g. `applyDamageToEnemy`).

## Functional style
- Systems are **stateless pure functions**: `(state, params) -> { state, events }`.
- Presenter is **pure**: `buildGameView(state)` has zero side effects.
- Prefer async/await over `.then()` chains (`dungeon/prefer-await-over-then-chain`).
- Getters must be pure — no console/fs/fetch/axios (`dungeon/impure-getter`).

## Validation
- Validate at boundaries with **Zod** schemas (all API/command/event shapes).
- Don't trust external data (API responses, user input, LM Studio output).

## File organization (global user rule + repo practice)
- Many small files > few large. ~200-400 lines typical, 800 max. Organize by
  feature/domain. Functions <50 lines.

## Tests (enforced by custom rules)
- **`dungeon/no-numeric-toBe`**: never `.toBe(<number literal>)` — use
  `.toBeGreaterThan()`/`.toBeLessThan()` or config-injected values
  (numeric assertions break on balance tuning).
- **`dungeon/no-unsafe-test-contract-cast`**: no `as unknown as <PublicContractType>`
  in tests — use builders, `satisfies`, or narrower partial fixtures.
- **`dungeon/no-mocked-subject-call`**: don't execute a mocked import as the
  subject under test.

## Generated indexes (do NOT hand-edit)
- Catalog entries are one-file-per-entity; generated `index.ts` files are produced
  by `pnpm generate:indexes`. Fix the entity file or `scripts/generate-indexes.ts`,
  then regenerate. Never edit generated indexes directly.

## Config centralization (no hardcoded values)
- UI sizing -> `apps/web/src/config/ui-config.ts`
- Game balance -> `packages/content/src/balance/tables.ts`
- Fitness tests enforce this: `apps/web/src/config.test.ts`,
  `packages/game-core/src/config.test.ts`.

## Comments
- WHY-only comments for non-obvious constraints; don't narrate WHAT.

See also: [[architecture_and_patterns]], [[tech_stack]], [[task_completion_checklist]].
