import { describe, it, expect } from 'vitest';
import { entityId, type DomainEvent, type EntityId, type GameState } from '@dungeon/contracts';
import { createTestEnemy, createTestGameStateInCombat } from '@dungeon/core/testing';
import { buildAnimationSequence } from './animation-sequence.js';
import { ANIMATION_TIMING, CONSUMABLE_ANIMATION_METADATA } from './animation-metadata.js';

describe('buildAnimationSequence', () => {
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
            name: 'Slow Goblin',
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
        [
          'enemy-2',
          createTestEnemy({
            id: entityId('enemy-2'),
            name: 'Fast Orc',
            templateId: 'orc',
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

  describe('turn ordering by speed', () => {
    it('sequences attacks by speed (highest speed first)', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'enemy-2' as any,
          defenderId: 'player-1' as any,
          attackerName: 'Fast Orc',
          defenderName: 'Hero',
          damage: 10,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1001,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-2' as any,
          attackerName: 'Hero',
          defenderName: 'Fast Orc',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1002,
          turnNumber: 1,
          attackerId: 'enemy-1' as any,
          defenderId: 'player-1' as any,
          attackerName: 'Slow Goblin',
          defenderName: 'Hero',
          damage: 5,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const sequence = buildAnimationSequence(events, mockGameState);

      // Should be ordered: enemy-2 (speed 15), player-1 (speed 12), enemy-1 (speed 8)
      const bumps = sequence.filter(a => a.type === 'bump');
      const bump0 = bumps[0];
      const bump1 = bumps[1];
      const bump2 = bumps[2];
      expect(bump0).toBeDefined();
      expect(bump1).toBeDefined();
      expect(bump2).toBeDefined();
      if (bump0 && 'attackerId' in bump0.data) expect(bump0.data.attackerId).toBe('enemy-2');
      if (bump1 && 'attackerId' in bump1.data) expect(bump1.data.attackerId).toBe('player-1');
      if (bump2 && 'attackerId' in bump2.data) expect(bump2.data.attackerId).toBe('enemy-1');
    });

    it('assigns sequential indices based on speed order', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Slow Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const sequence = buildAnimationSequence(events, mockGameState);

      const bumps = sequence.filter(a => a.type === 'bump');
      expect(bumps[0]).toBeDefined();
      expect(bumps[0]!.sequenceIndex).toBe(0);
    });
  });

  describe('timing delays', () => {
    it('calculates bump animation delay from attack timing metadata', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Slow Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1001,
          turnNumber: 1,
          attackerId: 'enemy-1' as any,
          defenderId: 'player-1' as any,
          attackerName: 'Slow Goblin',
          defenderName: 'Hero',
          damage: 5,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const sequence = buildAnimationSequence(events, mockGameState);

      const bumps = sequence.filter(a => a.type === 'bump');
      expect(bumps[0]).toBeDefined();
      expect(bumps[1]).toBeDefined();
      expect(bumps[0]!.delayMs).toBe(0);
      expect(bumps[1]!.delayMs).toBe(ANIMATION_TIMING.attackStaggerMs);
    });

    it('calculates damage indicator delay from attack timing metadata', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Slow Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const sequence = buildAnimationSequence(events, mockGameState);

      const damages = sequence.filter(a => a.type === 'damage');
      expect(damages[0]).toBeDefined();
      expect(damages[0]!.delayMs).toBe(ANIMATION_TIMING.damageIndicatorDelayMs);
    });

    it('handles multiple attacks with proper spacing', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Slow Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1001,
          turnNumber: 1,
          attackerId: 'enemy-1' as any,
          defenderId: 'player-1' as any,
          attackerName: 'Slow Goblin',
          defenderName: 'Hero',
          damage: 5,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const sequence = buildAnimationSequence(events, mockGameState);

      const ordered = [...sequence].sort((a, b) => a.delayMs - b.delayMs);
      expect(ordered).toHaveLength(4);
      expect(ordered[0]).toBeDefined();
      expect(ordered[1]).toBeDefined();
      expect(ordered[2]).toBeDefined();
      expect(ordered[3]).toBeDefined();
      expect(ordered[0]!.delayMs).toBe(0);
      expect(ordered[0]!.type).toBe('bump');
      expect(ordered[1]!.delayMs).toBe(ANIMATION_TIMING.damageIndicatorDelayMs);
      expect(ordered[1]!.type).toBe('damage');
      expect(ordered[2]!.delayMs).toBe(ANIMATION_TIMING.attackStaggerMs);
      expect(ordered[2]!.type).toBe('bump');
      expect(ordered[3]!.delayMs).toBe(
        ANIMATION_TIMING.attackStaggerMs + ANIMATION_TIMING.damageIndicatorDelayMs,
      );
      expect(ordered[3]!.type).toBe('damage');
    });
  });

  describe('consumable metadata', () => {
    it('emits resolved damage animation metadata and blast positions', () => {
      const events: DomainEvent[] = [
        {
          type: 'ITEM_USED',
          timestamp: 1000,
          turnNumber: 1,
          itemId: 'bomb-1' as any,
          itemName: 'Bomb',
          userId: 'player-1' as any,
          effect: 'damage',
        } as any,
      ];

      const sequence = buildAnimationSequence(events, mockGameState);
      const consumable = sequence.find((animation) => animation.type === 'consumable');

      expect(consumable).toBeDefined();
      if (consumable?.type === 'consumable' && 'effect' in consumable.data) {
        expect(consumable.data.effect).toBe('damage');
        expect(consumable.data.durationMs).toBe(CONSUMABLE_ANIMATION_METADATA.damage.durationMs);
        expect(consumable.data.presentation).toBe(CONSUMABLE_ANIMATION_METADATA.damage);
        expect(consumable.data.blastPositions).toEqual(
          CONSUMABLE_ANIMATION_METADATA.damage.blastOffsets?.map((offset) => ({
            x: mockGameState.player.position.x + offset.x,
            y: mockGameState.player.position.y + offset.y,
          })),
        );
      }
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
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const sequence = buildAnimationSequence(events, stateNoRun);

      expect(sequence).toHaveLength(0);
    });
  });

  describe('batch deduplication', () => {
    it('includes batchId in animated events', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const animations = buildAnimationSequence(events, mockGameState);

      expect(animations.length).toBeGreaterThan(0);
      expect((animations[0] as any).batchId).toBeDefined();
    });

    it('generates same batchId for all events in same sequence', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const animations = buildAnimationSequence(events, mockGameState);

      // Should have bump and damage animations
      expect(animations.length).toBeGreaterThanOrEqual(2);

      // All should have same batchId
      const batchId = (animations[0] as any).batchId;
      for (const anim of animations) {
        expect((anim as any).batchId).toBe(batchId);
      }
    });

    it('generates different batchId for different animation sequences', () => {
      const firstTurnEvents: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];
      const secondTurnEvents: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1001,
          turnNumber: 2,
          attackerId: 'player-1' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const animations1 = buildAnimationSequence(firstTurnEvents, mockGameState);
      const batchId1 = (animations1[0] as any).batchId;
      const animations2 = buildAnimationSequence(secondTurnEvents, mockGameState);
      const batchId2 = (animations2[0] as any).batchId;

      expect(batchId1).not.toBe(batchId2);
    });
  });

  describe('ability damage indicators', () => {
    it('emits damage indicators for single-target abilities', () => {
      const events: DomainEvent[] = [
        {
          type: 'ABILITY_USED',
          playerId: 'player-1' as any,
          abilityId: 'power_strike',
          abilityName: 'Power Strike',
          targetId: 'enemy-1' as any,
          targetName: 'Slow Goblin',
          damage: 25,
          timestamp: 0,
          turnNumber: 1,
        },
      ];

      const animations = buildAnimationSequence(events, mockGameState);

      // Should have one ability animation and one damage indicator
      const abilityAnims = animations.filter(a => a.type === 'ability');
      const damageAnims = animations.filter(a => a.type === 'damage');

      expect(abilityAnims).toHaveLength(1);
      expect(damageAnims).toHaveLength(1);

      // Damage indicator should be at enemy position
      const damageAnim = damageAnims[0];
      expect(damageAnim?.data).toMatchObject({
        x: 51, // enemy-1 position
        y: 50,
        text: '-25',
        type: 'damage',
      });

      // Damage indicator should be delayed after ability animation completes
      const abilityAnim = abilityAnims[0];
      expect(damageAnim?.delayMs).toBeGreaterThan(abilityAnim?.delayMs ?? 0);
    });

    it('emits multiple damage indicators for AoE abilities like cleave', () => {
      const events: DomainEvent[] = [
        {
          type: 'ABILITY_USED',
          playerId: 'player-1' as any,
          abilityId: 'axe_cleave',
          abilityName: 'Cleave',
          targetId: 'enemy-1' as any,
          targetName: 'Slow Goblin',
          damage: 15,
          damageByTarget: new Map<EntityId, number>([
            ['enemy-1' as EntityId, 15],
            ['enemy-2' as EntityId, 15],
          ]),
          timestamp: 0,
          turnNumber: 1,
        },
      ];

      const animations = buildAnimationSequence(events, mockGameState);

      // For cleave hitting 2 enemies, should have damage indicators at both positions
      const damageAnims = animations.filter(a => a.type === 'damage');
      
      expect(damageAnims.length).toBeGreaterThanOrEqual(2);
      
      // Should have damage indicators at the affected positions
      const positions = damageAnims.map(a => ({ x: (a.data as any).x, y: (a.data as any).y }));
      expect(positions).toContainEqual({ x: 51, y: 50 }); // enemy-1
      expect(positions).toContainEqual({ x: 52, y: 50 }); // enemy-2
    });
  });
});
