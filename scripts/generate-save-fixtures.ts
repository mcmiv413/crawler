import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AnyItemTemplate,
  EntityId,
  GameState,
  Quest,
  StoredFloor,
} from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { ITEM_BY_ID } from '@dungeon/content';
import { GameEngine } from '../packages/game-core/src/engine/game-engine.js';
import { loadScenario } from '../packages/game-core/src/fixtures/scenario-fixture-loader.js';
import type {
  ScenarioFixture,
  ScenarioResolvers,
} from '../packages/game-core/src/fixtures/scenario-fixture-types.js';
import type { PlayerFixture } from '../packages/game-core/src/fixtures/player-fixture-types.js';
import type { WorldFixture } from '../packages/game-core/src/fixtures/world-fixture-types.js';
import {
  createTestGameState,
  createTestGameStateInCombat,
  createTestGameStateWithAbility,
  createTestRunState,
} from '../packages/game-core/src/test-utils.js';
import { exportSaveSnapshot } from '../packages/game-core/src/state/save-snapshot.js';

const OUTPUT_DIR = join(process.cwd(), 'fixtures/saves/v1');
const engine = new GameEngine();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8')) as T;
}

const scenarioResolvers: ScenarioResolvers = {
  resolvePlayerFixture: ref => readJson<PlayerFixture>(`fixtures/players/${ref}.json`),
  resolveWorldFixture: ref => readJson<WorldFixture>(`fixtures/worlds/${ref}.json`),
};

function itemTemplate(itemId: string): AnyItemTemplate {
  const template = ITEM_BY_ID.get(itemId);
  if (template === undefined) {
    throw new Error(`Missing item template for save fixture generation: ${itemId}`);
  }
  return template;
}

function withInventoryAndEquipment(state: GameState): GameState {
  const weaponEntityId = entityId('fixture_rusty_sword');
  const armorEntityId = entityId('fixture_plate_armor');
  const potionEntityId = entityId('fixture_health_potion');
  const bootsEntityId = entityId('fixture_leather_boots');

  return {
    ...state,
    player: {
      ...state.player,
      equipment: {
        ...state.player.equipment,
        weapon: weaponEntityId,
        chest: armorEntityId,
      },
      inventory: [potionEntityId, bootsEntityId],
      gold: 125,
    },
    itemRegistry: {
      items: new Map<EntityId, AnyItemTemplate>([
        [weaponEntityId, itemTemplate('rusty_sword')],
        [armorEntityId, itemTemplate('plate_armor')],
        [potionEntityId, itemTemplate('health_potion')],
        [bootsEntityId, itemTemplate('leather_boots')],
      ]),
    },
  };
}

function withQuest(state: GameState): GameState {
  const quest: Quest = {
    id: 'fixture_reach_floor_3',
    title: 'Fixture Reach Floor',
    description: 'A stable historical save fixture quest.',
    status: 'active',
    objective: {
      type: 'reach_floor',
      targetCount: 3,
      progress: 1,
    },
    reward: {
      type: 'gold',
      amount: 25,
    },
    giverNpcId: 'fixture_npc',
  };

  return {
    ...state,
    activeQuests: [quest],
  };
}

function activeRunAsStoredFloor(state: GameState, depth: number): StoredFloor {
  if (state.run === null) {
    throw new Error('Expected active run for persisted floor fixture');
  }

  return {
    floor: {
      ...state.run.floor,
      depth,
    },
    enemies: state.run.enemies,
    objects: state.run.objects,
    playerPosition: { ...state.player.position },
    originalEnemyCount: state.run.enemies.size,
    lastSimulatedTurn: state.run.turnCount,
  };
}

function enterDungeon(seed: number): GameState {
  return engine.submitCommand(engine.createNewGame(seed), {
    type: 'TOWN_ACTION',
    action: 'enter_dungeon',
  }).state;
}

function representativeScenarioState(): GameState {
  const scenario = readJson<ScenarioFixture>('fixtures/scenarios/full-feature-e2e-test.json');
  return loadScenario(scenario, scenarioResolvers).state;
}

function buildFixtures(): Readonly<Record<string, GameState>> {
  const dungeonState = enterDungeon(202);
  const combatState = createTestGameStateInCombat();
  const ringState = createTestGameStateWithAbility('ember', {
    enemyPosition: { x: 1, y: 0 },
  });
  const cachedFloorState: GameState = {
    ...dungeonState,
    persistedFloorCache: new Map<number, StoredFloor>([
      [2, activeRunAsStoredFloor(dungeonState, 2)],
    ]),
  };
  const representative = withQuest(withInventoryAndEquipment(representativeScenarioState()));

  return {
    'town-start': engine.createNewGame(101),
    'in-dungeon-basic': dungeonState,
    'in-combat-with-enemy': combatState,
    'inventory-and-equipment': withInventoryAndEquipment(createTestGameState()),
    'ring-spell-known': ringState,
    'quest-in-progress': withQuest(createTestGameState()),
    'persisted-floor-cache': cachedFloorState,
    'representative-full-state': {
      ...representative,
      persistedFloorCache: new Map<number, StoredFloor>([
        [3, activeRunAsStoredFloor(representative, 3)],
      ]),
    },
  };
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const fixtures = buildFixtures();

for (const [name, state] of Object.entries(fixtures)) {
  const snapshot = exportSaveSnapshot(state);
  writeFileSync(
    join(OUTPUT_DIR, `${name}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );
}

console.log(`Generated ${Object.keys(fixtures).length} save fixture(s) in ${OUTPUT_DIR}.`);
