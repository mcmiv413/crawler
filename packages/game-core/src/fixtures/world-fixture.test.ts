/**
 * World Fixture System Tests — Phase 2
 *
 * Test-first (TDD) suite covering all 5 groups from the plan:
 *   Group 1 - Minimal world fixture (default values)
 *   Group 2 - Fully specified factions (with custom power/disposition)
 *   Group 3 - Dungeon Ogre states (sealed, emerged, slain)
 *   Group 4 - Validation failures (unknown faction id, invalid fields)
 *   Group 5 - World equivalence (fixture world matches expected structure)
 *
 * Integration:
 *   Group 6 - Player + World fixture combined into a valid GameState
 */

import { describe, it, expect } from 'vitest';
import { serializeState } from '../state/serialization.js';
import { createInitialWorldState } from '../state/world-state.js';
import { createTestGameState } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';
import {
  validateWorldFixture,
  loadWorldFromFixture,
  WORLD_FIXTURE_SCHEMA_VERSION,
} from './world-fixture-loader.js';
import { loadPlayerFromFixture } from './player-fixture-loader.js';
import type { WorldFixture, FixtureFactionOverride } from './world-fixture-types.js';

// ─── Minimal world fixture ────────────────────────────────────────────────────

const MINIMAL_WORLD_FIXTURE: WorldFixture = {
  schemaVersion: 1,
};

function runtimeWorld() {
  return createInitialWorldState(new SeededRNG(42));
}

// ─── Fixture with custom factions ────────────────────────────────────────────

const FACTION_OVERRIDES: readonly FixtureFactionOverride[] = [
  { id: 'goblin_warband', power: 70, disposition: -40 },
  { id: 'beast_swarm', power: 20, disposition: 0 },
];

const FACTION_FIXTURE: WorldFixture = {
  schemaVersion: 1,
  factions: FACTION_OVERRIDES,
};

// ─── Fixture with ogre emerged ────────────────────────────────────────────────

const OGRE_EMERGED_FIXTURE: WorldFixture = {
  schemaVersion: 1,
  dungeonOgre: { status: 'emerged', emergedAfterRun: 3, emergedAtDepth: 5 },
};

// ─── Fixture with ogre slain ──────────────────────────────────────────────────

const OGRE_SLAIN_FIXTURE: WorldFixture = {
  schemaVersion: 1,
  dungeonOgre: { status: 'slain' },
};

// ─── Full world fixture ───────────────────────────────────────────────────────

const FULL_WORLD_FIXTURE: WorldFixture = {
  schemaVersion: 1,
  factions: [
    { id: 'goblin_warband', power: 75, disposition: -50 },
    { id: 'undead_legion', power: 60, disposition: -70 },
    { id: 'shadow_cult', power: 90, disposition: -80 },
    { id: 'beast_swarm', power: 10, disposition: 0 },
  ],
  dungeonOgre: { status: 'emerged', emergedAfterRun: 2, emergedAtDepth: 4 },
  town: { prosperity: 30, fear: 60, corruption: 45 },
  totalRuns: 5,
  deepestFloor: 8,
  highestRarityFound: 'rare',
};

// =============================================================================
// Group 1: Minimal World Fixture
// =============================================================================

describe('Group 1: Minimal world fixture creates valid WorldState with defaults', () => {
  it('validates a minimal world fixture without errors', () => {
    const result = validateWorldFixture(MINIMAL_WORLD_FIXTURE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('loads a minimal fixture into a WorldState object', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world).toBeDefined();
  });

  it('produces all four factions from content by default', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.factions).toHaveLength(4);
  });

  it('default factions contain the four known faction IDs', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    const ids = world.factions.map(f => f.id);
    expect(ids).toContain('goblin_warband');
    expect(ids).toContain('beast_swarm');
    expect(ids).toContain('shadow_cult');
    expect(ids).toContain('undead_legion');
  });

  it('default dungeon ogre status is sealed', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.dungeonOgre.status).toBe('sealed');
    expect(world.dungeonOgre.id).toBe('dungeon_ogre');
  });

  it('default town prosperity matches runtime default', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.town.prosperity).toBe(runtimeWorld().town.prosperity);
  });

  it('default town fear matches runtime default', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.town.fear).toBe(runtimeWorld().town.fear);
  });

  it('default town corruption matches runtime default', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.town.corruption).toBe(runtimeWorld().town.corruption);
  });

  it('default totalRuns is 0', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.totalRuns).toBe(0);
  });

  it('default deepestFloor is 0', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.deepestFloor).toBe(0);
  });

  it('default highestRarityFound is common', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.highestRarityFound).toBe('common');
  });

  it('default shop has items array and a buyback multiplier', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(Array.isArray(world.shop.items)).toBe(true);
    expect(typeof world.shop.buybackMultiplier).toBe('number');
  });

  it('default npcs is an empty array', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.npcs).toHaveLength(0);
  });

  it('default eventHistory is an empty array', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.eventHistory).toHaveLength(0);
  });

  it('default unlockedBlueprints is an empty array', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.unlockedBlueprints).toHaveLength(0);
  });
});

// =============================================================================
// Group 2: Fully specified factions
// =============================================================================

describe('Group 2: Faction overrides are applied correctly', () => {
  it('validates a fixture with faction overrides without errors', () => {
    const result = validateWorldFixture(FACTION_FIXTURE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('still produces all four factions when only two are overridden', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    expect(world.factions).toHaveLength(4);
  });

  it('overrides goblin_warband power to 70', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const faction = world.factions.find(f => f.id === 'goblin_warband');
    expect(faction).toBeDefined();
    expect(faction!.power).toBe(70);
  });

  it('overrides goblin_warband disposition to -40', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const faction = world.factions.find(f => f.id === 'goblin_warband');
    expect(faction!.disposition).toBe(-40);
  });

  it('overrides beast_swarm power to 20', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const faction = world.factions.find(f => f.id === 'beast_swarm');
    expect(faction!.power).toBe(20);
  });

  it('non-overridden factions use content-derived initial power', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const shadowCult = world.factions.find(f => f.id === 'shadow_cult');
    // shadow_cult has initialPower: 25 in content
    expect(shadowCult).toBeDefined();
    expect(typeof shadowCult!.power).toBe('number');
    expect(shadowCult!.power).toBeGreaterThanOrEqual(0);
  });

  it('overridden faction status defaults to leaderless', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const faction = world.factions.find(f => f.id === 'goblin_warband');
    expect(faction!.status).toBe('leaderless');
  });

  it('overridden faction leader defaults to null', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const faction = world.factions.find(f => f.id === 'goblin_warband');
    expect(faction!.leader).toBeNull();
  });

  it('overridden faction membersKilledByPlayer defaults to 0', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const faction = world.factions.find(f => f.id === 'goblin_warband');
    expect(faction!.membersKilledByPlayer).toBe(0);
  });

  it('full fixture with all four overridden factions loads all four', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.factions).toHaveLength(4);
    expect(world.factions.find(f => f.id === 'shadow_cult')!.power).toBe(90);
    expect(world.factions.find(f => f.id === 'undead_legion')!.power).toBe(60);
  });
});

// =============================================================================
// Group 3: Dungeon Ogre states
// =============================================================================

describe('Group 3: Dungeon Ogre status fixtures', () => {
  it('sealed ogre has status sealed', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.dungeonOgre.status).toBe('sealed');
  });

  it('emerged ogre has status emerged', () => {
    const world = loadWorldFromFixture(OGRE_EMERGED_FIXTURE);
    expect(world.dungeonOgre.status).toBe('emerged');
  });

  it('emerged ogre carries emergedAfterRun value', () => {
    const world = loadWorldFromFixture(OGRE_EMERGED_FIXTURE);
    expect(world.dungeonOgre.emergedAfterRun).toBe(3);
  });

  it('emerged ogre carries emergedAtDepth value', () => {
    const world = loadWorldFromFixture(OGRE_EMERGED_FIXTURE);
    expect(world.dungeonOgre.emergedAtDepth).toBe(5);
  });

  it('slain ogre has status slain', () => {
    const world = loadWorldFromFixture(OGRE_SLAIN_FIXTURE);
    expect(world.dungeonOgre.status).toBe('slain');
  });

  it('dungeon ogre id is always dungeon_ogre', () => {
    const world1 = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    const world2 = loadWorldFromFixture(OGRE_EMERGED_FIXTURE);
    const world3 = loadWorldFromFixture(OGRE_SLAIN_FIXTURE);
    expect(world1.dungeonOgre.id).toBe('dungeon_ogre');
    expect(world2.dungeonOgre.id).toBe('dungeon_ogre');
    expect(world3.dungeonOgre.id).toBe('dungeon_ogre');
  });

  it('validates emerged ogre fixture without errors', () => {
    const result = validateWorldFixture(OGRE_EMERGED_FIXTURE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates slain ogre fixture without errors', () => {
    const result = validateWorldFixture(OGRE_SLAIN_FIXTURE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('full fixture ogre emerged after run 2 at depth 4', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.dungeonOgre.status).toBe('emerged');
    expect(world.dungeonOgre.emergedAfterRun).toBe(2);
    expect(world.dungeonOgre.emergedAtDepth).toBe(4);
  });
});

// =============================================================================
// Group 4: Validation failures
// =============================================================================

describe('Group 4: Validation failures produce explicit errors', () => {
  it('rejects unknown schemaVersion', () => {
    const fixture = { schemaVersion: 999 } as WorldFixture;
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'schemaVersion');
    expect(error).toBeDefined();
    expect(error!.message).toContain('999');
  });

  it('rejects unknown faction id in factions array', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [{ id: 'fire_elementals', power: 50, disposition: -10 }],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('factions'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('fire_elementals');
  });

  it('rejects faction power below 0', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [{ id: 'goblin_warband', power: -5, disposition: 0 }],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('power'));
    expect(error).toBeDefined();
  });

  it('rejects faction power above 100', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [{ id: 'goblin_warband', power: 150, disposition: 0 }],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('power'));
    expect(error).toBeDefined();
  });

  it('rejects faction disposition below -100', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [{ id: 'goblin_warband', power: 50, disposition: -150 }],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('disposition'));
    expect(error).toBeDefined();
  });

  it('rejects faction disposition above 100', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [{ id: 'goblin_warband', power: 50, disposition: 150 }],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('disposition'));
    expect(error).toBeDefined();
  });

  it('rejects invalid dungeon ogre status', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: { status: 'partially_emerged' },
    } as unknown as WorldFixture;
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('dungeonOgre'));
    expect(error).toBeDefined();
  });

  it('rejects town prosperity below 0', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      town: { prosperity: -10 },
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('prosperity'));
    expect(error).toBeDefined();
  });

  it('rejects town prosperity above 100', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      town: { prosperity: 200 },
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('prosperity'));
    expect(error).toBeDefined();
  });

  it('rejects town fear below 0', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      town: { fear: -1 },
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('fear'));
    expect(error).toBeDefined();
  });

  it('rejects town fear above 100', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      town: { fear: 101 },
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('fear'));
    expect(error).toBeDefined();
  });

  it('rejects negative totalRuns', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      totalRuns: -1,
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'totalRuns');
    expect(error).toBeDefined();
  });

  it('rejects negative deepestFloor', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      deepestFloor: -5,
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'deepestFloor');
    expect(error).toBeDefined();
  });

  it('rejects invalid highestRarityFound value', () => {
    const fixture = {
      schemaVersion: 1,
      highestRarityFound: 'divine',
    } as unknown as WorldFixture;
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'highestRarityFound');
    expect(error).toBeDefined();
    expect(error!.message).toContain('divine');
  });

  it('each validation error has a non-empty field and message', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [{ id: 'fire_elementals', power: -5, disposition: 200 }],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    for (const error of result.errors) {
      expect(typeof error.field).toBe('string');
      expect(error.field.length).toBeGreaterThan(0);
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('loadWorldFromFixture throws on invalid fixture', () => {
    const fixture = { schemaVersion: 999 } as WorldFixture;
    expect(() => loadWorldFromFixture(fixture)).toThrow();
  });

  it('rejects duplicate faction ids in the factions array', () => {
    const fixture: WorldFixture = {
      schemaVersion: 1,
      factions: [
        { id: 'goblin_warband', power: 50, disposition: -10 },
        { id: 'goblin_warband', power: 60, disposition: -20 },
      ],
    };
    const result = validateWorldFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.message.toLowerCase().includes('duplicate'));
    expect(error).toBeDefined();
  });
});

// =============================================================================
// Group 5: World equivalence — fixture world matches expected structure
// =============================================================================

describe('Group 5: World equivalence — loaded world matches expected shape', () => {
  it('loaded world has the same shape as createTestGameState world', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    const expectedWorld = createTestGameState().world;
    // Same top-level keys
    expect(Object.keys(world).sort()).toEqual(Object.keys(expectedWorld).sort());
  });

  it('loaded world factions have the same shape as INITIAL_FACTIONS', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    const expectedWorld = createTestGameState().world;
    const worldFactionKeys = Object.keys(world.factions[0]!).sort();
    const expectedFactionKeys = Object.keys(expectedWorld.factions[0]!).sort();
    expect(worldFactionKeys).toEqual(expectedFactionKeys);
  });

  it('loaded world dungeonOgre has same shape as INITIAL_DUNGEON_OGRE', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    expect(world.dungeonOgre).toHaveProperty('id');
    expect(world.dungeonOgre).toHaveProperty('status');
  });

  it('full fixture applies town prosperity correctly', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.town.prosperity).toBe(30);
  });

  it('full fixture applies town fear correctly', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.town.fear).toBe(60);
  });

  it('full fixture applies town corruption correctly', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.town.corruption).toBe(45);
  });

  it('full fixture applies totalRuns correctly', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.totalRuns).toBe(5);
  });

  it('full fixture applies deepestFloor correctly', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.deepestFloor).toBe(8);
  });

  it('full fixture applies highestRarityFound correctly', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world.highestRarityFound).toBe('rare');
  });

  it('loading the same fixture twice produces identical faction state', () => {
    const world1 = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const world2 = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world1.factions).toEqual(world2.factions);
  });

  it('loading the same fixture twice produces identical ogre state', () => {
    const world1 = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const world2 = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world1.dungeonOgre).toEqual(world2.dungeonOgre);
  });

  it('loading the same fixture twice produces identical town state', () => {
    const world1 = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const world2 = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    expect(world1.town).toEqual(world2.town);
  });
});

// =============================================================================
// Group 6: Integration — player fixture + world fixture → GameState
// =============================================================================

describe('Group 6: Integration — player + world fixture create a valid GameState', () => {
  it('a world loaded from fixture can be used in createTestGameState', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    const state = createTestGameState({ world });
    expect(state).toBeDefined();
    expect(state.world).toBeDefined();
  });

  it('a player + world fixture GameState serializes without error', () => {
    const { player } = loadPlayerFromFixture({ schemaVersion: 1, level: 3, gold: 100 });
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const state = createTestGameState({ player, world });
    expect(() => serializeState(state)).not.toThrow();
  });

  it('serialized combined fixture state produces valid JSON', () => {
    const { player } = loadPlayerFromFixture({ schemaVersion: 1, level: 5, gold: 200 });
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const state = createTestGameState({ player, world });
    const json = serializeState(state);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('serialized state retains world faction data', () => {
    const world = loadWorldFromFixture(FACTION_FIXTURE);
    const state = createTestGameState({ world });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as { world: { factions: Array<{ id: string; power: number }> } };
    const goblin = parsed.world.factions.find(f => f.id === 'goblin_warband');
    expect(goblin).toBeDefined();
    expect(goblin!.power).toBe(70);
  });

  it('serialized state retains dungeonOgre emerged status', () => {
    const world = loadWorldFromFixture(OGRE_EMERGED_FIXTURE);
    const state = createTestGameState({ world });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as { world: { dungeonOgre: { status: string } } };
    expect(parsed.world.dungeonOgre.status).toBe('emerged');
  });

  it('serialized state retains town prosperity from fixture', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const state = createTestGameState({ world });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as { world: { town: { prosperity: number } } };
    expect(parsed.world.town.prosperity).toBe(30);
  });

  it('player level from player fixture is preserved in combined GameState', () => {
    const { player } = loadPlayerFromFixture({ schemaVersion: 1, level: 7 });
    const world = loadWorldFromFixture(MINIMAL_WORLD_FIXTURE);
    const state = createTestGameState({ player, world });
    expect(state.player.level).toBe(7);
  });

  it('world from fixture overrides default world in createTestGameState', () => {
    const world = loadWorldFromFixture(FULL_WORLD_FIXTURE);
    const state = createTestGameState({ world });
    expect(state.world.totalRuns).toBe(5);
    expect(state.world.deepestFloor).toBe(8);
  });
});

// =============================================================================
// WORLD_FIXTURE_SCHEMA_VERSION constant
// =============================================================================

describe('WORLD_FIXTURE_SCHEMA_VERSION constant', () => {
  it('exports the current schema version as 1', () => {
    expect(WORLD_FIXTURE_SCHEMA_VERSION).toBe(1);
  });
});

// =============================================================================
// Group 7: dungeonOgre null/type safety — malformed object cases
// =============================================================================

describe('Group 7: dungeonOgre null/type safety — malformed cases return validation errors (never throw)', () => {
  it('returns a validation error (not throw) when dungeonOgre is null', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: null,
    } as unknown as WorldFixture;
    let result: ReturnType<typeof validateWorldFixture> | undefined;
    expect(() => {
      result = validateWorldFixture(fixture);
    }).not.toThrow();
    expect(result!.isValid).toBe(false);
    const error = result!.errors.find(e => e.field === 'dungeonOgre');
    expect(error).toBeDefined();
    expect(error!.message).toBeTruthy();
  });

  it('returns a validation error (not throw) when dungeonOgre is an empty object {}', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: {},
    } as unknown as WorldFixture;
    let result: ReturnType<typeof validateWorldFixture> | undefined;
    expect(() => {
      result = validateWorldFixture(fixture);
    }).not.toThrow();
    expect(result!.isValid).toBe(false);
    const error = result!.errors.find(e => e.field === 'dungeonOgre.status');
    expect(error).toBeDefined();
  });

  it('returns a validation error (not throw) when dungeonOgre.status is an invalid string', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: { status: 'invalid' },
    } as unknown as WorldFixture;
    let result: ReturnType<typeof validateWorldFixture> | undefined;
    expect(() => {
      result = validateWorldFixture(fixture);
    }).not.toThrow();
    expect(result!.isValid).toBe(false);
    const error = result!.errors.find(e => e.field === 'dungeonOgre.status');
    expect(error).toBeDefined();
    expect(error!.message).toContain('invalid');
  });

  it('returns a validation error (not throw) when dungeonOgre.emergedAfterRun is a non-numeric string', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: { status: 'emerged', emergedAfterRun: 'five' },
    } as unknown as WorldFixture;
    let result: ReturnType<typeof validateWorldFixture> | undefined;
    expect(() => {
      result = validateWorldFixture(fixture);
    }).not.toThrow();
    expect(result!.isValid).toBe(false);
    const error = result!.errors.find(e => e.field === 'dungeonOgre.emergedAfterRun');
    expect(error).toBeDefined();
    expect(error!.message).toBeTruthy();
  });

  it('returns a validation error (not throw) when dungeonOgre.emergedAtDepth is an object {}', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: { status: 'emerged', emergedAtDepth: {} },
    } as unknown as WorldFixture;
    let result: ReturnType<typeof validateWorldFixture> | undefined;
    expect(() => {
      result = validateWorldFixture(fixture);
    }).not.toThrow();
    expect(result!.isValid).toBe(false);
    const error = result!.errors.find(e => e.field === 'dungeonOgre.emergedAtDepth');
    expect(error).toBeDefined();
    expect(error!.message).toBeTruthy();
  });

  it('dungeonOgre null error field is "dungeonOgre" (not a sub-field)', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: null,
    } as unknown as WorldFixture;
    const result = validateWorldFixture(fixture);
    expect(result.errors.some(e => e.field === 'dungeonOgre')).toBe(true);
  });

  it('dungeonOgre {} error targets dungeonOgre.status specifically', () => {
    const fixture = {
      schemaVersion: 1,
      dungeonOgre: {},
    } as unknown as WorldFixture;
    const result = validateWorldFixture(fixture);
    expect(result.errors.some(e => e.field === 'dungeonOgre.status')).toBe(true);
  });

  it('all malformed dungeonOgre cases produce errors with non-empty field and message', () => {
    const cases = [
      { schemaVersion: 1, dungeonOgre: null },
      { schemaVersion: 1, dungeonOgre: {} },
      { schemaVersion: 1, dungeonOgre: { status: 'invalid' } },
      { schemaVersion: 1, dungeonOgre: { status: 'emerged', emergedAfterRun: 'five' } },
      { schemaVersion: 1, dungeonOgre: { status: 'emerged', emergedAtDepth: {} } },
    ] as unknown as WorldFixture[];

    for (const fixture of cases) {
      const result = validateWorldFixture(fixture);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      for (const error of result.errors) {
        expect(typeof error.field).toBe('string');
        expect(error.field.length).toBeGreaterThan(0);
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    }
  });
});
