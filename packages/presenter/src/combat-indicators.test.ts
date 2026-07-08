/**
 * Test layer: unit
 * Behavior: buildCombatIndicators maps combat-related domain events into positioned damage, miss, heal, gold, and status indicator view data.
 * Proof: Assertions compare indicator objects for ATTACK_PERFORMED, STATUS_DAMAGE_TICK, STATUS_APPLIED, ABILITY_USED, GOLD_CHANGED, LIFE_STEAL, OBJECT_INTERACTED, TRAP_TRIGGERED, and THORNS_REFLECTED, including text, type, x/y positions, snapshot fallback, skips, and empty no-run output.
 * Validation: pnpm vitest run packages/presenter/src/combat-indicators.test.ts
 */
import { describe, it, expect } from 'vitest';
import { entityId, type DomainEvent, type GameState } from '@dungeon/contracts';
import { createTestEnemy, createTestGameStateInCombat } from '@dungeon/core/testing';
import { buildCombatIndicators } from './combat-indicators.js';

describe('buildCombatIndicators', () => {
  const baseState = createTestGameStateInCombat();
  const mockGameState: GameState = {
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
        speed: 10,
      },
      baseStats: {
        ...baseState.player.baseStats,
        maxHealth: 100,
        health: 100,
        attack: 10,
        defense: 5,
        accuracy: 75,
        evasion: 20,
        speed: 10,
      },
    },
    run: {
      ...baseState.run!,
      runId: entityId('run-1'),
      floor: {
        ...baseState.run!.floor,
        width: 100,
        height: 100,
        cells: new Map(),
        entrance: { x: 0, y: 0 },
        exit: { x: 99, y: 99 },
        seed: 42,
      },
      enemies: new Map([
        [
          'enemy-1',
          createTestEnemy({
            id: entityId('enemy-1'),
            name: 'Goblin',
            templateId: 'goblin',
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

  describe('ATTACK_PERFORMED', () => {
    it('creates damage indicator on defender position for hit attack', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 15,
          damageType: 'physical',
          hit: true,
          critical: false,
          position: { x: 51, y: 50 },
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '-15',
        type: 'damage',
        x: 51,
        y: 50,
      });
    });

    it('creates miss indicator on defender position for missed attack', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 0,
          damageType: 'physical',
          hit: false,
          critical: false,
          missReason: 'evasion',
          position: { x: 51, y: 50 },
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: 'miss',
        type: 'damage',
        x: 51,
        y: 50,
      });
    });

    it('uses event position when defender is not found in final state', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'unknown-enemy' as any,
          attackerName: 'Hero',
          defenderName: 'Unknown',
          damage: 15,
          damageType: 'physical',
          hit: true,
          critical: false,
          position: { x: 49, y: 50 },
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toEqual([{
        text: '-15',
        type: 'damage',
        x: 49,
        y: 50,
      }]);
    });
  });

  describe('STATUS_DAMAGE_TICK', () => {
    it('uses event position when target moved after the tick', () => {
      const movedTargetState: GameState = {
        ...mockGameState,
        run: {
          ...mockGameState.run!,
          enemies: new Map([
            [
              'enemy-1',
              createTestEnemy({
                id: entityId('enemy-1'),
                name: 'Goblin',
                templateId: 'goblin',
                position: { x: 52, y: 50 },
              }),
            ],
          ]),
        },
      };
      const events: DomainEvent[] = [
        {
          type: 'STATUS_DAMAGE_TICK',
          timestamp: 1000,
          turnNumber: 1,
          targetId: 'enemy-1' as any,
          targetName: 'Goblin',
          statusId: 'burn',
          damage: 6,
          damageType: 'fire',
          position: { x: 51, y: 50 },
        } as any,
      ];

      expect(buildCombatIndicators(events, movedTargetState)).toEqual([{
        text: '-6',
        type: 'damage',
        x: 51,
        y: 50,
      }]);
    });

    it('uses event position when target is gone from final state', () => {
      const finalState: GameState = {
        ...mockGameState,
        run: {
          ...mockGameState.run!,
          enemies: new Map(),
        },
      };
      const events: DomainEvent[] = [
        {
          type: 'STATUS_DAMAGE_TICK',
          timestamp: 1000,
          turnNumber: 1,
          targetId: 'enemy-1' as any,
          targetName: 'Goblin',
          statusId: 'burn',
          damage: 6,
          damageType: 'fire',
          position: { x: 51, y: 50 },
        } as any,
      ];

      expect(buildCombatIndicators(events, finalState)).toEqual([{
        text: '-6',
        type: 'damage',
        x: 51,
        y: 50,
      }]);
    });
  });

  describe('STATUS_APPLIED', () => {
    it('creates status indicator with status name on target position', () => {
      const events: DomainEvent[] = [
        {
          type: 'STATUS_APPLIED',
          timestamp: 1000,
          turnNumber: 1,
          targetId: 'enemy-1' as any,
          statusId: 'poison',
          duration: 3,
          sourceId: 'player-1' as any,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toBeDefined();
      expect(indicators[0]!.type).toBe('status');
      expect(indicators[0]!.x).toBe(51);
      expect(indicators[0]!.y).toBe(50);
      expect(indicators[0]!.text).toBeTruthy(); // status name
    });

    it('skips status indicator if target position is not found', () => {
      const events: DomainEvent[] = [
        {
          type: 'STATUS_APPLIED',
          timestamp: 1000,
          turnNumber: 1,
          targetId: 'unknown-target' as any,
          statusId: 'poison',
          duration: 3,
          sourceId: null,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(0);
    });
  });

  describe('ABILITY_USED', () => {
    it('creates heal indicator for healing ability', () => {
      const events: DomainEvent[] = [
        {
          type: 'ABILITY_USED',
          timestamp: 1000,
          turnNumber: 1,
          playerId: 'player-1' as any,
          abilityId: 'heal',
          abilityName: 'Healing Touch',
          targetId: 'player-1' as any,
          targetName: 'Hero',
          healAmount: 25,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '+25',
        type: 'heal',
        x: 50,
        y: 50,
      });
    });

    it('emits damage indicators for damage abilities', () => {
      const events: DomainEvent[] = [
        {
          type: 'ABILITY_USED',
          timestamp: 1000,
          turnNumber: 1,
          playerId: 'player-1' as any,
          abilityId: 'damage',
          abilityName: 'Slash',
          targetId: 'enemy-1' as any,
          targetName: 'Goblin',
          damage: 30,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '-30',
        type: 'damage',
        x: 51,
        y: 50,
      });
    });

    it('uses target snapshots for thunder_step damage indicators when struck enemies are gone from the final state', () => {
      const finalState: GameState = {
        ...mockGameState,
        run: {
          ...mockGameState.run!,
          enemies: new Map(),
        },
      };
      const events: DomainEvent[] = [
        {
          type: 'ABILITY_USED',
          timestamp: 1000,
          turnNumber: 1,
          playerId: 'player-1' as any,
          abilityId: 'thunder_step',
          abilityName: 'Thunder Step',
          damageByTarget: new Map([
            [entityId('enemy-1'), 5],
          ]),
          targetSnapshots: [
            { targetId: entityId('departure_49_50'), position: { x: 49, y: 50 } },
            { targetId: entityId('arrival_52_50'), position: { x: 52, y: 50 } },
            { targetId: entityId('enemy-1'), position: { x: 51, y: 50 } },
          ],
        } as any,
      ];

      const indicators = buildCombatIndicators(events, finalState);

      expect(indicators).toContainEqual({
        text: '-5',
        type: 'damage',
        x: 51,
        y: 50,
      });
    });
  });

  describe('GOLD_CHANGED', () => {
    it('creates gold indicator for positive gold change', () => {
      const events: DomainEvent[] = [
        {
          type: 'GOLD_CHANGED',
          timestamp: 1000,
          turnNumber: 1,
          playerId: 'player-1' as any,
          amount: 50,
          newTotal: 100,
          reason: 'enemy_defeat',
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '+50g',
        type: 'gold',
        x: 50,
        y: 50,
      });
    });

    it('skips negative gold changes', () => {
      const events: DomainEvent[] = [
        {
          type: 'GOLD_CHANGED',
          timestamp: 1000,
          turnNumber: 1,
          playerId: 'player-1' as any,
          amount: -20,
          newTotal: 80,
          reason: 'item_purchase',
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(0);
    });
  });

  describe('LIFE_STEAL', () => {
    it('creates heal indicator for life steal', () => {
      const events: DomainEvent[] = [
        {
          type: 'LIFE_STEAL',
          timestamp: 1000,
          turnNumber: 1,
          playerId: 'player-1' as any,
          enemyId: 'enemy-1' as any,
          enemyName: 'Goblin',
          hpRestored: 10,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '+10',
        type: 'heal',
        x: 50,
        y: 50,
      });
    });
  });

  describe('OBJECT_INTERACTED', () => {
    it('creates heal indicator for positive health delta', () => {
      const events: DomainEvent[] = [
        {
          type: 'OBJECT_INTERACTED',
          timestamp: 1000,
          turnNumber: 1,
          objectId: 'obj-1' as any,
          objectName: 'Healing Shrine',
          position: { x: 50, y: 50 },
          healthDelta: 30,
          gotLoot: false,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '+30',
        type: 'heal',
        x: 50,
        y: 50,
      });
    });

    it('skips zero or negative health deltas', () => {
      const negativeEvent: DomainEvent[] = [
        {
          type: 'OBJECT_INTERACTED',
          timestamp: 1000,
          turnNumber: 1,
          objectId: 'obj-1' as any,
          objectName: 'Spike Trap',
          position: { x: 50, y: 50 },
          healthDelta: -10,
          gotLoot: false,
        } as any,
      ];

      expect(buildCombatIndicators(negativeEvent, mockGameState)).toHaveLength(0);
    });
  });

  describe('TRAP_TRIGGERED', () => {
    it('creates damage indicator at trap position', () => {
      const events: DomainEvent[] = [
        {
          type: 'TRAP_TRIGGERED',
          timestamp: 1000,
          turnNumber: 1,
          trapId: 'trap-1' as any,
          trapName: 'Spike Trap',
          position: { x: 50, y: 50 },
          damage: 15,
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '-15',
        type: 'damage',
        x: 50,
        y: 50,
      });
    });
  });

  describe('THORNS_REFLECTED', () => {
    it('creates damage indicator at target position', () => {
      const events: DomainEvent[] = [
        {
          type: 'THORNS_REFLECTED',
          timestamp: 1000,
          turnNumber: 1,
          targetId: 'enemy-1' as any,
          targetName: 'Goblin',
          damageAmount: 12,
          byPlayerId: 'player-1' as any,
          position: { x: 51, y: 50 },
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual({
        text: '-12',
        type: 'damage',
        x: 51,
        y: 50,
      });
    });

    it('uses event position when reflected target moved or died before render', () => {
      const finalState: GameState = {
        ...mockGameState,
        run: {
          ...mockGameState.run!,
          enemies: new Map(),
        },
      };
      const events: DomainEvent[] = [
        {
          type: 'THORNS_REFLECTED',
          timestamp: 1000,
          turnNumber: 1,
          targetId: 'enemy-1' as any,
          targetName: 'Goblin',
          damageAmount: 12,
          byPlayerId: 'player-1' as any,
          position: { x: 51, y: 50 },
        } as any,
      ];

      expect(buildCombatIndicators(events, finalState)).toEqual([{
        text: '-12',
        type: 'damage',
        x: 51,
        y: 50,
      }]);
    });
  });

  describe('multiple events', () => {
    it('creates indicators for all applicable events', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 20,
          damageType: 'physical',
          hit: true,
          critical: false,
          position: { x: 51, y: 50 },
        } as any,
        {
          type: 'GOLD_CHANGED',
          timestamp: 1001,
          turnNumber: 1,
          playerId: 'player-1' as any,
          amount: 25,
          newTotal: 75,
          reason: 'enemy_defeat',
        } as any,
        {
          type: 'LEVEL_UP',
          timestamp: 1002,
          turnNumber: 1,
          playerId: 'player-1' as any,
          newLevel: 2,
          statGains: { maxHealth: 10, attack: 2, defense: 1, accuracy: 5, evasion: 2 },
        } as any,
      ];

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(2); // attack + gold, not level up
      expect(indicators[0]).toBeDefined();
      expect(indicators[1]).toBeDefined();
      expect(indicators[0]!.type).toBe('damage');
      expect(indicators[1]!.type).toBe('gold');
    });
  });

  describe('no run state', () => {
    it('returns empty array when run is null', () => {
      const stateNoRun = { ...mockGameState, run: null } as GameState;
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 15,
          damageType: 'physical',
          hit: true,
          critical: false,
          position: { x: 51, y: 50 },
        } as any,
      ];

      const indicators = buildCombatIndicators(events, stateNoRun);

      expect(indicators).toHaveLength(0);
    });
  });
});
