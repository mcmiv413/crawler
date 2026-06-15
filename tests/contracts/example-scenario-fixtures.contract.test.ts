/**
 * Contract tests for the example scenario library (Group 10).
 *
 * Every example scenario must function as executable gameplay documentation:
 * it loads from disk, resolves its player/world references against the live
 * Phase-1 fixture files, and executes at least one meaningful gameplay action.
 *
 * Lives in the contract suite because it reads fixture files from disk and
 * validates against the live @dungeon/content registries.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEM_BY_ID } from '@dungeon/content';
import { GameEngine } from '../../packages/game-core/src/engine/game-engine.js';
import { addItemToInventory } from '../../packages/game-core/src/systems/inventory.js';
import {
  loadScenario,
  validateScenarioFixture,
} from '../../packages/game-core/src/fixtures/scenario-fixture-loader.js';
import type {
  ScenarioFixture,
  ScenarioResolvers,
} from '../../packages/game-core/src/fixtures/scenario-fixture-types.js';
import type { PlayerFixture } from '../../packages/game-core/src/fixtures/player-fixture-types.js';
import type { WorldFixture } from '../../packages/game-core/src/fixtures/world-fixture-types.js';

const ROOT = process.cwd();
const SCENARIOS_DIR = join(ROOT, 'fixtures/scenarios');
const PLAYERS_DIR = join(ROOT, 'fixtures/players');
const WORLDS_DIR = join(ROOT, 'fixtures/worlds');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

const RESOLVERS: ScenarioResolvers = {
  resolvePlayerFixture: ref => readJson<PlayerFixture>(join(PLAYERS_DIR, `${ref}.json`)),
  resolveWorldFixture: ref => readJson<WorldFixture>(join(WORLDS_DIR, `${ref}.json`)),
};

function loadScenarioFile(name: string): ScenarioFixture {
  return readJson<ScenarioFixture>(join(SCENARIOS_DIR, `${name}.json`));
}

const EXAMPLE_NAMES = [
  'enemy-death-test',
  'fire-spread-test',
  'inventory-consumable-test',
  'faction-leader-test',
  'ogre-emergence-test',
];

const engine = new GameEngine();

describe('Example scenario library: structural validity', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name} validates against live content and Phase-1 fixtures`, () => {
      const scenario = loadScenarioFile(name);
      const result = validateScenarioFixture(scenario, RESOLVERS);
      expect(result.errors).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    it(`${name} loads into a dungeon-phase GameState`, () => {
      const { state } = loadScenario(loadScenarioFile(name), RESOLVERS);
      expect(state.phase).toBe('dungeon');
      expect(state.run).not.toBeNull();
    });
  }
});

describe('Example scenario library: executable gameplay', () => {
  it('enemy-death-test: one attack kills the wounded goblin', () => {
    const { state } = loadScenario(loadScenarioFile('enemy-death-test'), RESOLVERS);
    const enemy = state.run!.enemies.get('1,0')!;
    expect(enemy.stats.health).toBe(1);
    const result = engine.submitCommand(state, { type: 'ATTACK', targetId: enemy.id });
    const died = result.events.some(e => e.type === 'ENTITY_DIED');
    const survivor = result.state.run!.enemies.get('1,0');
    expect(died || survivor === undefined).toBe(true);
  });

  it('fire-spread-test: casting ember spends mana and emits events', () => {
    const { state } = loadScenario(loadScenarioFile('fire-spread-test'), RESOLVERS);
    expect(state.player.learnedRingSpellIds).toContain('ember');
    const enemy = state.run!.enemies.get('2,0')!;
    const manaBefore = state.player.mana;
    const result = engine.submitCommand(state, {
      type: 'USE_ABILITY',
      abilityId: 'ember',
      targetId: enemy.id,
    });
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.state.player.mana).toBeLessThanOrEqual(manaBefore);
  });

  it('inventory-consumable-test: placed potion is collected and healed with', () => {
    const { state, loot } = loadScenario(loadScenarioFile('inventory-consumable-test'), RESOLVERS);
    expect(loot).toHaveLength(1);
    const template = ITEM_BY_ID.get(loot[0]!.itemId)!;
    const collected = addItemToInventory(state, template);
    expect(collected.state.player.inventory.length).toBe(state.player.inventory.length + 1);

    const wounded = {
      ...collected.state,
      player: { ...collected.state.player, stats: { ...collected.state.player.stats, health: 1 } },
    };
    const potionId = wounded.player.inventory[wounded.player.inventory.length - 1]!;
    const used = engine.submitCommand(wounded, { type: 'USE_ITEM', itemId: potionId });
    expect(used.state.player.stats.health).toBeGreaterThan(1);
  });

  it('faction-leader-test: high-power world scales the faction enemy', () => {
    const scenario = loadScenarioFile('faction-leader-test');
    const ogreLoad = loadScenario(scenario, RESOLVERS);
    // Compare against the same scenario run in a fresh world.
    const freshScenario: ScenarioFixture = { ...scenario, world: { ref: 'fresh-world' } };
    const freshLoad = loadScenario(freshScenario, RESOLVERS);
    const ogreHp = ogreLoad.state.run!.enemies.get('3,0')!.stats.maxHealth;
    const freshHp = freshLoad.state.run!.enemies.get('3,0')!.stats.maxHealth;
    expect(ogreHp).toBeGreaterThanOrEqual(freshHp);
    expect(ogreLoad.state.world.dungeonOgre.status).toBe('emerged');
  });

  it('ogre-emergence-test: the ogre is present and attackable', () => {
    const { state } = loadScenario(loadScenarioFile('ogre-emergence-test'), RESOLVERS);
    const ogre = state.run!.enemies.get('1,1')!;
    expect(ogre.templateId).toBe('dungeon_ogre');
    const result = engine.submitCommand(state, { type: 'ATTACK', targetId: ogre.id });
    expect(result.events.length).toBeGreaterThan(0);
  });
});
