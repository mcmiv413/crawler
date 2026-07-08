/**
 * Test layer: contract
 * Behavior: Blank world fixtures produce the same default world values as runtime initialization.
 * Proof: Assertions compare fixture and runtime shop buybackMultiplier, town prosperity/fear/corruption, totalRuns, deepestFloor, highestRarityFound, dungeonOgre status, faction count, and ECONOMY.buybackRate.
 * Validation: pnpm vitest run tests/contracts/fixture-runtime-defaults.contract.test.ts
 */
/**
 * Contract: fixture defaults match runtime defaults
 *
 * The fixture system promises that a freshly-loaded fixture with all fields
 * omitted produces state "indistinguishable from gameplay initialization"
 * (see world-fixture-loader.ts JSDoc).  This suite enforces that guarantee
 * by comparing every default field of a blank fixture against the value
 * produced by the canonical runtime factory functions.
 *
 * When a runtime default changes the test fails here, making it impossible
 * to silently diverge.  Fix: update the fixture loader to use the same
 * runtime source constant rather than duplicating the literal.
 *
 * Test layer: contract (depends on live @dungeon/content at test time).
 */

import { describe, it, expect } from 'vitest';
import { loadWorldFromFixture } from '../../packages/game-core/src/fixtures/world-fixture-loader.js';
import { createInitialWorldState } from '../../packages/game-core/src/state/world-state.js';
import { SeededRNG } from '../../packages/game-core/src/utils/rng.js';
import { ECONOMY } from '@dungeon/content';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Blank fixture — every field omitted so loader uses its own defaults. */
const BLANK_WORLD_FIXTURE = { schemaVersion: 1 as const };

/** Runtime world with a fixed seed so it is deterministic. */
function runtimeWorld() {
  return createInitialWorldState(new SeededRNG(42));
}

/** Fixture-loaded world from a blank fixture (all defaults). */
function fixtureWorld() {
  return loadWorldFromFixture(BLANK_WORLD_FIXTURE);
}

// ---------------------------------------------------------------------------
// economy: buybackMultiplier
// ---------------------------------------------------------------------------

describe('fixture default: shop.buybackMultiplier matches runtime', () => {
  it('runtime initialises buybackMultiplier from ECONOMY.buybackRate', () => {
    const world = runtimeWorld();
    // Verify the runtime itself uses the canonical constant — if this fails,
    // the runtime source changed and both tests below need updating.
    expect(world.shop.buybackMultiplier).toBe(ECONOMY.buybackRate);
  });

  it('fixture default buybackMultiplier equals ECONOMY.buybackRate', () => {
    const world = fixtureWorld();
    expect(world.shop.buybackMultiplier).toBe(ECONOMY.buybackRate);
  });

  it('fixture buybackMultiplier equals runtime buybackMultiplier', () => {
    expect(fixtureWorld().shop.buybackMultiplier).toBe(runtimeWorld().shop.buybackMultiplier);
  });
});

// ---------------------------------------------------------------------------
// town.fear
// ---------------------------------------------------------------------------

describe('fixture default: town.fear matches runtime', () => {
  it('runtime initial town.fear', () => {
    const world = runtimeWorld();
    // Document the authoritative runtime value so the assertion below is explicit.
    expect(world.town.fear).toBe(10);
  });

  it('fixture default town.fear equals runtime initial town.fear', () => {
    expect(fixtureWorld().town.fear).toBe(runtimeWorld().town.fear);
  });
});

// ---------------------------------------------------------------------------
// town.corruption
// ---------------------------------------------------------------------------

describe('fixture default: town.corruption matches runtime', () => {
  it('runtime initial town.corruption', () => {
    const world = runtimeWorld();
    expect(world.town.corruption).toBe(0);
  });

  it('fixture default town.corruption equals runtime initial town.corruption', () => {
    expect(fixtureWorld().town.corruption).toBe(runtimeWorld().town.corruption);
  });
});

// ---------------------------------------------------------------------------
// town.prosperity  (regression guard: this one was already correct)
// ---------------------------------------------------------------------------

describe('fixture default: town.prosperity matches runtime (regression guard)', () => {
  it('fixture default town.prosperity equals runtime initial town.prosperity', () => {
    expect(fixtureWorld().town.prosperity).toBe(runtimeWorld().town.prosperity);
  });
});

// ---------------------------------------------------------------------------
// Composite: all shared scalar defaults in one snapshot comparison
// ---------------------------------------------------------------------------

describe('fixture defaults composite: all shared defaults match runtime', () => {
  it('town state scalar fields all match', () => {
    const fixture = fixtureWorld();
    const runtime = runtimeWorld();

    expect(fixture.town.prosperity).toBe(runtime.town.prosperity);
    expect(fixture.town.fear).toBe(runtime.town.fear);
    expect(fixture.town.corruption).toBe(runtime.town.corruption);
  });

  it('shop buyback multiplier matches', () => {
    const fixture = fixtureWorld();
    const runtime = runtimeWorld();
    expect(fixture.shop.buybackMultiplier).toBe(runtime.shop.buybackMultiplier);
  });

  it('totalRuns initial value matches', () => {
    expect(fixtureWorld().totalRuns).toBe(runtimeWorld().totalRuns);
  });

  it('deepestFloor initial value matches', () => {
    expect(fixtureWorld().deepestFloor).toBe(runtimeWorld().deepestFloor);
  });

  it('highestRarityFound initial value matches', () => {
    expect(fixtureWorld().highestRarityFound).toBe(runtimeWorld().highestRarityFound);
  });

  it('dungeonOgre initial status matches', () => {
    expect(fixtureWorld().dungeonOgre.status).toBe(runtimeWorld().dungeonOgre.status);
  });

  it('faction count matches', () => {
    expect(fixtureWorld().factions.length).toBe(runtimeWorld().factions.length);
  });
});
