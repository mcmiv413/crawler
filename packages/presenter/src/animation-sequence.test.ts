import { describe, it, expect } from 'vitest';
import type { DomainEvent, GameState } from '@dungeon/contracts';
import { buildAnimationSequence } from './animation-sequence.js';

describe('buildAnimationSequence', () => {
  const mockGameState: GameState = {
    gameId: 'game-1' as any,
    phase: 'dungeon',
    player: {
      id: 'player-1' as any,
      name: 'Hero',
      level: 1,
      experience: 0,
      stats: {
        maxHealth: 100,
        health: 100,
        attack: 10,
        defense: 5,
        accuracy: 75,
        evasion: 20,
        speed: 12, // Player speed
      },
      baseStats: {
        maxHealth: 100,
        health: 100,
        attack: 10,
        defense: 5,
        accuracy: 75,
        evasion: 20,
        speed: 12,
      },
      position: { x: 50, y: 50 },
      equipment: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      },
      inventory: [],
      statuses: [],
      abilities: [],
      gold: 50,
      floor: 1,
      totalKills: 0,
      totalDeaths: 0,
      totalRuns: 0,
      deathStash: null,
    },
    run: {
      runId: 'run-1' as any,
      floor: {
        width: 100,
        height: 100,
        depth: 1,
        biomeId: 'dungeon',
        cells: new Map(),
        entrance: { x: 0, y: 0 },
        exit: { x: 99, y: 99 },
        seed: 42,
      },
      enemies: new Map([
        [
          'enemy-1',
          {
            id: 'enemy-1' as any,
            name: 'Slow Goblin',
            templateId: 'goblin',
            stats: {
              maxHealth: 20,
              health: 20,
              attack: 5,
              defense: 2,
              accuracy: 70,
              evasion: 10,
              speed: 8, // Slow enemy
            },
            position: { x: 51, y: 50 },
            statuses: [],
            equipment: {
              weapon: null,
              chest: null,
              head: null,
              gloves: null,
              boots: null,
              ring1: null,
              ring2: null,
              secondaryWeapon: null,
            },
            inventory: [],
            nemesisId: null,
            aiState: 'idle' as any,
            speedAccumulator: 0,
          } as any,
        ],
        [
          'enemy-2',
          {
            id: 'enemy-2' as any,
            name: 'Fast Orc',
            templateId: 'orc',
            stats: {
              maxHealth: 30,
              health: 30,
              attack: 8,
              defense: 3,
              accuracy: 75,
              evasion: 15,
              speed: 15, // Fast enemy (faster than player)
            },
            position: { x: 52, y: 50 },
            statuses: [],
            equipment: {
              weapon: null,
              chest: null,
              head: null,
              gloves: null,
              boots: null,
              ring1: null,
              ring2: null,
              secondaryWeapon: null,
            },
            inventory: [],
            nemesisId: null,
            aiState: 'idle' as any,
            speedAccumulator: 0,
          } as any,
        ],
      ]),
      objects: new Map(),
      turnCount: 1,
      isActive: true,
      floorHistory: [],
      weaponMastery: {
        blade: 0,
        bludgeon: 0,
        axe: 0,
        ranged: 0,
        dagger: 0,
      },
      speedAccumulators: {},
    },
    world: {
      town: {
        prosperity: 50,
        fear: 0,
        corruption: 0,
        npcs: [],
        shop: { items: [] },
        rumors: [],
        lastRunSummary: null,
        nemeses: [],
        slainNemeses: [],
        factions: [],
        atmosphereDescription: '',
        unlockedBlueprints: [],
      },
      npcs: [],
      shop: { items: [] },
      eventHistory: [],
      totalRuns: 0,
      deepestFloor: 1,
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
  } as unknown as GameState;

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
    it('calculates bump animation delay as sequenceIndex * 500ms', () => {
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
      expect(bumps[0]!.delayMs).toBe(0); // index 0 * 500
      expect(bumps[1]!.delayMs).toBe(500); // index 1 * 500
    });

    it('calculates damage indicator delay as sequenceIndex * 500 + 150ms', () => {
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
      expect(damages[0]!.delayMs).toBe(150); // 0 * 500 + 150
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

      // Bump 0 at 0ms, Damage 0 at 150ms, Bump 1 at 500ms, Damage 1 at 650ms
      // eslint-disable-next-line dungeon/no-array-mutation
      const ordered = [...sequence].sort((a, b) => a.delayMs - b.delayMs);
      expect(ordered).toHaveLength(4);
      expect(ordered[0]).toBeDefined();
      expect(ordered[1]).toBeDefined();
      expect(ordered[2]).toBeDefined();
      expect(ordered[3]).toBeDefined();
      expect(ordered[0]!.delayMs).toBe(0);
      expect(ordered[0]!.type).toBe('bump');
      expect(ordered[1]!.delayMs).toBe(150);
      expect(ordered[1]!.type).toBe('damage');
      expect(ordered[2]!.delayMs).toBe(500);
      expect(ordered[2]!.type).toBe('bump');
      expect(ordered[3]!.delayMs).toBe(650);
      expect(ordered[3]!.type).toBe('damage');
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

      // Build first sequence
      const animations1 = buildAnimationSequence(events, mockGameState);
      const batchId1 = (animations1[0] as any).batchId;

      // Build second sequence (simulating next turn)
      const animations2 = buildAnimationSequence(events, mockGameState);
      const batchId2 = (animations2[0] as any).batchId;

      expect(batchId1).not.toBe(batchId2);
    });
  });
});
