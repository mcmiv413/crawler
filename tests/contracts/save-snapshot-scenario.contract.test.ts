import { describe, expect, it } from 'vitest';
import type { GameCommand, GameState } from '@dungeon/contracts';
import { ITEM_BY_ID } from '@dungeon/content';
import { GameEngine } from '../../packages/game-core/src/engine/game-engine.js';
import { loadScenario } from '../../packages/game-core/src/fixtures/scenario-fixture-loader.js';
import { addItemToInventory } from '../../packages/game-core/src/systems/inventory.js';
import {
  exportSaveSnapshot,
  loadSaveSnapshot,
} from '../../packages/game-core/src/state/save-snapshot.js';
import { RESOLVERS, loadScenarioFile } from './helpers/fixture-loaders.js';

const engine = new GameEngine();

function saveRestore(state: GameState): GameState {
  return loadSaveSnapshot(JSON.parse(JSON.stringify(exportSaveSnapshot(state))));
}

function expectCommandEquivalent(state: GameState, command: GameCommand): void {
  const original = engine.submitCommand(state, command);
  const restored = engine.submitCommand(saveRestore(state), command);

  expect(restored.events).toEqual(original.events);
  expect(exportSaveSnapshot(restored.state)).toEqual(exportSaveSnapshot(original.state));
}

describe('SaveSnapshot scenario compatibility', () => {
  it('Test Group 12: restores scenario-derived gameplay after turns and continues equivalently', () => {
    const { state, loot } = loadScenario(loadScenarioFile('inventory-consumable-test'), RESOLVERS);
    const potionTemplate = ITEM_BY_ID.get(loot[0]!.itemId);
    if (potionTemplate === undefined) {
      throw new Error(`Missing scenario loot item ${loot[0]!.itemId}`);
    }

    const collected = addItemToInventory(state, potionTemplate).state;
    const wounded: GameState = {
      ...collected,
      player: {
        ...collected.player,
        stats: {
          ...collected.player.stats,
          health: 1,
        },
      },
    };
    const potionEntityId = wounded.player.inventory[wounded.player.inventory.length - 1]!;
    const afterUse = engine.submitCommand(wounded, { type: 'USE_ITEM', itemId: potionEntityId }).state;

    const restored = saveRestore(afterUse);

    expect(exportSaveSnapshot(restored)).toEqual(exportSaveSnapshot(afterUse));
    expectCommandEquivalent(restored, { type: 'MOVE', direction: 'E' });
  });
});
