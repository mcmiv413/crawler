/**
 * Test layer: integration
 * Behavior: Scenario fixtures load deterministic dungeon GameStates that exercise normal engine combat, movement, loot, world scaling, spell casting, isolation, and invalid-input validation.
 * Proof: Assertions check loaded phase/run/player/world/itemRegistry and placed enemy coordinates, resolver effects, offense preview band equality, ATTACK/MOVE/USE_ITEM/USE_ABILITY outcomes with turn/events/health/inventory/mana changes, repeated-load state/enemy id/stat equality, depth/world-scaled enemy health and ENTITY_DIED removal, loot LOOT_ACQUIRED/registry usability, independent factions/registries, validateScenarioFixture errors for schema/ref/map/placement/status/health cases, resolver call count, and ScenarioLoadError messages.
 * Validation: pnpm vitest run packages/game-core/src/fixtures/scenario-runtime-validation.integration.test.ts
 */
/**
 * Scenario Fixture Runtime Validation Tests
 *
 * The most important deliverable of the scenario system: confidence that a
 * scenario-loaded GameState behaves exactly like a naturally reached gameplay
 * state. These tests prove gameplay behavior, not data shape.
 *
 * Test groups (from the plan):
 *   1 - Scenario Loading
 *   2 - Behavioral Equivalence
 *   3 - Deterministic Loading
 *   4 - Enemy Runtime Validation
 *   5 - Loot Runtime Validation
 *   6 - World Runtime Validation
 *   7 - Spell Runtime Validation
 *   8 - Scenario Isolation
 *   9 - Invalid Scenario Validation
 */

import { describe, it, expect, vi } from 'vitest';
import { ITEM_BY_ID } from '@dungeon/content';
import { GameEngine } from '../engine/game-engine.js';
import { getPlayerOffensePreview } from '../combat-preview.js';
import { addItemToInventory } from '../systems/inventory.js';
import {
  loadScenario,
  validateScenarioFixture,
  ScenarioLoadError,
} from './scenario-fixture-loader.js';
import type {
  ScenarioFixture,
  ScenarioResolvers,
} from './scenario-fixture-types.js';
import type { PlayerFixture } from './player-fixture-types.js';
import type { WorldFixture } from './world-fixture-types.js';

// ─── Fixture builders (inline; no filesystem coupling in this suite) ──────────

const WARRIOR: PlayerFixture = {
  schemaVersion: 1,
  level: 5,
  equippedWeaponId: 'iron_mace',
  inventoryItemIds: ['health_potion', 'health_potion'],
};

const FIRE_MAGE: PlayerFixture = {
  schemaVersion: 1,
  level: 6,
  maxMana: 50,
  mana: 50,
  activeEquipmentIds: { ring1: 'fire_ring' },
  knownRingSchools: ['fire'],
  ringMastery: { fire: { xp: 500 } },
  learnedRingSpellIds: ['ember'],
};

const FRESH_WORLD: WorldFixture = { schemaVersion: 1 };

const OGRE_WORLD: WorldFixture = {
  schemaVersion: 1,
  factions: [{ id: 'goblin_warband', power: 90, disposition: -80 }],
  dungeonOgre: { status: 'emerged', emergedAfterRun: 10, emergedAtDepth: 8 },
  totalRuns: 12,
  deepestFloor: 8,
};

const RESOLVERS: ScenarioResolvers = {
  resolvePlayerFixture: ref => {
    if (ref === 'warrior') return WARRIOR;
    if (ref === 'fire-mage') return FIRE_MAGE;
    throw new Error(`unknown player ref ${ref}`);
  },
  resolveWorldFixture: ref => {
    if (ref === 'fresh') return FRESH_WORLD;
    if (ref === 'ogre') return OGRE_WORLD;
    throw new Error(`unknown world ref ${ref}`);
  },
};

/** A small, fully-explicit combat arena: 6x1 corridor, player left, enemy right. */
function combatScenario(overrides?: Partial<ScenarioFixture>): ScenarioFixture {
  return {
    schemaVersion: 1,
    name: 'combat-arena',
    player: { inline: WARRIOR },
    world: { inline: FRESH_WORLD },
    floor: 1,
    seed: 123,
    map: {
      width: 6,
      height: 1,
      playerStart: { x: 0, y: 0 },
    },
    enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
    ...overrides,
  };
}

const engine = new GameEngine();

// ─── Group 1: Scenario Loading ────────────────────────────────────────────────

describe('Group 1: Scenario Loading', () => {
  it('a valid scenario loads into a dungeon-phase GameState', () => {
    const { state } = loadScenario(combatScenario());
    expect(state.phase).toBe('dungeon');
    expect(state.run).not.toBeNull();
  });

  it('loaded state initializes all core systems (player, run, world, registry)', () => {
    const { state } = loadScenario(combatScenario());
    expect(state.player).toBeDefined();
    expect(state.run!.floor.width).toBe(6);
    expect(state.world.factions.length).toBeGreaterThan(0);
    expect(state.itemRegistry).toBeDefined();
  });

  it('placed enemy is present in the run enemy map at its coordinate', () => {
    const { state } = loadScenario(combatScenario());
    const enemy = state.run!.enemies.get('2,0');
    expect(enemy).toBeDefined();
    expect(enemy!.templateId).toBe('goblin_archer');
  });

  it('the engine accepts a command on the loaded state without error', () => {
    const { state } = loadScenario(combatScenario());
    expect(() => engine.submitCommand(state, { type: 'WAIT' })).not.toThrow();
  });

  it('named-reference player and world fixtures resolve through resolvers', () => {
    const scenario: ScenarioFixture = {
      schemaVersion: 1,
      name: 'ref-test',
      player: { ref: 'warrior' },
      world: { ref: 'ogre' },
      map: { width: 4, height: 1, playerStart: { x: 0, y: 0 } },
    };
    const { state } = loadScenario(scenario, RESOLVERS);
    expect(state.player.level).toBe(5);
    expect(state.world.dungeonOgre.status).toBe('emerged');
  });
});

// ─── Group 2: Behavioral Equivalence ──────────────────────────────────────────

describe('Group 2: Behavioral Equivalence', () => {
  it('player offense preview matches an equivalently built state', () => {
    const { state } = loadScenario(combatScenario());

    // Build a "natural" state via the engine from a new game, then equip the
    // same weapon, and compare the offense preview output.
    const baseline = engine.createNewGame(999);
    const ironMace = ITEM_BY_ID.get('iron_mace')!;
    const withItem = addItemToInventory(baseline, ironMace);
    const equipped = engine.submitCommand(withItem.state, {
      type: 'EQUIP',
      itemId: withItem.state.player.inventory[withItem.state.player.inventory.length - 1]!,
    });

    const scenarioPreview = getPlayerOffensePreview(state);
    const naturalPreview = getPlayerOffensePreview(equipped.state);

    // Same weapon → identical weapon damage band width. createNewGame() always
    // makes a level-1 player, so this compares the weapon's band width, which is
    // independent of the player's attack stat/level (see getPlayerOffensePreview).
    expect(scenarioPreview.totalDamageMin).toBeGreaterThan(0);
    expect(naturalPreview.totalDamageMin).toBeGreaterThan(0);
    const scenarioBand = scenarioPreview.totalDamageMax - scenarioPreview.totalDamageMin;
    const naturalBand = naturalPreview.totalDamageMax - naturalPreview.totalDamageMin;
    expect(scenarioBand).toBe(naturalBand);
  });

  it('attacking a placed enemy produces a real combat outcome (damage or events)', () => {
    // Player adjacent to the enemy: place enemy at (1,0) next to start (0,0).
    const { state } = loadScenario(
      combatScenario({ enemies: [{ templateId: 'goblin_archer', position: { x: 1, y: 0 } }] }),
    );
    const enemy = state.run!.enemies.get('1,0')!;
    const result = engine.submitCommand(state, { type: 'ATTACK', targetId: enemy.id });
    // A real combat resolution emits events and advances the turn.
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.state.turnNumber).toBeGreaterThanOrEqual(state.turnNumber);
  });

  it('moving in the loaded dungeon updates the player position like normal play', () => {
    const { state } = loadScenario(combatScenario());
    const before = state.player.position.x;
    const result = engine.submitCommand(state, { type: 'MOVE', direction: 'E' });
    expect(result.state.player.position.x).toBe(before + 1);
  });

  it('consuming a placed inventory potion heals and removes the item', () => {
    const { state } = loadScenario(combatScenario());
    const potionId = state.player.inventory.find(
      id => state.itemRegistry.items.get(id)?.itemId === 'health_potion',
    )!;
    expect(potionId).toBeDefined();
    const wounded = {
      ...state,
      player: { ...state.player, stats: { ...state.player.stats, health: 10 } },
    };
    const result = engine.submitCommand(wounded, { type: 'USE_ITEM', itemId: potionId });
    expect(result.state.player.stats.health).toBeGreaterThan(10);
    expect(result.state.player.inventory.length).toBe(state.player.inventory.length - 1);
  });
});

// ─── Group 3: Deterministic Loading ──────────────────────────────────────────

describe('Group 3: Deterministic Loading', () => {
  it('loading the same scenario twice yields structurally identical state', () => {
    const a = loadScenario(combatScenario());
    const b = loadScenario(combatScenario());
    expect(a.state).toEqual(b.state);
    expect(a.loot).toEqual(b.loot);
  });

  it('enemy ids are stable across repeated loads', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { state } = loadScenario(combatScenario());
      ids.add(state.run!.enemies.get('2,0')!.id);
    }
    expect(ids.size).toBe(1);
  });

  it('enemy scaled stats are identical across loads (no hidden randomness)', () => {
    const a = loadScenario(combatScenario({ floor: 4 }));
    const b = loadScenario(combatScenario({ floor: 4 }));
    const ea = a.state.run!.enemies.get('2,0')!;
    const eb = b.state.run!.enemies.get('2,0')!;
    expect(ea.stats).toEqual(eb.stats);
  });
});

// ─── Group 4: Enemy Runtime Validation ───────────────────────────────────────

describe('Group 4: Enemy Runtime Validation', () => {
  it('placed enemies scale by floor depth like generated enemies', () => {
    const shallow = loadScenario(combatScenario({ floor: 1 }));
    const deep = loadScenario(combatScenario({ floor: 6 }));
    const shallowHp = shallow.state.run!.enemies.get('2,0')!.stats.maxHealth;
    const deepHp = deep.state.run!.enemies.get('2,0')!.stats.maxHealth;
    expect(deepHp).toBeGreaterThan(shallowHp);
  });

  it('a health override produces a wounded enemy that still has full maxHealth', () => {
    const { state } = loadScenario(
      combatScenario({
        enemies: [{ templateId: 'goblin_archer', position: { x: 1, y: 0 }, health: 1 }],
      }),
    );
    const enemy = state.run!.enemies.get('1,0')!;
    expect(enemy.stats.health).toBe(1);
    expect(enemy.stats.maxHealth).toBeGreaterThanOrEqual(1);
  });

  it('an attack can kill a 1-hp placed enemy and emit a death event', () => {
    const { state } = loadScenario(
      combatScenario({
        enemies: [{ templateId: 'goblin_archer', position: { x: 1, y: 0 }, health: 1 }],
      }),
    );
    const enemy = state.run!.enemies.get('1,0')!;
    const result = engine.submitCommand(state, { type: 'ATTACK', targetId: enemy.id });
    // Prove the death pipeline ran: a matching ENTITY_DIED event must fire and
    // the enemy must be removed from the run.
    const killed = result.events.some(e => e.type === 'ENTITY_DIED' && e.entityId === enemy.id);
    expect(killed).toBe(true);
    expect(result.state.run!.enemies.get('1,0')).toBeUndefined();
  });

  it('a status override is present on the placed enemy', () => {
    const { state } = loadScenario(
      combatScenario({
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 }, statuses: ['burn'] }],
      }),
    );
    const enemy = state.run!.enemies.get('2,0')!;
    expect(enemy.statuses.some(s => s.id === 'burn')).toBe(true);
  });
});

// ─── Group 5: Loot Runtime Validation ────────────────────────────────────────

describe('Group 5: Loot Runtime Validation', () => {
  function lootScenario(): ScenarioFixture {
    return combatScenario({
      enemies: [],
      loot: [{ itemId: 'health_potion', position: { x: 3, y: 0 } }],
    });
  }

  it('a placed loot item is resolved and reported by the loader', () => {
    const { loot } = loadScenario(lootScenario());
    expect(loot).toHaveLength(1);
    expect(loot[0]!.itemId).toBe('health_potion');
    expect(loot[0]!.position).toEqual({ x: 3, y: 0 });
  });

  it('collecting placed loot updates inventory and item registry like a drop', () => {
    const { state, loot } = loadScenario(lootScenario());
    const template = ITEM_BY_ID.get(loot[0]!.itemId)!;
    const before = state.player.inventory.length;
    const result = addItemToInventory(state, template);
    expect(result.state.player.inventory.length).toBe(before + 1);
    const newId = result.state.player.inventory[result.state.player.inventory.length - 1]!;
    expect(result.state.itemRegistry.items.get(newId)).toBeDefined();
    expect(result.events.some(e => e.type === 'LOOT_ACQUIRED')).toBe(true);
  });

  it('collected loot is usable through normal gameplay (consume a collected potion)', () => {
    const { state, loot } = loadScenario(lootScenario());
    const template = ITEM_BY_ID.get(loot[0]!.itemId)!;
    const collected = addItemToInventory(state, template);
    const wounded = {
      ...collected.state,
      player: { ...collected.state.player, stats: { ...collected.state.player.stats, health: 5 } },
    };
    const potionId = wounded.player.inventory[wounded.player.inventory.length - 1]!;
    const result = engine.submitCommand(wounded, { type: 'USE_ITEM', itemId: potionId });
    expect(result.state.player.stats.health).toBeGreaterThan(5);
  });
});

// ─── Group 6: World Runtime Validation ───────────────────────────────────────

describe('Group 6: World Runtime Validation', () => {
  it('different world fixtures influence faction power in the loaded state', () => {
    const fresh = loadScenario(combatScenario({ world: { inline: FRESH_WORLD } }));
    const ogre = loadScenario(combatScenario({ world: { inline: OGRE_WORLD } }));
    const freshGoblin = fresh.state.world.factions.find(f => f.id === 'goblin_warband')!;
    const ogreGoblin = ogre.state.world.factions.find(f => f.id === 'goblin_warband')!;
    expect(ogreGoblin.power).toBeGreaterThan(freshGoblin.power);
  });

  it('ogre world fixture carries emerged ogre status into the loaded state', () => {
    const { state } = loadScenario(combatScenario({ world: { inline: OGRE_WORLD } }));
    expect(state.world.dungeonOgre.status).toBe('emerged');
  });

  it('enemy strength reflects world faction power (high-power world → tougher members)', () => {
    // Use a faction-tagged enemy so faction strength scaling applies.
    const fresh = loadScenario(
      combatScenario({
        world: { inline: FRESH_WORLD },
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
      }),
    );
    const ogre = loadScenario(
      combatScenario({
        world: { inline: OGRE_WORLD },
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
      }),
    );
    const freshHp = fresh.state.run!.enemies.get('2,0')!.stats.maxHealth;
    const ogreHp = ogre.state.run!.enemies.get('2,0')!.stats.maxHealth;
    expect(ogreHp).toBeGreaterThan(freshHp);
  });

  it('health override validation uses world-scaled enemy max health', () => {
    const powered = loadScenario(
      combatScenario({
        world: { inline: OGRE_WORLD },
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
      }),
    );
    const poweredMaxHealth = powered.state.run!.enemies.get('2,0')!.stats.maxHealth;
    const validation = validateScenarioFixture(
      combatScenario({
        world: { inline: OGRE_WORLD },
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 }, health: poweredMaxHealth }],
      }),
    );
    expect(validation.errors).toEqual([]);
    expect(validation.isValid).toBe(true);
  });
});

// ─── Group 7: Spell Runtime Validation ───────────────────────────────────────

describe('Group 7: Spell Runtime Validation', () => {
  function spellScenario(): ScenarioFixture {
    return {
      schemaVersion: 1,
      name: 'fire-spell',
      player: { inline: FIRE_MAGE },
      world: { inline: FRESH_WORLD },
      floor: 1,
      seed: 7,
      map: { width: 6, height: 1, playerStart: { x: 0, y: 0 } },
      enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
    };
  }

  it('fire mage scenario loads with the learned spell and equipped ring', () => {
    const { state } = loadScenario(spellScenario());
    expect(state.player.learnedRingSpellIds).toContain('ember');
    expect(state.player.equipment.ring1).not.toBeNull();
  });

  it('casting ember at the enemy executes real gameplay (events + mana cost)', () => {
    const { state } = loadScenario(spellScenario());
    const enemy = state.run!.enemies.get('2,0')!;
    const result = engine.submitCommand(state, {
      type: 'USE_ABILITY',
      abilityId: 'ember',
      targetId: enemy.id,
    });
    expect(result.events.length).toBeGreaterThan(0);
    // Comparing final mana to the starting value is brittle: per-turn regen can
    // offset (or exceed) the spend. Require a negative MANA_CHANGED to prove the
    // cast actually deducted mana.
    const spentMana = result.events.some(e => e.type === 'MANA_CHANGED' && e.amount < 0);
    expect(spentMana).toBe(true);
  });
});

// ─── Group 8: Scenario Isolation ─────────────────────────────────────────────

describe('Group 8: Scenario Isolation', () => {
  it('mutating one loaded state does not affect a second independent load', () => {
    const a = loadScenario(combatScenario());
    const b = loadScenario(combatScenario());
    // submitCommand is pure: capture the returned state and prove the move
    // actually advanced a's player so this is a real isolation check.
    const movedA = engine.submitCommand(a.state, { type: 'MOVE', direction: 'E' });
    expect(movedA.state.player.position).toEqual({ x: 1, y: 0 });
    // b is untouched: its player is still at the start.
    expect(b.state.player.position).toEqual({ x: 0, y: 0 });
  });

  it('two scenarios with different worlds do not share faction arrays', () => {
    const fresh = loadScenario(combatScenario({ world: { inline: FRESH_WORLD } }));
    const ogre = loadScenario(combatScenario({ world: { inline: OGRE_WORLD } }));
    expect(fresh.state.world.factions).not.toBe(ogre.state.world.factions);
  });

  it('loaded item registries are independent instances', () => {
    const a = loadScenario(combatScenario());
    const b = loadScenario(combatScenario());
    expect(a.state.itemRegistry).not.toBe(b.state.itemRegistry);
    expect(a.state.itemRegistry.items).not.toBe(b.state.itemRegistry.items);
  });
});

// ─── Group 9: Invalid Scenario Validation ────────────────────────────────────

describe('Group 9: Invalid Scenario Validation', () => {
  function expectInvalid(scenario: ScenarioFixture, fieldFragment: string, resolvers?: ScenarioResolvers): void {
    const result = validateScenarioFixture(scenario, resolvers);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field.includes(fieldFragment) || e.message.includes(fieldFragment))).toBe(true);
  }

  it('rejects an unsupported schema version', () => {
    expectInvalid(combatScenario({ schemaVersion: 99 }), 'schemaVersion');
  });

  it('rejects an unknown player fixture reference', () => {
    expectInvalid(
      { ...combatScenario(), player: { ref: 'does-not-exist' } },
      'player',
      RESOLVERS,
    );
  });

  it('rejects an unknown world fixture reference', () => {
    expectInvalid(
      { ...combatScenario(), world: { ref: 'does-not-exist' } },
      'world',
      RESOLVERS,
    );
  });

  it('resolves a referenced world fixture once during validation', () => {
    const resolveWorldFixture = vi.fn((ref: string): WorldFixture => {
      if (ref === 'fresh') return FRESH_WORLD;
      throw new Error(`unknown world ref ${ref}`);
    });
    const validation = validateScenarioFixture(
      { ...combatScenario(), player: { ref: 'warrior' }, world: { ref: 'fresh' } },
      {
        resolvePlayerFixture: RESOLVERS.resolvePlayerFixture,
        resolveWorldFixture,
      },
    );

    expect(validation.isValid).toBe(true);
    expect(resolveWorldFixture).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-object player.inline without crashing', () => {
    const scenario = { ...combatScenario(), player: { inline: null } } as unknown as ScenarioFixture;
    expectInvalid(scenario, 'player');
  });

  it('rejects a non-object world.inline without crashing', () => {
    const scenario = { ...combatScenario(), world: { inline: null } } as unknown as ScenarioFixture;
    expectInvalid(scenario, 'world');
  });

  it('rejects an unknown enemy template id', () => {
    expectInvalid(
      combatScenario({ enemies: [{ templateId: 'not_an_enemy', position: { x: 2, y: 0 } }] }),
      'enemies',
    );
  });

  it('rejects an unknown loot item id', () => {
    expectInvalid(
      combatScenario({ loot: [{ itemId: 'not_an_item', position: { x: 3, y: 0 } }] }),
      'loot',
    );
  });

  it('rejects an out-of-bounds enemy position', () => {
    expectInvalid(
      combatScenario({ enemies: [{ templateId: 'goblin_archer', position: { x: 99, y: 0 } }] }),
      'position',
    );
  });

  it('rejects an out-of-bounds player start', () => {
    expectInvalid(
      combatScenario({ map: { width: 6, height: 1, playerStart: { x: -1, y: 0 } } }),
      'playerStart',
    );
  });

  it('rejects overlapping enemy placements', () => {
    expectInvalid(
      combatScenario({
        enemies: [
          { templateId: 'goblin_archer', position: { x: 2, y: 0 } },
          { templateId: 'cave_rat', position: { x: 2, y: 0 } },
        ],
      }),
      'position',
    );
  });

  it('rejects an enemy placed on the player start', () => {
    expectInvalid(
      combatScenario({ enemies: [{ templateId: 'goblin_archer', position: { x: 0, y: 0 } }] }),
      'position',
    );
  });

  it('rejects an enemy placed on a wall', () => {
    expectInvalid(
      combatScenario({
        map: { width: 6, height: 1, playerStart: { x: 0, y: 0 }, walls: [{ x: 2, y: 0 }] },
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
      }),
      'position',
    );
  });

  it('rejects an enemy placed outside an explicit floor list', () => {
    expectInvalid(
      combatScenario({
        map: {
          width: 6,
          height: 1,
          playerStart: { x: 0, y: 0 },
          floors: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        },
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 } }],
      }),
      'walkable',
    );
  });

  it('rejects loot placed outside an explicit floor list', () => {
    expectInvalid(
      combatScenario({
        enemies: [],
        map: {
          width: 6,
          height: 1,
          playerStart: { x: 0, y: 0 },
          floors: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        },
        loot: [{ itemId: 'health_potion', position: { x: 3, y: 0 } }],
      }),
      'walkable',
    );
  });

  it('rejects loot placed on a wall', () => {
    expectInvalid(
      combatScenario({
        enemies: [],
        map: { width: 6, height: 1, playerStart: { x: 0, y: 0 }, walls: [{ x: 3, y: 0 }] },
        loot: [{ itemId: 'health_potion', position: { x: 3, y: 0 } }],
      }),
      'walkable',
    );
  });

  it('rejects an interactable placed on a wall', () => {
    expectInvalid(
      combatScenario({
        enemies: [],
        map: { width: 6, height: 1, playerStart: { x: 0, y: 0 }, walls: [{ x: 3, y: 0 }] },
        interactables: [{ templateId: 'chest', position: { x: 3, y: 0 } }],
      }),
      'walkable',
    );
  });

  it('rejects an enemy health override above its scaled max health', () => {
    expectInvalid(
      combatScenario({
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 }, health: 999_999 }],
      }),
      'maxHealth',
    );
  });

  it('rejects duplicate named spawn identifiers', () => {
    expectInvalid(
      combatScenario({
        map: {
          width: 6,
          height: 1,
          playerStart: { x: 0, y: 0 },
          spawns: [
            { name: 'a', position: { x: 1, y: 0 } },
            { name: 'a', position: { x: 3, y: 0 } },
          ],
        },
      }),
      'spawns',
    );
  });

  it('rejects an invalid enemy status id', () => {
    expectInvalid(
      combatScenario({
        enemies: [{ templateId: 'goblin_archer', position: { x: 2, y: 0 }, statuses: ['not_a_status'] }],
      }),
      'statuses',
    );
  });

  it('rejects invalid scenario weapon mastery data', () => {
    expectInvalid(
      combatScenario({
        weaponMastery: { dagger: -1 },
      }),
      'weaponMastery.dagger',
    );
  });

  it('loadScenario throws a ScenarioLoadError on invalid input', () => {
    expect(() => loadScenario(combatScenario({ schemaVersion: 99 }))).toThrow(ScenarioLoadError);
  });

  it('the thrown error message names the offending field', () => {
    try {
      loadScenario(combatScenario({ enemies: [{ templateId: 'not_an_enemy', position: { x: 2, y: 0 } }] }));
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ScenarioLoadError);
      expect((err as ScenarioLoadError).message).toContain('not_an_enemy');
    }
  });
});
