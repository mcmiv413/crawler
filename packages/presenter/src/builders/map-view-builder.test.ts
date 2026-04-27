import { describe, it, expect } from 'vitest';
import { buildMapView } from './map-view-builder.js';
import { entityId, posKey } from '@dungeon/contracts';
import type { GameState } from '@dungeon/contracts';

function createTestGameState(playerPos = { x: 5, y: 5 }): GameState {
  return {
    gameId: entityId('g1'),
    phase: 'dungeon',
    player: {
      id: entityId('p1'),
      name: 'Hero',
      level: 1,
      experience: 0,
      stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
      baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
      position: playerPos,
      equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      inventory: [],
      statuses: [],
      abilities: [],
      gold: 0,
      floor: 1,
      totalKills: 0,
      totalDeaths: 0,
      totalRuns: 0,
      deathStash: null,
    },
    run: {
      runId: entityId('run1'),
      floor: {
        width: 20,
        height: 20,
        depth: 1,
        biomeId: 'crypt',
        cells: new Map([[posKey(playerPos), { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#888' }, visibility: 'visible' }]]),
        entrance: { x: 0, y: 0 },
        exit: { x: 19, y: 19 },
        seed: 123,
      },
      enemies: new Map(),
      objects: new Map([
        // Object at same position as player
        [
          posKey(playerPos),
          {
            id: entityId('obj1'),
            templateId: 'gold_coin',
            position: playerPos,
            isExhausted: false,
          },
        ],
      ]),
      turnCount: 1,
      isActive: true,
      floorHistory: [],
      speedAccumulators: {},
    },
    weaponMastery: { blade: 0, bludgeon: 0, axe: 0, ranged: 0, dagger: 0 },
    world: {
      town: { prosperity: 50, fear: 0, corruption: 0, rumors: [], lastRunSummary: null },
      npcs: [],
      shop: { items: [], buybackMultiplier: 0.4 },
      eventHistory: [],
      totalRuns: 0,
      deepestFloor: 0,
      nemeses: [],
      factions: [],
      unlockedBlueprints: [],
      highestRarityFound: 'common',
    },
    itemRegistry: { items: new Map() },
    seed: 42,
    turnNumber: 1,
    version: 1,
    activeQuests: [],
  };
}

describe('buildMapView', () => {
  it('renders player on top of objects at same position', () => {
    const state = createTestGameState();
    const mapView = buildMapView(state);
    expect(mapView).not.toBeNull();
    if (!mapView) return;

    // Find indices of player and object in entities array
    const playerIndex = mapView.entities.findIndex((e) => e.id === state.player.id);
    const objectIndex = mapView.entities.findIndex((e) => e.id === entityId('obj1'));

    // Player should appear after object (higher z-index)
    expect(playerIndex).toBeGreaterThan(objectIndex);
    expect(playerIndex).toBeGreaterThanOrEqual(0);
    expect(objectIndex).toBeGreaterThanOrEqual(0);
  });

  it('renders enemies before player', () => {
    const state = createTestGameState();
    if (state.run) {
      const enemyMap = state.run.enemies as any;
      enemyMap.set(posKey({ x: 6, y: 6 }), {
        id: entityId('enemy1'),
        templateId: 'goblin',
        position: { x: 6, y: 6 },
        stats: { health: 10, maxHealth: 10, attack: 5, defense: 2, accuracy: 75, evasion: 10, speed: 50 },
        statuses: [],
        fleeing: false,
        damageLog: [],
        ascii: 'g',
        color: '#0f0',
        name: 'Goblin',
      });
    }

    const mapView = buildMapView(state);
    expect(mapView).not.toBeNull();
    if (!mapView) return;

    const playerIndex = mapView.entities.findIndex((e) => e.id === state.player.id);
    const enemyIndex = mapView.entities.findIndex((e) => e.id === entityId('enemy1'));

    // Player should appear after enemy
    expect(playerIndex).toBeGreaterThan(enemyIndex);
    expect(playerIndex).toBe(mapView.entities.length - 1); // Player is last
  });
});
