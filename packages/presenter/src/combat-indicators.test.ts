import { describe, it, expect } from 'vitest';
import type { DomainEvent, GameState } from '@dungeon/contracts';
import { buildCombatIndicators } from './combat-indicators.js';

describe('buildCombatIndicators', () => {
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

    it('skips indicator if defender position is not found', () => {
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

      const indicators = buildCombatIndicators(events, mockGameState);

      expect(indicators).toHaveLength(0);
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
        } as any,
      ];

      const indicators = buildCombatIndicators(events, stateNoRun);

      expect(indicators).toHaveLength(0);
    });
  });
});
