/**
 * Test layer: integration
 * Behavior: checked-in v1 historical save fixtures load through the public save path, stabilize to the current snapshot shape, support follow-up commands, and still build presenter views.
 * Proof: Each fixture JSON is parsed, loadSaveSnapshot returns map-backed GameState, export/load/export is stable, GameEngine accepts a representative command after restore, buildGameView succeeds, and an invalid historical fixture throws SaveSnapshotLoadError before a partial restore can be used.
 * Validation: pnpm vitest run packages/game-core/src/state/save-compatibility.test.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameCommand, GameState } from '@dungeon/contracts';
import { buildGameView } from '@dungeon/presenter';
import { GameEngine } from '../engine/game-engine.js';
import {
  exportSaveSnapshot,
  loadSaveSnapshot,
  SaveSnapshotLoadError,
} from './save-snapshot.js';

const FIXTURE_DIR = join(process.cwd(), 'fixtures/saves/v1');
const FIXTURE_FILES = readdirSync(FIXTURE_DIR)
  .filter(fileName => fileName.endsWith('.json'))
  .sort();

const engine = new GameEngine();

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readFixture(fileName: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, fileName), 'utf8')) as unknown;
}

function firstEnemyId(state: GameState): string {
  const enemy = [...(state.run?.enemies.values() ?? [])][0];
  if (enemy === undefined) {
    throw new Error('Expected fixture to contain an enemy for ability command proof');
  }
  return enemy.id;
}

function representativeCommand(fileName: string, state: GameState): GameCommand {
  if (fileName === 'ring-spell-known.json') {
    return {
      type: 'USE_ABILITY',
      abilityId: 'ember',
      targetId: firstEnemyId(state),
      targetPosition: { x: 1, y: 0 },
    };
  }

  if (state.run !== null) {
    return { type: 'WAIT' };
  }

  return {
    type: 'TOWN_ACTION',
    action: 'enter_dungeon',
  };
}

describe('historical save compatibility fixtures', () => {
  it('checks in the expected v1 fixture set', () => {
    expect(FIXTURE_FILES).toEqual([
      'in-combat-with-enemy.json',
      'in-dungeon-basic.json',
      'inventory-and-equipment.json',
      'persisted-floor-cache.json',
      'quest-in-progress.json',
      'representative-full-state.json',
      'ring-spell-known.json',
      'town-start.json',
    ]);
  });

  it.each(FIXTURE_FILES)('%s loads, stabilizes, builds a view, and can continue', fileName => {
    const fixture = readFixture(fileName);
    expect(fixture).toEqual(expect.objectContaining({ schemaVersion: expect.any(Number) }));

    const restored = loadSaveSnapshot(jsonClone(fixture));
    expect(restored.itemRegistry.items).toBeInstanceOf(Map);
    expect(restored.run === null || restored.run.enemies instanceof Map).toBe(true);

    const currentShape = exportSaveSnapshot(restored);
    const restoredAgain = loadSaveSnapshot(jsonClone(currentShape));
    expect(exportSaveSnapshot(restoredAgain)).toEqual(currentShape);

    const view = buildGameView(restored);
    expect(view.gameId).toBe(restored.gameId);
    expect(view.phase).toBe(restored.phase);

    const result = engine.submitCommand(restored, representativeCommand(fileName, restored));
    expect(result.state.gameId).toBe(restored.gameId);
    expect(buildGameView(result.state).gameId).toBe(restored.gameId);
  });

  it('rejects invalid historical fixtures before a partial restore can be used', () => {
    const invalidFixture = readFixture('town-start.json') as Record<string, unknown>;
    delete invalidFixture.player;

    try {
      loadSaveSnapshot(invalidFixture);
      throw new Error('Expected invalid historical fixture to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(SaveSnapshotLoadError);
      expect((error as SaveSnapshotLoadError).validationErrors).toContainEqual(
        expect.objectContaining({ field: 'player' }),
      );
    }
  });
});
