/**
 * Test layer: contract
 * Behavior: Scenario-derived gameplay can be save-restored after chest and item use and then continue with equivalent command results.
 * Proof: Assertions compare exported snapshots before and after restore and require the restored MOVE command to emit the same events and exported state as the original command.
 * Validation: pnpm vitest run tests/contracts/save-snapshot-scenario.contract.test.ts
 */
import { describe, expect, it } from 'vitest';
import type { GameCommand, GameState } from '@dungeon/contracts';
import { GameEngine } from '../../packages/game-core/src/engine/game-engine.js';
import { loadScenario } from '../../packages/game-core/src/fixtures/scenario-fixture-loader.js';
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
    const { state } = loadScenario(loadScenarioFile('inventory-chest-test'), RESOLVERS);
    const afterChest = engine.submitCommand(state, {
      type: 'INTERACT',
      targetPosition: { x: 1, y: 0 },
    }).state;
    const potionEntityId = afterChest.player.inventory.find(itemId =>
      afterChest.itemRegistry.items.get(itemId)?.itemId === 'health_potion'
    );
    if (potionEntityId === undefined) {
      throw new Error('inventory-chest-test must provide a carried health potion');
    }
    const afterUse = engine.submitCommand(afterChest, { type: 'USE_ITEM', itemId: potionEntityId }).state;

    const restored = saveRestore(afterUse);

    expect(exportSaveSnapshot(restored)).toEqual(exportSaveSnapshot(afterUse));
    expectCommandEquivalent(restored, { type: 'MOVE', direction: 'E' });
  });
});
