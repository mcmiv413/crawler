import { describe, it, expect } from 'vitest';
import type { DomainEvent, GameState } from '@dungeon/contracts';
import { buildBumpAnimations } from './bump-animations.js';

describe('buildBumpAnimations', () => {
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
        speed: 10,
      },
      baseStats: {
        maxHealth: 100,
        health: 100,
        attack: 10,
        defense: 5,
        accuracy: 75,
        evasion: 20,
        speed: 10,
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
            name: 'Goblin',
            templateId: 'goblin',
            stats: {
              maxHealth: 20,
              health: 20,
              attack: 5,
              defense: 2,
              accuracy: 70,
              evasion: 10,
              speed: 8,
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

  describe('ATTACK_PERFORMED', () => {
    it('creates bump animation for player attacking enemy', () => {
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
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(1);
      expect(animations[0]).toEqual({
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 50, y: 50 },
        defenderPos: { x: 51, y: 50 },
      });
    });

    it('creates bump animation for enemy attacking player', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'enemy-1' as any,
          defenderId: 'player-1' as any,
          attackerName: 'Goblin',
          defenderName: 'Hero',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(1);
      expect(animations[0]).toEqual({
        attackerId: 'enemy-1',
        defenderId: 'player-1',
        attackerPos: { x: 51, y: 50 },
        defenderPos: { x: 50, y: 50 },
      });
    });

    it('skips animation if attacker position not found', () => {
      const events: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1000,
          turnNumber: 1,
          attackerId: 'unknown-attacker' as any,
          defenderId: 'enemy-1' as any,
          attackerName: 'Unknown',
          defenderName: 'Goblin',
          damage: 15,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(0);
    });

    it('skips animation if defender position not found', () => {
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
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(0);
    });

    it('handles missed attacks (still creates animation)', () => {
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
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(1);
      expect(animations[0]).toBeDefined();
      expect(animations[0]!.attackerPos).toEqual({ x: 50, y: 50 });
    });

    it('creates animations for multiple attacks', () => {
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
        } as any,
        {
          type: 'ATTACK_PERFORMED',
          timestamp: 1001,
          turnNumber: 2,
          attackerId: 'enemy-1' as any,
          defenderId: 'player-1' as any,
          attackerName: 'Goblin',
          defenderName: 'Hero',
          damage: 8,
          damageType: 'physical',
          hit: true,
          critical: false,
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(2);
      expect(animations[0]).toBeDefined();
      expect(animations[1]).toBeDefined();
      expect(animations[0]!.attackerId).toBe('player-1');
      expect(animations[1]!.attackerId).toBe('enemy-1');
    });
  });

  describe('non-ATTACK_PERFORMED events', () => {
    it('ignores other event types', () => {
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
        {
          type: 'ABILITY_USED',
          timestamp: 1001,
          turnNumber: 1,
          playerId: 'player-1' as any,
          abilityId: 'heal',
          abilityName: 'Healing Touch',
          targetId: 'player-1' as any,
          targetName: 'Hero',
          healAmount: 25,
        } as any,
      ];

      const animations = buildBumpAnimations(events, mockGameState);

      expect(animations).toHaveLength(0);
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
        } as any,
      ];

      const animations = buildBumpAnimations(events, stateNoRun);

      expect(animations).toHaveLength(0);
    });
  });
});
