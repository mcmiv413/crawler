import { describe, it, expect } from 'vitest';
import { decideEnemyAction } from './enemy-ai.js';
import { posKey, entityId, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import type { GameState, EnemyInstance, MapCell, RunState } from '@dungeon/contracts';
import { createTestGameState, createTestEnemy } from '../test-utils.js';

const FLOOR_TILE: MapCell = {
  tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
  visibility: 'visible',
};

const WALL_TILE: MapCell = {
  tile: { type: 'wall', walkable: false, blocksVision: true, ascii: '#', color: '#666' },
  visibility: 'visible',
};

function makeOpenCells(width: number, height: number): Map<string, MapCell> {
  const cells = new Map<string, MapCell>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      cells.set(posKey({ x, y }), FLOOR_TILE);
    }
  }
  return cells;
}

function makeAiState(
  playerPos: { x: number; y: number },
  enemy: EnemyInstance,
  extraCells?: Map<string, MapCell>,
): GameState {
  const cells = extraCells ?? makeOpenCells(10, 10);
  const run: RunState = {
    runId: entityId('run1'),
    floor: {
      width: 10,
      height: 10,
      depth: 1,
      biomeId: 'stone_crypt',
      cells,
      entrance: { x: 0, y: 0 },
      exit: { x: 9, y: 9 },
      seed: 42,
    },
    enemies: new Map([[posKey(enemy.position), enemy]]),
    objects: new Map(),
    turnCount: 0,
    isActive: true,
    runMetrics: {} as any,
    floorHistory: [],
    floorCache: new Map(),
    speedAccumulators: {},
    weaponMastery: EMPTY_WEAPON_MASTERY,
  };

  const base = createTestGameState();
  return {
    ...base,
    phase: 'dungeon',
    player: { ...base.player, position: playerPos },
    run,
  };
}

describe('decideEnemyAction', () => {
  it('un-alerted enemy beyond dist 5 returns wait', () => {
    const enemy = createTestEnemy({ position: { x: 0, y: 0 }, isAlerted: false });
    const state = makeAiState({ x: 7, y: 7 }, enemy); // chebyshev dist = 7
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('wait');
  });

  it('un-alerted enemy at dist 4 (within detection) approaches (not wait)', () => {
    const enemy = createTestEnemy({ position: { x: 0, y: 0 }, isAlerted: false });
    const state = makeAiState({ x: 4, y: 0 }, enemy); // chebyshev dist = 4
    const action = decideEnemyAction(enemy, state);
    expect(action.type).not.toBe('wait');
  });

  it('melee_bruiser at dist 1 attacks', () => {
    const enemy = createTestEnemy({ position: { x: 1, y: 0 }, archetype: 'melee_bruiser', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('attack');
  });

  it('melee_bruiser at dist 3 returns move', () => {
    const enemy = createTestEnemy({ position: { x: 4, y: 0 }, archetype: 'melee_bruiser', isAlerted: true });
    const state = makeAiState({ x: 1, y: 0 }, enemy); // chebyshev dist = 3
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('move');
  });

  it('fast_skirmisher at dist 1 retreats (skittish_ranged behavior)', () => {
    // fast_skirmisher maps to skittish_ranged which retreats when adjacent
    const enemy = createTestEnemy({ position: { x: 1, y: 0 }, archetype: 'fast_skirmisher', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    // Should be move (retreat) or wait, not attack
    expect(['move', 'wait'].includes(action.type)).toBe(true);
  });

  it('ambusher at dist 1 attacks', () => {
    const enemy = createTestEnemy({ position: { x: 1, y: 0 }, archetype: 'ambusher', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('attack');
  });

  it('ranged_attacker at dist 1 retreats when open tile exists', () => {
    // Place enemy at (5, 5), player at (4, 5). Enemy can retreat to (6, 5).
    const enemy = createTestEnemy({ position: { x: 5, y: 5 }, archetype: 'ranged_attacker', isAlerted: true });
    const state = makeAiState({ x: 4, y: 5 }, enemy);
    const action = decideEnemyAction(enemy, state);
    // Should retreat (move away from player)
    expect(action.type).toBe('move');
  });

  it('ranged_attacker at dist 1 attacks when cornered (no retreat tile)', () => {
    // Surround the enemy except for the player's tile and the enemy's own tile
    const cells = new Map<string, MapCell>();
    // Enemy at (0, 0), player at (1, 0). Wall on all other sides.
    cells.set(posKey({ x: 0, y: 0 }), FLOOR_TILE);
    cells.set(posKey({ x: 1, y: 0 }), FLOOR_TILE);
    // All other adjacent tiles are walls
    for (let x = -1; x <= 2; x++) {
      for (let y = -1; y <= 1; y++) {
        const key = posKey({ x, y });
        if (!cells.has(key)) cells.set(key, WALL_TILE);
      }
    }

    const enemy = createTestEnemy({ position: { x: 0, y: 0 }, archetype: 'ranged_attacker', isAlerted: true });
    const state = makeAiState({ x: 1, y: 0 }, enemy, cells);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('attack');
  });

  it('ranged_attacker at dist 4 waits or moves (skittish_ranged behavior)', () => {
    // ranged_attacker maps to skittish_ranged which waits at medium distance (range 2-5)
    const enemy = createTestEnemy({ position: { x: 5, y: 0 }, archetype: 'ranged_attacker', isAlerted: true });
    const state = makeAiState({ x: 1, y: 0 }, enemy); // chebyshev dist = 4
    const action = decideEnemyAction(enemy, state);
    // Should be wait or move, not attack
    expect(['wait', 'move'].includes(action.type)).toBe(true);
  });

  it('support_buffer at dist 1 can attack or wait (cautious_defensive)', () => {
    // support_buffer maps to cautious_defensive which attacks when adjacent (weight 2) or waits (weight 2)
    const enemy = createTestEnemy({ position: { x: 5, y: 5 }, archetype: 'support_buffer', isAlerted: true });
    const state = makeAiState({ x: 4, y: 5 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(['attack', 'wait'].includes(action.type)).toBe(true);
  });

  it('support_buffer at dist 3 waits or attacks (cautious_defensive)', () => {
    // cautious_defensive has no specific preference at dist 3, so it defaults to abilities/wait based on rules
    const enemy = createTestEnemy({ position: { x: 4, y: 0 }, archetype: 'support_buffer', isAlerted: true });
    const state = makeAiState({ x: 1, y: 0 }, enemy); // chebyshev dist = 3
    const action = decideEnemyAction(enemy, state);
    expect(['attack', 'wait', 'ability'].includes(action.type)).toBe(true);
  });

  it('support_buffer at dist 6 waits (cautious_defensive)', () => {
    // cautious_defensive holds position at distance, doesn't approach
    const enemy = createTestEnemy({ position: { x: 7, y: 0 }, archetype: 'support_buffer', isAlerted: true });
    const state = makeAiState({ x: 1, y: 0 }, enemy); // chebyshev dist = 6
    const action = decideEnemyAction(enemy, state);
    expect(['wait', 'ability'].includes(action.type)).toBe(true);
  });

  it('enemy surrounded by walls returns wait', () => {
    // Enemy at (5,5), all adjacent cells are walls, player far away
    const cells = new Map<string, MapCell>();
    cells.set(posKey({ x: 5, y: 5 }), FLOOR_TILE);
    // Surround with walls
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        cells.set(posKey({ x: 5 + dx, y: 5 + dy }), WALL_TILE);
      }
    }
    // Player cell
    cells.set(posKey({ x: 0, y: 0 }), FLOOR_TILE);

    const enemy = createTestEnemy({ position: { x: 5, y: 5 }, archetype: 'melee_bruiser', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy, cells);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('wait');
  });

  it('ambusher waits when player is at distance 3 (un-alerted)', () => {
    const enemy = createTestEnemy({ position: { x: 3, y: 0 }, archetype: 'ambusher', isAlerted: false });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('wait');
  });

  it('ambusher approaches when player is at distance 2 (alerted)', () => {
    const enemy = createTestEnemy({ position: { x: 2, y: 0 }, archetype: 'ambusher', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).not.toBe('wait');
  });

  it('ambusher attacks when player is adjacent (alerted)', () => {
    const enemy = createTestEnemy({ position: { x: 1, y: 0 }, archetype: 'ambusher', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('attack');
  });

  it('ranged_attacker at dist 1 with blocked retreat picks valid action', () => {
    // Enemy at (0, 0), player at (1, 0). Wall at (-1, 0) blocks direct retreat.
    // Scoring engine generates only direct retreat move attempt, so it won't be available as action.
    // Enemy should fall back to attack or wait (from archetype rules)
    const cells = new Map<string, MapCell>();
    cells.set(posKey({ x: 0, y: 0 }), FLOOR_TILE);
    cells.set(posKey({ x: 1, y: 0 }), FLOOR_TILE);
    cells.set(posKey({ x: -1, y: 0 }), WALL_TILE); // Direct retreat is blocked
    cells.set(posKey({ x: 0, y: -1 }), FLOOR_TILE); // Other tiles open
    cells.set(posKey({ x: 0, y: 1 }), FLOOR_TILE);

    const enemy = createTestEnemy({ position: { x: 0, y: 0 }, archetype: 'ranged_attacker', isAlerted: true });
    const state = makeAiState({ x: 1, y: 0 }, enemy, cells);
    const action = decideEnemyAction(enemy, state);
    // Should pick a valid action from archetype rules (attack, wait, or nothing)
    expect(['attack', 'wait', 'ability'].includes(action.type)).toBe(true);
  });

  it('computeRetreat returns the tile that maximizes distance from player', () => {
    // Enemy at (5, 5), player at (4, 5). Options: (6, 5) dist=2, (5, 6) dist=2, (5, 4) dist=2, etc.
    // (6, 5) should be preferred as it moves away along the attack axis
    const enemy = createTestEnemy({ position: { x: 5, y: 5 }, archetype: 'ranged_attacker', isAlerted: true });
    const state = makeAiState({ x: 4, y: 5 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('move');
    // Should move away from player (east)
    expect(action.targetPosition).toEqual({ x: 6, y: 5 });
  });

  it('fast_skirmisher waits at distance 2 instead of approaching', () => {
    const enemy = createTestEnemy({ position: { x: 2, y: 0 }, archetype: 'fast_skirmisher', isAlerted: true });
    const state = makeAiState({ x: 0, y: 0 }, enemy);
    const action = decideEnemyAction(enemy, state);
    expect(action.type).toBe('wait');
  });

  it('decideEnemyAction pursues lastKnownPlayerPos when player is out of detection range', () => {
    const enemy = createTestEnemy({
      position: { x: 0, y: 0 },
      archetype: 'melee_bruiser',
      isAlerted: true,
      lastKnownPlayerPos: { x: 5, y: 5 },
    });
    const state = makeAiState({ x: 9, y: 9 }, enemy); // Player is 9 away, out of detection range
    const action = decideEnemyAction(enemy, state);
    // Should approach last known position, not wait
    expect(action.type).toBe('move');
  });
});
