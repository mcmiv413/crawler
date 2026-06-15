# Player Fixture System

## Overview

Player fixtures allow you to construct a player in a known state for testing, debugging, and balancing without requiring gameplay progression. This guide covers Phase 1 (player fixtures); future phases will add world state and save/load.

## Quick Start

Create a file under `fixtures/players/`:

```json
{
  "schemaVersion": 1,
  "level": 5,
  "experience": 1000,
  "health": 40,
  "maxHealth": 50,
  "mana": 20,
  "maxMana": 30,
  "gold": 500,
  "equippedWeaponId": "iron_sword",
  "equippedArmorIds": {
    "chest": "leather_chest",
    "head": "leather_helm"
  },
  "inventoryItemIds": ["health_potion", "mana_potion"],
  "knownRingSchools": ["fire"],
  "ringMastery": {
    "fire": { "xp": 100 }
  },
  "learnedRingSpellIds": ["fireball"]
}
```

Load it in tests:

```typescript
import { loadPlayerFromFixture } from '@dungeon/core/fixtures/player-fixture-loader.js';
import newCharacterFixture from '../../../fixtures/players/new-character.json' assert { type: 'json' };

const player = loadPlayerFromFixture(newCharacterFixture);
```

## Schema Reference

### Required Fields

- **schemaVersion** (number) — Must be `1`. Incremented when breaking changes occur. Old versions are rejected with a clear error.

### Player Stats

- **level** (number ≥ 1) — Determines base stats via `LEVEL_UP_GAINS`. Defaults: health and mana scale with level.
- **experience** (number ≥ 0, optional) — Cumulative XP toward the next level. Defaults to `0`.
- **health** (number ≥ 0, optional) — Current HP. Defaults to `maxHealth`.
- **maxHealth** (number > 0, optional) — Max HP. Defaults computed from `level` and `BASE_PLAYER_STATS`.
- **mana** (number ≥ 0, optional) — Current mana. Defaults to `maxMana`.
- **maxMana** (number > 0, optional) — Max mana. Defaults to `MAGIC.initialMana`.
- **gold** (number ≥ 0, optional) — Currency. Defaults to `0`.

### Equipment

- **equippedWeaponId** (string | null, optional) — Must exist in `ITEM_BY_ID`. Defaults to `null`.
- **equippedArmorIds** (object, optional) — Armor slots: `chest`, `head`, `gloves`, `boots`, `secondaryWeapon`. Each must exist in `ITEM_BY_ID` or be `undefined`. Defaults to all `undefined`.
- **activeEquipmentIds** (object, optional) — Ring slots: `ring1`, `ring2`. Each must exist in `ITEM_BY_ID` or be `undefined`. Defaults to all `undefined`.

### Inventory

- **inventoryItemIds** (array of strings, optional) — List of item IDs. Each must exist in `ITEM_BY_ID`. Defaults to `[]`.

### Ring System

- **knownRingSchools** (array of strings, optional) — List of unlocked ring schools. Each must exist in `RING_SCHOOL_BY_ID`. Validates dynamically against content. Defaults to `[]`.
- **ringMastery** (object, optional) — Keys are ring school IDs (validated). Values are `{ xp: number ≥ 0 }`. Defaults to `{}`.
- **learnedRingSpellIds** (array of strings, optional) — List of spell IDs. Each must exist in `RING_SPELL_BY_ID`. Defaults to `[]`.

## Validation

The fixture loader validates **all fields against live content**:

- Unknown item IDs → error with the exact bad ID and field path
- Unknown ring school IDs → error listing valid schools from `RING_SCHOOL_BY_ID`
- Out-of-range values (health > maxHealth, negative gold) → explicit error
- Invalid schema version → error with expected version

**Never silent failures.** Every validation error identifies the offending field and bad value.

## What's Dynamic, What's Not

### Dynamic (Pulls from Content)
✓ Item validation — uses `ITEM_BY_ID` (add items to `packages/content/src/items/` and re-run `pnpm generate:indexes`)  
✓ Ring school validation — uses `RING_SCHOOL_BY_ID` (add ring schools to `packages/content/src/rings/` and regenerate)  
✓ Ring spell validation — uses `RING_SPELL_BY_ID` (add spells to spell definition files)  
✓ Base stats — computed from `BASE_PLAYER_STATS` and `LEVEL_UP_GAINS` (update `packages/content/src/balance/tables.ts`)

### Not Dynamic (Hardcoded)
✗ Player field list — `knownRingSchools`, `ringMastery`, etc. are fixed by the Player interface  
✗ Armor slot names — `chest`, `head`, `gloves`, `boots`, `secondaryWeapon` are part of the Equipment type  
✗ Ring slot names — `ring1`, `ring2` are fixed

**Impact on Content Changes:**
- Adding a new ring school? No code changes needed. Fixtures accept it automatically.
- Adding a new item? No fixture code changes. Just update `packages/content/` and regenerate indexes.
- Changing the Player interface (e.g., adding a new field)? The fixture system and all existing fixtures need updates.

## Example Fixtures

The following fixtures are provided and tested:

- **new-character.json** — Level 1, no equipment, baseline player for testing early-game systems
- **midgame-warrior.json** — Level 5, full armor set, sword, no ring system
- **fire-mage-mastery-test.json** — Level 7, fire ring school, spells learned, for ring magic testing
- **high-level-everything.json** — Level 10, both ring schools, max gold, all systems in use

These fixtures are exercised by the contract test suite (`example-fixtures.contract.test.ts`) to catch drift in the fixture loader.

## Usage in Tests

### Unit Tests

Test a specific system using a fixture:

```typescript
import { loadPlayerFromFixture } from '@dungeon/core/fixtures/player-fixture-loader.js';
import firemageFixture from '../../../fixtures/players/fire-mage-mastery-test.json' assert { type: 'json' };

describe('Ring Magic System', () => {
  it('fire mage has learned fireball', () => {
    const player = loadPlayerFromFixture(firemageFixture);
    expect(player.learnedRingSpellIds).toContain('fireball');
  });
});
```

### Integration Tests

Test the full 6-hop chain (entry → state → event → presenter → UI):

```typescript
// Fixture creates player
const player = loadPlayerFromFixture(midgameFixture);

// Player triggers a command
const result = gameEngine.submitCommand(state, { type: 'MOVE', ... });

// Verify state, events, and presenter output
expect(result.events).toContainEqual(expect.objectContaining({ type: 'PLAYER_MOVED' }));
const view = buildGameView(result.state);
expect(view.player.position).toEqual({ x: 1, y: 1 });
```

## Phase 1 Scope

✓ Player fixtures  
✓ Item/spell/school validation (dynamic)  
✓ Test utilities and examples

✗ World state (faction levels, corruption, prosperity, quests) — Phase 2  
✗ Scenario fixtures (encounters, custom maps) — Phase 2  
✗ Save/load UI — Phase 3  
✗ Browser persistence — Phase 3

## Maintenance

### When You Add a New Content Type

1. **New item** → Run `pnpm generate:indexes` to update `ITEM_BY_ID`. Fixtures automatically accept it.
2. **New ring school** → Add to ring definitions. Run `pnpm generate:indexes`. Fixtures automatically accept it.
3. **New ring spell** → Add to spell definitions. Fixtures automatically accept it.
4. **New balance value** → Update `packages/content/src/balance/tables.ts`. Re-run tests.

No fixture schema changes needed unless the **Player interface itself changes**.

### When the Player Interface Changes

1. Update `packages/game-contracts/src/types/player.ts`
2. Update the `PlayerFixture` schema in `packages/game-core/src/fixtures/player-fixture-types.ts` if the new field is fixture-relevant
3. Update the fixture loader's `buildPlayer()` function to populate the new field
4. Update or create example fixtures to cover the new field
5. Run `pnpm test` to verify all fixture tests pass

## Troubleshooting

**"Unknown item id 'iron_sword'"**  
→ Check `packages/content/src/items/`. The item must exist and `pnpm generate:indexes` must have been run.

**"Unknown ring school 'ice'"**  
→ Ring school doesn't exist yet. Add it to ring definitions or fix the typo.

**"health (50) cannot exceed maxHealth (40)"**  
→ Either lower `health` or raise `maxHealth`.

**"learnedRingSpellIds is missing in type"** (TypeScript error)  
→ Your fixture JSON is missing the `learnedRingSpellIds` array (even if empty).

## Scenario Fixtures (Phase 2)

A **scenario fixture** composes a player fixture and a world fixture with an
explicit dungeon map, enemy placements, and loot placements into a complete,
playable `GameState` that can be loaded directly into the engine. It is the
preferred mechanism for reproducing bugs and testing gameplay systems without
manual progression.

Scenario files live under `fixtures/scenarios/`. They reference player and
world fixtures by name rather than duplicating their data.

### Format

```jsonc
{
  "schemaVersion": 1,
  "name": "enemy-death-test",
  "description": "One attack kills a wounded goblin.",
  "player": { "ref": "midgame-warrior" },   // or { "inline": { ...PlayerFixture } }
  "world": { "ref": "fresh-world" },          // or { "inline": { ...WorldFixture } }
  "floor": 1,                                  // depth; drives enemy scaling (default 1)
  "seed": 101,                                 // deterministic RNG seed (default 1)
  "map": {
    "width": 6,
    "height": 1,
    "playerStart": { "x": 0, "y": 0 },
    "walls": [{ "x": 4, "y": 0 }],             // optional; non-walkable tiles
    "floors": [],                              // optional; when present, all other cells become walls
    "spawns": [{ "name": "victim", "position": { "x": 1, "y": 0 } }]
  },
  "enemies": [
    { "templateId": "goblin_archer", "position": { "x": 1, "y": 0 }, "health": 1,
      "level": 3, "statuses": ["burn"], "healthMultiplier": 1.5 }
  ],
  "loot": [{ "itemId": "health_potion", "position": { "x": 2, "y": 0 } }],
  "interactables": [{ "templateId": "chest", "position": { "x": 3, "y": 0 } }],
  "tags": ["combat", "reproduction"]
}
```

All enemy/loot/interactable fields except `templateId`/`itemId` and `position`
are optional.

### Loading a scenario

```ts
import { loadScenario } from '@dungeon/core/fixtures/scenario-fixture-loader.js';

const { state, loot } = loadScenario(scenario, {
  resolvePlayerFixture: ref => readJson(`fixtures/players/${ref}.json`),
  resolveWorldFixture: ref => readJson(`fixtures/worlds/${ref}.json`),
});
// state.phase === 'dungeon'; submit commands via GameEngine as usual.
// loot[] lists resolved ground items; collect with addItemToInventory(state, template).
```

### Fidelity guarantees

- Enemies are built through the same `createEnemyInstance` factory used by floor
  population, so they scale and behave exactly like naturally spawned enemies.
- Maps are fully explicit — no procedural generation, no randomness.
- Loading is deterministic: entity IDs come from a stable counter, so the same
  scenario produces an identical `GameState` every time.
- Validation reuses `validatePlayerFixture` and `validateWorldFixture`; it never
  adds scenario-specific exceptions to runtime systems. Invalid scenarios throw
  `ScenarioLoadError` with explicit, field-specific messages before any state is
  built.

### Validation rejects

Unknown player/world fixture refs · unknown enemy/item/object ids · out-of-bounds
or wall coordinates · overlapping placements · enemies on the player start ·
duplicate spawn names · invalid status ids · unsupported schema versions.

### Adding a new example scenario

1. Create `fixtures/scenarios/<name>.json` referencing existing player/world
   fixtures and live content IDs.
2. Add it to `EXAMPLE_NAMES` in
   `tests/contracts/example-scenario-fixtures.contract.test.ts` and assert at
   least one meaningful gameplay action (attack, cast, collect, etc.).
3. Run `pnpm validate` to confirm the scenario loads and plays.

## See Also

- [architecture.md](./architecture.md) — GameState structure and data flow
- [testing.md](./testing.md) — Test layers and assertion helpers
