import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import type { DungeonFloor, EnemyInstance, Position, Tile } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import { validateSpawns } from './spawn-validator.js';
import { SeededRNG } from '../utils/rng.js';
import { chebyshevDistance } from '../utils/grid.js';

const FLOOR_TILE: Tile = {
  type: 'floor',
  walkable: true,
  blocksVision: false,
  ascii: '.',
  color: '#aaa',
};

const WALL_TILE: Tile = {
  type: 'wall',
  walkable: false,
  blocksVision: true,
  ascii: '#',
  color: '#666',
};

const SPAWN_VALIDATOR_HARD_CAP = 20;

function createOpenFloor(width: number, height: number): DungeonFloor {
  const cells = new Map<string, DungeonFloor['cells'] extends ReadonlyMap<string, infer Cell> ? Cell : never>();
  const entrance = { x: 1, y: 1 };
  const exit = { x: width - 2, y: height - 2 };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      cells.set(posKey({ x, y }), {
        tile: isBorder ? WALL_TILE : FLOOR_TILE,
        visibility: 'visible',
      });
    }
  }

  return {
    width,
    height,
    depth: 1,
    biomeId: 'fixture_biome',
    cells,
    entrance,
    exit,
    seed: 1,
  };
}

function createEnemy(id: string, position: Position): EnemyInstance {
  return {
    id: entityId(id),
    templateId: 'fixture_enemy',
    name: 'Fixture Enemy',
    archetype: 'fixture',
    tier: 1,
    stats: {
      maxHealth: 10,
      health: 10,
      attack: 2,
      defense: 1,
      accuracy: 70,
      evasion: 5,
      speed: 10,
    },
    equipment: {
      weapon: {
        damageMultiplier: 1,
        damageType: 'physical',
        weaponRange: 1,
      },
    },
    affinities: {},
    spawn: {
      floorRange: [1, 1],
      weight: 1,
    },
    lootTableId: 'fixture_loot',
    experienceValue: 1,
    description: 'Fixture enemy',
    ascii: 'e',
    color: '#f44',
    position,
    statuses: [],
    isAlerted: false,
    lastKnownPlayerPos: null,
  };
}

function safeSpawnPositions(floor: DungeonFloor): readonly Position[] {
  return Array.from(floor.cells.entries())
    .filter(([, cell]) => cell.tile.walkable)
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x!, y: y! };
    })
    .filter((position) => posKey(position) !== posKey(floor.exit))
    .filter((position) => chebyshevDistance(position, floor.entrance) > 2);
}

function buildEnemyMap(positions: readonly Position[]): ReadonlyMap<string, EnemyInstance> {
  return new Map(
    positions.map((position, index) => [
      posKey(position),
      createEnemy(`fixture_enemy_${index}`, position),
    ]),
  );
}

describe('spawn-validator property tests', () => {
  it('accepts locally generated safe spawn layouts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 20 }),
        fc.integer({ min: 6, max: 20 }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: SPAWN_VALIDATOR_HARD_CAP }),
        (width, height, seed, enemyCount) => {
          const floor = createOpenFloor(width, height);
          const rng = new SeededRNG(seed);
          const positions = rng.shuffle(safeSpawnPositions(floor)).slice(0, enemyCount);
          const enemies = buildEnemyMap(positions);

          const validation = validateSpawns(floor, enemies);

          expect(validation.valid).toBe(true);
          for (const enemy of enemies.values()) {
            expect(posKey(enemy.position)).not.toBe(posKey(floor.entrance));
            expect(posKey(enemy.position)).not.toBe(posKey(floor.exit));
            expect(chebyshevDistance(enemy.position, floor.entrance)).toBeGreaterThan(2);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('rejects enemies on protected entrance or exit positions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'entrance' | 'exit'>('entrance', 'exit'),
        (protectedPosition) => {
          const floor = createOpenFloor(8, 8);
          const position = protectedPosition === 'entrance' ? floor.entrance : floor.exit;
          const enemies = buildEnemyMap([position]);

          const validation = validateSpawns(floor, enemies);

          expect(validation.valid).toBe(false);
          expect(validation.issues.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 10 },
    );
  });

  it('rejects enemies within the entrance safety radius', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2, max: 2 }),
        fc.integer({ min: -2, max: 2 }),
        (dx, dy) => {
          fc.pre(dx !== 0 || dy !== 0);
          const floor = createOpenFloor(8, 8);
          const position = { x: floor.entrance.x + dx, y: floor.entrance.y + dy };
          fc.pre(floor.cells.get(posKey(position))?.tile.walkable === true);
          const enemies = buildEnemyMap([position]);

          const validation = validateSpawns(floor, enemies);

          expect(validation.valid).toBe(false);
          expect(validation.issues.some((issue) => issue.includes('too close to entrance'))).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('rejects enemy counts above the validator hard cap', () => {
    const floor = createOpenFloor(12, 12);
    const positions = safeSpawnPositions(floor).slice(0, SPAWN_VALIDATOR_HARD_CAP + 1);
    const enemies = buildEnemyMap(positions);

    const validation = validateSpawns(floor, enemies);

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.includes('Too many enemies'))).toBe(true);
  });
});
