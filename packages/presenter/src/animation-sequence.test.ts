/**
 * Test layer: unit
 * Behavior: buildAnimationSequence converts movement, attack, ability, status, and visibility-filtered events into ordered non-overlapping animation beats with stable timing and action-time target positions.
 * Proof: Assertions inspect beat indexes, beat IDs, delays, bump timing, damage and ability positions, hidden beat filtering, lightning animation IDs, empty no-run output, and getAnimatedEventBatchSettleMs matching getBeatSettleMs.
 * Validation: pnpm vitest run packages/presenter/src/animation-sequence.test.ts
 */
import { describe, expect, it } from 'vitest';
import { entityId, type DomainEvent, type EntityId, type GameState } from '@dungeon/contracts';
import { createTestEnemy, createTestGameStateInCombat } from '@dungeon/core/testing';
import { getBeatSettleMs } from './animation-metadata.js';
import {
  buildAnimationSequence,
  getAnimatedEventBatchSettleMs,
  getBumpTiming,
  type AnimatedEvent,
} from './animation-sequence.js';

const LIGHTNING_STRIKE_ANIMATION_ID = 'fx.impact.lightning-strike';
const RADIAL_IMPACT_BURST_ANIMATION_ID = 'fx.impact.radial-impact-burst';

function createMockGameState(): GameState {
  const baseState = createTestGameStateInCombat();
  const visibleFloorCell = {
    tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
    visibility: 'visible' as const,
  };
  const visiblePositions = [
    { x: 49, y: 50 },
    { x: 50, y: 50 },
    { x: 51, y: 49 },
    { x: 51, y: 50 },
    { x: 52, y: 49 },
    { x: 52, y: 50 },
    { x: 53, y: 50 },
  ];
  const cells = new Map<string, typeof visibleFloorCell>();
  for (const position of visiblePositions) {
    cells.set(`${position.x},${position.y}`, visibleFloorCell);
  }

  return {
    ...baseState,
    gameId: entityId('game-1'),
    player: {
      ...baseState.player,
      id: entityId('player-1'),
      position: { x: 50, y: 50 },
      stats: {
        ...baseState.player.stats,
        maxHealth: 100,
        health: 100,
        attack: 10,
        defense: 5,
        accuracy: 75,
        evasion: 20,
        speed: 12,
      },
      baseStats: {
        ...baseState.player.baseStats,
        maxHealth: 100,
        health: 100,
        attack: 10,
        defense: 5,
        accuracy: 75,
        evasion: 20,
        speed: 12,
      },
    },
    run: {
      ...baseState.run!,
      runId: entityId('run-1'),
      floor: {
        ...baseState.run!.floor,
        width: 100,
        height: 100,
        cells,
        entrance: { x: 0, y: 0 },
        exit: { x: 99, y: 99 },
        seed: 42,
      },
      enemies: new Map([
        [
          'enemy-1',
          createTestEnemy({
            id: entityId('enemy-1'),
            name: 'Slow Goblin',
            templateId: 'goblin',
            archetype: 'brute',
            position: { x: 51, y: 50 },
            stats: {
              maxHealth: 20,
              health: 20,
              attack: 5,
              defense: 2,
              accuracy: 70,
              evasion: 10,
              speed: 8,
            },
          }),
        ],
        [
          'enemy-2',
          createTestEnemy({
            id: entityId('enemy-2'),
            name: 'Fast Orc',
            templateId: 'orc',
            archetype: 'rogue',
            position: { x: 52, y: 50 },
            stats: {
              maxHealth: 30,
              health: 30,
              attack: 8,
              defense: 3,
              accuracy: 75,
              evasion: 15,
              speed: 15,
            },
          }),
        ],
        [
          'enemy-3',
          createTestEnemy({
            id: entityId('enemy-3'),
            name: 'Guard',
            templateId: 'orc',
            archetype: 'guardian',
            position: { x: 53, y: 50 },
            stats: {
              maxHealth: 32,
              health: 32,
              attack: 7,
              defense: 4,
              accuracy: 72,
              evasion: 12,
              speed: 10,
            },
          }),
        ],
      ]),
      objects: new Map(),
      turnCount: 1,
      isActive: true,
      floorHistory: [],
      speedAccumulators: {},
    },
    world: {
      ...baseState.world,
      eventHistory: [],
      totalRuns: 0,
      deepestFloor: 1,
    },
    itemRegistry: { items: new Map() },
    seed: 42,
    turnNumber: 1,
    version: 1,
    activeQuests: [],
  };
}

function floorCell(visibility: 'visible' | 'remembered' | 'hidden') {
  return {
    tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
    visibility,
  };
}

function withCellVisibilities(
  state: GameState,
  cells: readonly {
    readonly x: number;
    readonly y: number;
    readonly visibility: 'visible' | 'remembered' | 'hidden';
  }[],
): GameState {
  if (state.run === null) {
    return state;
  }

  const nextCells = new Map(state.run.floor.cells);
  for (const cell of cells) {
    nextCells.set(`${cell.x},${cell.y}`, floorCell(cell.visibility));
  }

  return {
    ...state,
    run: {
      ...state.run,
      floor: {
        ...state.run.floor,
        cells: nextCells,
      },
    },
  };
}

function withEnemies(
  state: GameState,
  enemies: readonly ReturnType<typeof createTestEnemy>[],
): GameState {
  if (state.run === null) {
    return state;
  }

  return {
    ...state,
    run: {
      ...state.run,
      enemies: new Map(enemies.map((enemy) => [enemy.id, enemy])),
    },
  };
}

function createAttackEvent(args: {
  attackerId: EntityId;
  defenderId: EntityId;
  timestamp: number;
  damage?: number;
  position?: { readonly x: number; readonly y: number };
}): DomainEvent {
  return {
    type: 'ATTACK_PERFORMED',
    timestamp: args.timestamp,
    turnNumber: 1,
    attackerId: args.attackerId,
    defenderId: args.defenderId,
    attackerName: String(args.attackerId),
    defenderName: String(args.defenderId),
    damage: args.damage ?? 8,
    damageType: 'physical',
    hit: true,
    critical: false,
    position: args.position ?? defaultPositionForEntity(args.defenderId),
  } as DomainEvent;
}

function defaultPositionForEntity(entityIdValue: EntityId): { readonly x: number; readonly y: number } {
  switch (entityIdValue) {
    case entityId('player-1'):
      return { x: 50, y: 50 };
    case entityId('enemy-2'):
      return { x: 52, y: 50 };
    case entityId('enemy-3'):
      return { x: 53, y: 50 };
    case entityId('enemy-1'):
    default:
      return { x: 51, y: 50 };
  }
}

function groupByBeat(sequence: ReturnType<typeof buildAnimationSequence>) {
  const beats = new Map<string, AnimatedEvent[]>();
  for (const event of sequence) {
    const beat = beats.get(event.beatId);
    if (beat === undefined) {
      beats.set(event.beatId, [event]);
      continue;
    }
    beat.push(event);
  }

  return Array.from(beats.values()).sort((a, b) => a[0]!.beatIndex - b[0]!.beatIndex);
}

describe('buildAnimationSequence', () => {
  const mockGameState = createMockGameState();

  it('groups actor events into ordered beats with shared beat ids', () => {
    const events: DomainEvent[] = [
      {
        type: 'PLAYER_MOVED',
        timestamp: 1000,
        turnNumber: 1,
        from: { x: 49, y: 50 },
        to: { x: 50, y: 50 },
      } as DomainEvent,
      {
        type: 'ENEMY_MOVED',
        timestamp: 1001,
        turnNumber: 1,
        enemyId: entityId('enemy-2'),
        from: { x: 52, y: 49 },
        to: { x: 52, y: 50 },
      } as DomainEvent,
      {
        type: 'ENEMY_MOVED',
        timestamp: 1002,
        turnNumber: 1,
        enemyId: entityId('enemy-1'),
        from: { x: 51, y: 49 },
        to: { x: 51, y: 50 },
      } as DomainEvent,
    ];

    const sequence = buildAnimationSequence(events, mockGameState);
    const beats = groupByBeat(sequence);

    expect(beats).toHaveLength(3);
    expect(beats.map((beat) => beat[0]!.beatIndex)).toEqual([0, 1, 2]);
    expect(new Set(sequence.map((event) => event.beatId)).size).toBe(3);
    expect(beats.map((beat) => beat[0]!.beatRelativeDelayMs)).toEqual([0, 0, 0]);

    const [playerMove, fastEnemyMove, slowEnemyMove] = sequence;
    expect(playerMove?.type).toBe('move');
    expect((playerMove?.data as { entityId: string }).entityId).toBe(entityId('player-1'));
    expect(playerMove?.data).toMatchObject({
      style: 'step',
      durationMs: 140,
    });
    expect(fastEnemyMove?.data).toMatchObject({
      entityId: entityId('enemy-2'),
      style: 'step',
      durationMs: 140,
    });
    expect(slowEnemyMove?.data).toMatchObject({
      entityId: entityId('enemy-1'),
      style: 'step',
      durationMs: 140,
    });
    expect(fastEnemyMove!.delayMs).toBeGreaterThanOrEqual(playerMove!.delayMs + (playerMove!.data as { durationMs: number }).durationMs);
  });

  it('uses fixed bump timing for player and enemy attacks', () => {
    expect(getBumpTiming(entityId('player-1'), mockGameState)).toEqual({
      durationMs: 300,
      impactFrameMs: 150,
    });
    expect(getBumpTiming(entityId('enemy-1'), mockGameState)).toEqual({
      durationMs: 300,
      impactFrameMs: 150,
    });
  });

  it('emits fixed-duration bump events for attacks', () => {
    const sequence = buildAnimationSequence([
      createAttackEvent({
        attackerId: entityId('player-1'),
        defenderId: entityId('enemy-1'),
        timestamp: 1000,
      }),
    ], mockGameState);

    const bump = sequence.find((event) => event.type === 'bump');

    expect(bump?.data).toMatchObject({
      durationMs: 300,
      impactFrameMs: 150,
    });
  });

  it('anchors attack damage and defender bump to event position when the defender moved later in the batch', () => {
    const movedEnemy = createTestEnemy({
      id: entityId('enemy-1'),
      name: 'Slow Goblin',
      templateId: 'goblin',
      archetype: 'brute',
      position: { x: 51, y: 49 },
    });
    const finalState = withEnemies(
      mockGameState,
      [movedEnemy, ...[...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1'))],
    );
    const sequence = buildAnimationSequence([
      createAttackEvent({
        attackerId: entityId('player-1'),
        defenderId: entityId('enemy-1'),
        timestamp: 1000,
        position: { x: 51, y: 50 },
      }),
      {
        type: 'ENEMY_MOVED',
        timestamp: 1001,
        turnNumber: 1,
        enemyId: entityId('enemy-1'),
        from: { x: 51, y: 50 },
        to: { x: 51, y: 49 },
      } as DomainEvent,
    ], finalState);
    const bump = sequence.find((event) => event.type === 'bump');
    const damage = sequence.find((event) => event.type === 'damage');

    expect((bump?.data as { defenderPos?: { x: number; y: number } }).defenderPos).toEqual({ x: 51, y: 50 });
    expect(damage?.data).toMatchObject({ x: 51, y: 50 });
  });

  it('keeps attack damage visible at event position when the defender is gone from final state', () => {
    const finalState = withEnemies(
      mockGameState,
      [...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1')),
    );
    const sequence = buildAnimationSequence([
      createAttackEvent({
        attackerId: entityId('player-1'),
        defenderId: entityId('enemy-1'),
        timestamp: 1000,
        position: { x: 51, y: 50 },
      }),
    ], finalState);
    const damage = sequence.find((event) => event.type === 'damage');

    expect(damage?.data).toMatchObject({ x: 51, y: 50 });
  });

  it('anchors ability impacts at the ref impact frame within a beat', () => {
    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      timestamp: 1000,
      turnNumber: 1,
      playerId: entityId('player-1'),
      abilityId: 'power_strike',
      abilityName: 'Power Strike',
      targetId: entityId('enemy-1'),
      targetName: 'Slow Goblin',
      hit: true,
      damage: 12,
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, mockGameState);
    const ability = sequence.find((event) => event.type === 'ability');
    const damage = sequence.find((event) => event.type === 'damage');

    expect(ability).toBeDefined();
    expect(damage).toBeDefined();
    expect(ability?.beatIndex).toBe(0);
    expect(ability?.beatRelativeDelayMs).toBe(0);
    const impactFrameMs = (ability?.data as { impactFrameMs: number }).impactFrameMs;
    expect(impactFrameMs).toBeGreaterThan(0);
    expect(damage?.beatId).toBe(ability?.beatId);
    expect(damage?.beatRelativeDelayMs).toBe(impactFrameMs);
    expect(damage?.delayMs).toBe(ability!.delayMs + impactFrameMs);
  });

  it('does not reserve a player beat for wait turns with enemy-only actions', () => {
    const events: DomainEvent[] = [
      createAttackEvent({ attackerId: entityId('enemy-2'), defenderId: entityId('player-1'), timestamp: 1000 }),
      createAttackEvent({ attackerId: entityId('enemy-1'), defenderId: entityId('player-1'), timestamp: 1001 }),
    ];

    const sequence = buildAnimationSequence(events, mockGameState);
    const bumps = sequence.filter((event) => event.type === 'bump');

    expect(new Set(sequence.map((event) => event.beatIndex))).toEqual(new Set([0, 1]));
    expect((bumps[0]!.data as { attackerId: string }).attackerId).toBe(entityId('enemy-2'));
    expect((bumps[1]!.data as { attackerId: string }).attackerId).toBe(entityId('enemy-1'));
  });

  it('keeps multi-victim impacts on the same frame within a beat', () => {
    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      timestamp: 1000,
      turnNumber: 1,
      playerId: entityId('player-1'),
      abilityId: 'axe_cleave',
      abilityName: 'Axe Cleave',
      hit: true,
      damageByTarget: new Map([
        [entityId('enemy-1'), 5],
        [entityId('enemy-2'), 7],
      ]),
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, mockGameState);
    const ability = sequence.find((event) => event.type === 'ability');
    const damages = sequence.filter((event) => event.type === 'damage');

    expect(ability).toBeDefined();
    expect(damages).toHaveLength(2);
    expect(new Set(damages.map((event) => event.beatId))).toEqual(new Set([ability!.beatId]));
    const impactFrameMs = (ability?.data as { impactFrameMs: number }).impactFrameMs;
    expect(new Set(damages.map((event) => event.beatRelativeDelayMs))).toEqual(new Set([impactFrameMs]));
  });

  it('anchors single-target ability FX and impact flashes to action-time snapshots for killed targets', () => {
    const deadTargetState = withEnemies(
      mockGameState,
      [...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1')),
    );
    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      timestamp: 1000,
      turnNumber: 1,
      playerId: entityId('player-1'),
      abilityId: 'power_strike',
      abilityName: 'Power Strike',
      targetId: entityId('enemy-1'),
      targetName: 'Slow Goblin',
      hit: true,
      damage: 12,
      targetSnapshots: [{
        targetId: entityId('enemy-1'),
        position: { x: 51, y: 50 },
      }],
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, deadTargetState);
    const ability = sequence.find((event) => event.type === 'ability');
    const damage = sequence.find((event) => event.type === 'damage');
    const defenderHit = sequence.find((event) => event.type === 'defender-hit');

    expect((ability?.data as { targetPos?: { x: number; y: number } }).targetPos).toEqual({ x: 51, y: 50 });
    expect((ability?.data as { selfTargeted?: boolean }).selfTargeted).toBe(false);
    expect(damage?.data).toMatchObject({ x: 51, y: 50 });
    expect(defenderHit?.data).toMatchObject({
      entityId: entityId('enemy-1'),
      position: { x: 51, y: 50 },
    });
  });

  it('keeps spell targeting on the pre-move tile when the target moves later in the batch', () => {
    const movedEnemy = createTestEnemy({
      id: entityId('enemy-1'),
      name: 'Slow Goblin',
      templateId: 'goblin',
      archetype: 'brute',
      position: { x: 51, y: 49 },
      stats: {
        maxHealth: 20,
        health: 8,
        attack: 5,
        defense: 2,
        accuracy: 70,
        evasion: 10,
        speed: 8,
      },
    });
    const finalState = withEnemies(
      mockGameState,
      [movedEnemy, ...[...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1'))],
    );
    const events: DomainEvent[] = [
      {
        type: 'ABILITY_USED',
        timestamp: 1000,
        turnNumber: 1,
        playerId: entityId('player-1'),
        abilityId: 'power_strike',
        abilityName: 'Power Strike',
        targetId: entityId('enemy-1'),
        targetName: 'Slow Goblin',
        hit: true,
        damage: 12,
        targetSnapshots: [{
          targetId: entityId('enemy-1'),
          position: { x: 51, y: 50 },
        }],
      } as DomainEvent,
      {
        type: 'ENEMY_MOVED',
        timestamp: 1001,
        turnNumber: 1,
        enemyId: entityId('enemy-1'),
        from: { x: 51, y: 50 },
        to: { x: 51, y: 49 },
      } as DomainEvent,
    ];

    const sequence = buildAnimationSequence(events, finalState);
    const ability = sequence.find((event) => event.type === 'ability');
    const damage = sequence.find((event) => event.type === 'damage');
    const move = sequence.find((event) => event.type === 'move');

    expect((ability?.data as { targetPos?: { x: number; y: number } }).targetPos).toEqual({ x: 51, y: 50 });
    expect(damage?.data).toMatchObject({ x: 51, y: 50 });
    expect((move?.data as { fromPos: { x: number; y: number }; toPos: { x: number; y: number } })).toMatchObject({
      fromPos: { x: 51, y: 50 },
      toPos: { x: 51, y: 49 },
    });
    expect(move!.delayMs).toBeGreaterThan(ability!.delayMs);
  });

  it('uses status damage event position when the target moved later in the batch', () => {
    const movedEnemy = createTestEnemy({
      id: entityId('enemy-1'),
      name: 'Slow Goblin',
      templateId: 'goblin',
      archetype: 'brute',
      position: { x: 51, y: 49 },
    });
    const finalState = withEnemies(
      mockGameState,
      [movedEnemy, ...[...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1'))],
    );
    const events: DomainEvent[] = [
      {
        type: 'STATUS_DAMAGE_TICK',
        timestamp: 1000,
        turnNumber: 1,
        targetId: entityId('enemy-1'),
        targetName: 'Slow Goblin',
        statusId: 'burn',
        damage: 4,
        damageType: 'fire',
        position: { x: 51, y: 50 },
      } as DomainEvent,
      {
        type: 'ENEMY_MOVED',
        timestamp: 1001,
        turnNumber: 1,
        enemyId: entityId('enemy-1'),
        from: { x: 51, y: 50 },
        to: { x: 51, y: 49 },
      } as DomainEvent,
    ];

    const sequence = buildAnimationSequence(events, finalState);
    const damage = sequence.find((event) => event.type === 'damage');

    expect(damage?.data).toMatchObject({ text: '-4', x: 51, y: 50 });
  });

  it('keeps status damage visible at event position when the target is gone from final state', () => {
    const finalState = withEnemies(
      mockGameState,
      [...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1')),
    );
    const events: DomainEvent[] = [{
      type: 'STATUS_DAMAGE_TICK',
      timestamp: 1000,
      turnNumber: 1,
      targetId: entityId('enemy-1'),
      targetName: 'Slow Goblin',
      statusId: 'burn',
      damage: 4,
      damageType: 'fire',
      position: { x: 51, y: 50 },
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, finalState);
    const damage = sequence.find((event) => event.type === 'damage');

    expect(damage?.data).toMatchObject({ text: '-4', x: 51, y: 50 });
  });

  it('prefers status damage targetPosition when the dead target is gone from final state', () => {
    const finalState = withEnemies(
      mockGameState,
      [...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id !== entityId('enemy-1')),
    );
    const events: DomainEvent[] = [
      {
        type: 'STATUS_DAMAGE_TICK',
        timestamp: 1000,
        turnNumber: 1,
        targetId: entityId('enemy-1'),
        targetName: 'Slow Goblin',
        statusId: 'burn',
        damage: 4,
        damageType: 'fire',
        position: { x: 0, y: 0 },
        targetPosition: { x: 51, y: 50 },
        preHealth: 1,
        postHealth: 0,
        maxHealth: 10,
        killed: true,
        causeType: 'status',
      } as DomainEvent,
      {
        type: 'ENTITY_DIED',
        timestamp: 1000,
        turnNumber: 1,
        entityId: entityId('enemy-1'),
        entityName: 'Slow Goblin',
        killerId: entityId('player-1'),
        entityPosition: { x: 51, y: 50 },
        causeType: 'status',
      } as DomainEvent,
    ];

    const sequence = buildAnimationSequence(events, finalState);
    const damage = sequence.find((event) => event.type === 'damage');

    expect(damage?.data).toMatchObject({ text: '-4', x: 51, y: 50 });
  });

  it('preserves multi-target blast and damage positions when affected enemies die before the final state', () => {
    const finalState = withEnemies(
      mockGameState,
      [...mockGameState.run!.enemies.values()].filter((enemy) => enemy.id === entityId('enemy-3')),
    );
    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      timestamp: 1000,
      turnNumber: 1,
      playerId: entityId('player-1'),
      abilityId: 'axe_cleave',
      abilityName: 'Axe Cleave',
      hit: true,
      damageByTarget: new Map([
        [entityId('enemy-1'), 5],
        [entityId('enemy-2'), 7],
      ]),
      targetSnapshots: [
        {
          targetId: entityId('enemy-1'),
          position: { x: 51, y: 50 },
        },
        {
          targetId: entityId('enemy-2'),
          position: { x: 52, y: 50 },
        },
      ],
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, finalState);
    const ability = sequence.find((event) => event.type === 'ability');
    const damages = sequence.filter((event) => event.type === 'damage');

    expect((ability?.data as { blastPositions: readonly { x: number; y: number }[] }).blastPositions).toEqual([
      { x: 51, y: 50 },
      { x: 52, y: 50 },
    ]);
    expect(damages.map((event) => event.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 51, y: 50, text: '-5' }),
        expect.objectContaining({ x: 52, y: 50, text: '-7' }),
      ]),
    );
  });

  it('guarantees beats do not overlap', () => {
    const events: DomainEvent[] = [
      {
        type: 'ABILITY_USED',
        timestamp: 1000,
        turnNumber: 1,
        playerId: entityId('player-1'),
        abilityId: 'power_strike',
        abilityName: 'Power Strike',
        targetId: entityId('enemy-1'),
        targetName: 'Slow Goblin',
        hit: true,
        damage: 12,
      } as DomainEvent,
      createAttackEvent({ attackerId: entityId('enemy-2'), defenderId: entityId('player-1'), timestamp: 1001 }),
      createAttackEvent({ attackerId: entityId('enemy-1'), defenderId: entityId('player-1'), timestamp: 1002 }),
    ];

    const sequence = buildAnimationSequence(events, mockGameState);
    const beats = groupByBeat(sequence);

    expect(beats).toHaveLength(3);
    for (let i = 0; i < beats.length - 1; i += 1) {
      const currentBeat = beats[i]!;
      const nextBeat = beats[i + 1]!;
      const currentBeatEnd = getAnimatedEventBatchSettleMs(currentBeat);
      const nextBeatStart = Math.min(...nextBeat.map((event) => event.delayMs));
      expect(nextBeatStart).toBeGreaterThanOrEqual(currentBeatEnd);
    }
  });

  it('uses presenter-owned beat settle calculation for batch settling', () => {
    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      timestamp: 1000,
      turnNumber: 1,
      playerId: entityId('player-1'),
      abilityId: 'power_strike',
      abilityName: 'Power Strike',
      targetId: entityId('enemy-1'),
      targetName: 'Slow Goblin',
      hit: true,
      damage: 12,
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, mockGameState);
    const ability = sequence.find((event) => event.type === 'ability');
    const hitStop = sequence.find((event) => event.type === 'hit-stop');
    expect(ability).toBeDefined();
    const { durationMs, impactFrameMs, recoveryMs, hitStopMs } = ability!.data as {
      durationMs: number;
      impactFrameMs: number;
      recoveryMs: number;
      hitStopMs?: number;
    };

    expect(getAnimatedEventBatchSettleMs(sequence)).toBe(getBeatSettleMs({
      durationMs,
      impactFrameMs,
      recoveryMs,
      hitStopMs: Math.max(hitStopMs ?? 0, (hitStop?.data as { durationMs: number } | undefined)?.durationMs ?? 0),
    }));
  });

  it('returns empty array when run is null', () => {
    const stateNoRun = { ...mockGameState, run: null } as GameState;
    const events: DomainEvent[] = [
      createAttackEvent({ attackerId: entityId('player-1'), defenderId: entityId('enemy-1'), timestamp: 1000 }),
    ];

    const sequence = buildAnimationSequence(events, stateNoRun);

    expect(sequence).toHaveLength(0);
  });

  it('collapses fully hidden enemy beats without reordering later visible beats', () => {
    const state = withCellVisibilities(mockGameState, [
      { x: 49, y: 50, visibility: 'visible' },
      { x: 50, y: 50, visibility: 'visible' },
      { x: 51, y: 49, visibility: 'visible' },
      { x: 51, y: 50, visibility: 'visible' },
      { x: 52, y: 49, visibility: 'hidden' },
      { x: 52, y: 50, visibility: 'hidden' },
    ]);
    const events: DomainEvent[] = [
      {
        type: 'PLAYER_MOVED',
        timestamp: 1000,
        turnNumber: 1,
        from: { x: 49, y: 50 },
        to: { x: 50, y: 50 },
      } as DomainEvent,
      {
        type: 'ENEMY_MOVED',
        timestamp: 1001,
        turnNumber: 1,
        enemyId: entityId('enemy-2'),
        from: { x: 52, y: 49 },
        to: { x: 52, y: 50 },
      } as DomainEvent,
      {
        type: 'ENEMY_MOVED',
        timestamp: 1002,
        turnNumber: 1,
        enemyId: entityId('enemy-1'),
        from: { x: 51, y: 49 },
        to: { x: 51, y: 50 },
      } as DomainEvent,
    ];

    const sequence = buildAnimationSequence(events, state);
    const beats = groupByBeat(sequence);

    expect(beats).toHaveLength(2);
    expect(sequence.map((event) => (event.data as { entityId?: string }).entityId).filter(Boolean)).toEqual([
      entityId('player-1'),
      entityId('enemy-1'),
    ]);
    expect(new Set(sequence.map((event) => event.beatIndex))).toEqual(new Set([0, 1]));
  });

  it('keeps visible-entering enemy movement beats', () => {
    const state = withCellVisibilities(mockGameState, [
      { x: 52, y: 49, visibility: 'hidden' },
      { x: 52, y: 50, visibility: 'visible' },
    ]);
    const events: DomainEvent[] = [{
      type: 'ENEMY_MOVED',
      timestamp: 1000,
      turnNumber: 1,
      enemyId: entityId('enemy-2'),
      from: { x: 52, y: 49 },
      to: { x: 52, y: 50 },
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, state);

    expect(sequence).toHaveLength(1);
    expect(sequence[0]?.type).toBe('move');
    expect((sequence[0]?.data as { entityId: string }).entityId).toBe(entityId('enemy-2'));
  });

  it('keeps visible-leaving enemy movement beats', () => {
    const state = withCellVisibilities(mockGameState, [
      { x: 52, y: 49, visibility: 'visible' },
      { x: 52, y: 50, visibility: 'hidden' },
    ]);
    const events: DomainEvent[] = [{
      type: 'ENEMY_MOVED',
      timestamp: 1000,
      turnNumber: 1,
      enemyId: entityId('enemy-2'),
      from: { x: 52, y: 49 },
      to: { x: 52, y: 50 },
    } as DomainEvent];

    const sequence = buildAnimationSequence(events, state);

    expect(sequence).toHaveLength(1);
    expect(sequence[0]?.type).toBe('move');
    expect((sequence[0]?.data as { entityId: string }).entityId).toBe(entityId('enemy-2'));
  });

  it('renders thunder_step lightning strikes at both departure and arrival positions while preserving damage positions for removed targets', () => {
    const state = withEnemies(createMockGameState(), []);
    const departurePos = { x: 49, y: 50 };
    const arrivalPos = { x: 52, y: 50 };

    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      playerId: entityId('player-1'),
      abilityId: 'thunder_step',
      abilityName: 'Thunder Step',
      hit: true,
      timestamp: 1,
      turnNumber: 1,
      targetSnapshots: [
        { targetId: entityId('departure_49_50'), position: departurePos },
        { targetId: entityId('arrival_52_50'), position: arrivalPos },
        { targetId: entityId('enemy-1'), position: { x: 51, y: 50 } },
        { targetId: entityId('enemy-2'), position: { x: 52, y: 50 } },
      ],
      damageByTarget: new Map([
        [entityId('enemy-1'), 5],
        [entityId('enemy-2'), 5],
      ]),
    }];

    const sequence = buildAnimationSequence(events, state);
    const damages = sequence.filter(e => e.type === 'damage');

    expect(sequence.some(e => e.type === 'ability')).toBe(true);
    const abilityEvent = sequence.find(e => e.type === 'ability');
    expect(abilityEvent).toBeDefined();
    const abilityData = abilityEvent?.data as { blastPositions?: readonly { x: number; y: number }[] };
    expect(abilityData.blastPositions).toBeDefined();
    expect(abilityData.blastPositions).toHaveLength(2);
    expect(abilityData.blastPositions).toContainEqual(departurePos);
    expect(abilityData.blastPositions).toContainEqual(arrivalPos);
    expect(damages).toHaveLength(2);
    expect(damages.map(event => event.data)).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 51, y: 50, text: '-5' }),
      expect.objectContaining({ x: 52, y: 50, text: '-5' }),
    ]));
  });

  it('renders thunderstorm lightning strikes at each struck enemy position', () => {
    const state = createMockGameState();
    const strikePos1 = { x: 51, y: 49 };
    const strikePos2 = { x: 52, y: 49 };

    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      playerId: entityId('player-1'),
      abilityId: 'thunderstorm',
      abilityName: 'Thunderstorm Strike',
      hit: true,
      timestamp: 1,
      turnNumber: 1,
      targetSnapshots: [
        { targetId: entityId('enemy-1'), position: strikePos1 },
        { targetId: entityId('enemy-2'), position: strikePos2 },
      ],
    }];

    const sequence = buildAnimationSequence(events, state);

    expect(sequence.some(e => e.type === 'ability')).toBe(true);
    const abilityEvent = sequence.find(e => e.type === 'ability');
    expect(abilityEvent).toBeDefined();
    const abilityData = abilityEvent?.data as {
      animationId?: string;
      blastPositions?: readonly { x: number; y: number }[];
    };
    expect(abilityData.animationId).toBe(LIGHTNING_STRIKE_ANIMATION_ID);
    expect(abilityData.blastPositions).toBeDefined();
    expect(abilityData.blastPositions).toHaveLength(2);
    expect(abilityData.blastPositions).toContainEqual(strikePos1);
    expect(abilityData.blastPositions).toContainEqual(strikePos2);
  });

  it('keeps thunderstorm cast using its authored cast animation before recurring strikes fire', () => {
    const state = createMockGameState();
    const events: DomainEvent[] = [{
      type: 'ABILITY_USED',
      playerId: entityId('player-1'),
      abilityId: 'thunderstorm',
      abilityName: 'Thunderstorm',
      hit: true,
      timestamp: 1,
      turnNumber: 1,
    }];

    const sequence = buildAnimationSequence(events, state);
    const abilityEvent = sequence.find(event => event.type === 'ability');
    const abilityData = abilityEvent?.data as { animationId?: string } | undefined;

    expect(abilityData?.animationId).toBe(RADIAL_IMPACT_BURST_ANIMATION_ID);
  });
});
