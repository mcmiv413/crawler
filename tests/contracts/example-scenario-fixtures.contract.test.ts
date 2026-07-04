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
import { GameEngine } from '../../packages/game-core/src/engine/game-engine.js';
import {
  loadScenario,
  validateScenarioFixture,
} from '../../packages/game-core/src/fixtures/scenario-fixture-loader.js';
import type { ScenarioFixture } from '../../packages/game-core/src/fixtures/scenario-fixture-types.js';
import { RESOLVERS, loadScenarioFile } from './helpers/fixture-loaders.js';

const EXAMPLE_NAMES = [
  'enemy-death-test',
  'fire-spread-test',
  'inventory-chest-test',
  'faction-leader-test',
  'ogre-emergence-test',
  'fresh-game-town-test',
  'full-feature-e2e-test',
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
    // The death pipeline must actually run: a matching ENTITY_DIED event must
    // fire and the enemy must be removed from the run.
    const died = result.events.some(e => e.type === 'ENTITY_DIED' && e.entityId === enemy.id);
    expect(died).toBe(true);
    expect(result.state.run!.enemies.get('1,0')).toBeUndefined();
  });

  it('fire-spread-test: casting ember spends mana and emits events', () => {
    const { state } = loadScenario(loadScenarioFile('fire-spread-test'), RESOLVERS);
    expect(state.player.learnedRingSpellIds).toContain('ember');
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

  it('inventory-chest-test: chest interaction awards loot and carried potion can be consumed', () => {
    const { state, loot } = loadScenario(loadScenarioFile('inventory-chest-test'), RESOLVERS);
    expect(loot).toEqual([]);

    const opened = engine.submitCommand(state, {
      type: 'INTERACT',
      targetPosition: { x: 1, y: 0 },
    });
    expect(opened.events).toContainEqual(expect.objectContaining({
      type: 'OBJECT_INTERACTED',
      gotLoot: true,
    }));
    expect(opened.state.player.inventory.length).toBeGreaterThan(state.player.inventory.length);

    const potionId = opened.state.player.inventory.find(itemId =>
      opened.state.itemRegistry.items.get(itemId)?.itemId === 'health_potion'
    );
    expect(potionId).toBeDefined();
    const used = engine.submitCommand(opened.state, { type: 'USE_ITEM', itemId: potionId! });
    expect(used.state.player.stats.health).toBeGreaterThan(opened.state.player.stats.health);
  });

  it('faction-leader-test: high-power world scales the faction enemy', () => {
    const scenario = loadScenarioFile('faction-leader-test');
    const highPowerLoad = loadScenario(scenario, RESOLVERS);
    // Compare against the same scenario run in a fresh world.
    const freshScenario: ScenarioFixture = { ...scenario, world: { ref: 'fresh-world' } };
    const freshLoad = loadScenario(freshScenario, RESOLVERS);
    const highPowerHp = highPowerLoad.state.run!.enemies.get('3,0')!.stats.maxHealth;
    const freshHp = freshLoad.state.run!.enemies.get('3,0')!.stats.maxHealth;
    // Strict: the placed enemy is a goblin_warband member, so the high-power
    // world must scale its maxHealth above the same enemy in a fresh world.
    expect(highPowerHp).toBeGreaterThan(freshHp);
    expect(highPowerLoad.state.world.dungeonOgre.status).toBe('emerged');
  });

  it('ogre-emergence-test: the ogre is present and attackable', () => {
    const { state } = loadScenario(loadScenarioFile('ogre-emergence-test'), RESOLVERS);
    const ogre = state.run!.enemies.get('1,1')!;
    expect(ogre.templateId).toBe('dungeon_ogre');
    const result = engine.submitCommand(state, { type: 'ATTACK', targetId: ogre.id });
    expect(result.events.length).toBeGreaterThan(0);
  });
});
