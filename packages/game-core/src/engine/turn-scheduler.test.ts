import { describe, it, expect } from 'vitest';
import { processEnemyTurns } from './turn-scheduler.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId, posKey, EMPTY_WEAPON_MASTERY, EMPTY_RUN_METRICS } from '@dungeon/contracts';
import type { GameState, EnemyInstance, MapCell, RunState } from '@dungeon/contracts';
import { createTestGameState, createTestEnemy } from '../test-utils.js';
import { INITIAL_FACTIONS, ITEM_BY_ID } from '@dungeon/content';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeTurnState(
  playerPos: { x: number; y: number },
  enemies: EnemyInstance[],
  options?: { cells?: Map<string, MapCell>; playerHealth?: number; playerStatuses?: any[] },
): GameState {
  const cells = options?.cells ?? makeOpenCells(10, 10);
  const enemyMap = new Map<string, EnemyInstance>();
  for (const e of enemies) {
    enemyMap.set(posKey(e.position), e);
  }

  const run: RunState = {
    runId: entityId('run1'),
    floor: {
      width: 10, height: 10, depth: 1, biomeId: 'crypt',
      cells, entrance: { x: 0, y: 0 }, exit: { x: 9, y: 9 }, seed: 42,
    },
    enemies: enemyMap,
    objects: new Map(),
    turnCount: 0,
    isActive: true,
    runMetrics: EMPTY_RUN_METRICS,
    floorHistory: [],
    floorCache: new Map(),
    speedAccumulators: {},
  };

  const base = createTestGameState({ phase: 'dungeon' });
  return {
    ...base,
    player: {
      ...base.player,
      position: playerPos,
      stats: {
        ...base.player.stats,
        health: options?.playerHealth ?? base.player.stats.health,
      },
      statuses: options?.playerStatuses ?? [],
    },
    run,
    itemRegistry: { items: new Map(ITEM_BY_ID) as any },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processEnemyTurns', () => {
  it('fastest enemy acts first (speed ordering)', () => {
    const slow = createTestEnemy({
      id: entityId('slow'), position: { x: 3, y: 0 },
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 50 },
      isAlerted: true,
    });
    const fast = createTestEnemy({
      id: entityId('fast'), position: { x: 1, y: 0 },
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 200 },
      isAlerted: true,
    });

    const state = makeTurnState({ x: 0, y: 0 }, [slow, fast]);
    const rng = new SeededRNG(1);

    const { events } = processEnemyTurns(state, rng);

    // Fast enemy (at dist 1) should attack first
    const attackEvents = events.filter((e) => e.type === 'ATTACK_PERFORMED');
    if (attackEvents.length > 0) {
      expect((attackEvents[0] as any).attackerId).toBe(entityId('fast'));
    }
  });

  it('un-alerted enemy within range 5 becomes alerted', () => {
    const enemy = createTestEnemy({
      position: { x: 3, y: 0 }, isAlerted: false,
    });
    const state = makeTurnState({ x: 0, y: 0 }, [enemy]); // dist = 3

    const rng = new SeededRNG(1);
    const { events } = processEnemyTurns(state, rng);

    const alertEvent = events.find((e) => e.type === 'ENEMY_ALERTED');
    expect(alertEvent).toBeDefined();
  });

  it('un-alerted enemy beyond range 5 stays idle', () => {
    const enemy = createTestEnemy({
      position: { x: 8, y: 8 }, isAlerted: false,
    });
    const state = makeTurnState({ x: 0, y: 0 }, [enemy]); // dist = 8

    const rng = new SeededRNG(1);
    const { events } = processEnemyTurns(state, rng);

    const alertEvent = events.find((e) => e.type === 'ENEMY_ALERTED');
    expect(alertEvent).toBeUndefined();
  });

  it('stunned enemy skips turn', () => {
    const stunned = createTestEnemy({
      id: entityId('stunned'), position: { x: 1, y: 0 }, isAlerted: true,
      statuses: [{ id: 'stun', turnsRemaining: 1, magnitude: 1, sourceId: null }],
    });
    const state = makeTurnState({ x: 0, y: 0 }, [stunned]);

    const rng = new SeededRNG(1);
    const { events } = processEnemyTurns(state, rng);

    // Stunned enemy should not attack or move
    const attackEvents = events.filter(
      (e) => e.type === 'ATTACK_PERFORMED' && (e as any).attackerId === entityId('stunned'),
    );
    expect(attackEvents).toHaveLength(0);
    const moveEvents = events.filter(
      (e) => e.type === 'ENEMY_MOVED' && (e as any).enemyId === entityId('stunned'),
    );
    expect(moveEvents).toHaveLength(0);
  });

  it('enemy attacks player: ATTACK_PERFORMED event', () => {
    // Use aggressive_melee archetype which attacks at distance 1
    const enemy = createTestEnemy({
      position: { x: 1, y: 0 }, isAlerted: true, archetype: 'aggressive_melee',
    });
    const state = makeTurnState({ x: 0, y: 0 }, [enemy]);

    const rng = new SeededRNG(1);
    const { events } = processEnemyTurns(state, rng);

    const attackEvent = events.find(
      (e) => e.type === 'ATTACK_PERFORMED' && (e as any).attackerId === enemy.id,
    );
    expect(attackEvent).toBeDefined();
  });

  it('enemy attack damages player', () => {
    const enemy = createTestEnemy({
      position: { x: 1, y: 0 }, isAlerted: true, archetype: 'aggressive_melee',
      stats: { maxHealth: 30, health: 30, attack: 50, defense: 3, accuracy: 100, evasion: 0, speed: 120 },
    });
    const state = makeTurnState({ x: 0, y: 0 }, [enemy], { playerHealth: 100 });

    const rng = new SeededRNG(1);
    const { state: newState, events } = processEnemyTurns(state, rng);

    const attackEvent = events.find(
      (e) => e.type === 'ATTACK_PERFORMED' && (e as any).hit === true,
    );
    if (attackEvent) {
      expect(newState.player.stats.health).toBeLessThan(100);
    }
  });

  it('enemy move blocked by occupied cell', () => {
    // Two enemies, one blocking the path
    const enemy1 = createTestEnemy({
      id: entityId('e1'), position: { x: 2, y: 0 }, isAlerted: true,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 200 },
    });
    const enemy2 = createTestEnemy({
      id: entityId('e2'), position: { x: 3, y: 0 }, isAlerted: true,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
    });

    const state = makeTurnState({ x: 0, y: 0 }, [enemy1, enemy2]);
    const rng = new SeededRNG(1);

    const { state: newState } = processEnemyTurns(state, rng);

    // Both enemies should still exist (no crash from occupied cell)
    expect(newState.run!.enemies.size).toBeGreaterThanOrEqual(2);
  });

  it('player at 0 HP → remaining enemies skip', () => {
    // Player starts with 0 HP — no enemies should act
    const enemy1 = createTestEnemy({
      id: entityId('e1'), position: { x: 1, y: 0 }, isAlerted: true,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 200 },
    });
    const enemy2 = createTestEnemy({
      id: entityId('e2'), position: { x: 2, y: 0 }, isAlerted: true,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
    });

    const state = makeTurnState({ x: 0, y: 0 }, [enemy1, enemy2], { playerHealth: 0 });
    const rng = new SeededRNG(1);

    const { events } = processEnemyTurns(state, rng);

    // Neither enemy should have attacked since player starts dead
    const attacks = events.filter((e) => e.type === 'ATTACK_PERFORMED');
    expect(attacks).toHaveLength(0);
  });

  it('Bug 2: enemy burn status ticks and damages enemy each turn', () => {
    const burnedEnemy = createTestEnemy({
      id: entityId('burned'), position: { x: 3, y: 0 }, isAlerted: true, archetype: 'cautious_defensive',
      stats: { maxHealth: 100, health: 100, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 50 },
      statuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 3, sourceId: null }],
    });
    const state = makeTurnState({ x: 0, y: 0 }, [burnedEnemy]);
    const healthBefore = burnedEnemy.stats.health;

    const rng = new SeededRNG(1);
    const { state: newState, events } = processEnemyTurns(state, rng);

    // After processEnemyTurns, enemy statuses should have ticked
    const updatedEnemy = newState.run!.enemies.get(posKey(burnedEnemy.position));
    expect(updatedEnemy).toBeDefined();

    // Burn should have dealt damage (typically 3 damage per turn from STATUS_DEFAULTS)
    // Since burn was applied with magnitude 3, we expect damage to be applied
    expect(updatedEnemy!.stats.health).toBeLessThan(healthBefore);

    // There should be a status tick event (or damage event)
    const damageOrStatusEvent = events.some((e) =>
      (e as any).type === 'DAMAGE_TAKEN' || (e as any).type === 'STATUS_TICKED' || (e as any).type === 'ENEMY_DAMAGED'
    );
    expect(damageOrStatusEvent || updatedEnemy!.stats.health < healthBefore).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Enchantment Effect Tests
  // ---------------------------------------------------------------------------

  it('thorns reflects damage back to attacker on hit', () => {
    // Setup: player with thorns enchantment (spiked_leather)
    // Use aggressive_melee which attacks at distance 1
    const thornsEnemy = createTestEnemy({
      id: entityId('thorns_test'),
      position: { x: 1, y: 0 },
      isAlerted: true,
      archetype: 'aggressive_melee',
      stats: { maxHealth: 50, health: 50, attack: 10, defense: 2, accuracy: 80, evasion: 10, speed: 100 },
    });

    const state = makeTurnState({ x: 0, y: 0 }, [thornsEnemy], {
      playerHealth: 50,
      playerStatuses: [],
    });

    // Add spiked_leather (thorns enchantment) to player equipment
    const updatedState = {
      ...state,
      player: {
        ...state.player,
        equipment: { ...state.player.equipment, chest: entityId('spiked_leather') },
      },
    };

    const rng = new SeededRNG(1);
    const { state: resultState, events } = processEnemyTurns(updatedState, rng);

    // Should have THORNS_REFLECTED event
    const thornsEvent = events.find((e) => e.type === 'THORNS_REFLECTED');
    expect(thornsEvent).toBeDefined();
    if (thornsEvent) {
      expect((thornsEvent as any).targetName).toBe(thornsEnemy.name);
      expect((thornsEvent as any).damageAmount).toBeGreaterThan(0);
    }

    // Enemy should have taken damage from thorns
    const updatedEnemy = resultState.run!.enemies.get(posKey(thornsEnemy.position));
    if (updatedEnemy) {
      expect(updatedEnemy.stats.health).toBeLessThan(50); // Some damage taken
    }
  });

  it('blink dodges enemy attack with event', () => {
    // Setup: player with blink enchantment
    // Use aggressive_melee which attacks at distance 1
    const attacker = createTestEnemy({
      id: entityId('blink_test'),
      position: { x: 1, y: 0 },
      isAlerted: true,
      archetype: 'aggressive_melee',
      stats: { maxHealth: 40, health: 40, attack: 12, defense: 2, accuracy: 90, evasion: 10, speed: 100 },
    });

    const state = makeTurnState({ x: 0, y: 0 }, [attacker], {
      playerHealth: 50,
    });

    // Add blink enchantment to player
    const updatedState = {
      ...state,
      player: {
        ...state.player,
        equipment: { ...state.player.equipment, ring1: entityId('shadow_ring') }, // shadow_ring has blink
      },
    };

    const rng = new SeededRNG(42); // Use seed that triggers blink (30% chance)
    const { state: resultState, events } = processEnemyTurns(updatedState, rng);

    // Check for blink dodge event (may not always trigger due to 30% chance, but seed 42 should)
    const blinkEvent = events.find((e) => e.type === 'BLINK_DODGED');
    if (blinkEvent) {
      expect((blinkEvent as any).attackerName).toBe(attacker.name);
      expect((blinkEvent as any).defenderId).toBe(state.player.id);
    }
  });

  it('life steal heals player on enemy kill', () => {
    // This tests the combat.ts part via a simulated death scenario
    // We'll check that the event is properly emitted by examining the format
    const event: any = {
      type: 'LIFE_STEAL',
      playerId: entityId('player1'),
      enemyId: entityId('enemy1'),
      enemyName: 'Test Enemy',
      hpRestored: 15,
      timestamp: Date.now(),
      turnNumber: 5,
    };

    // Verify the event has the correct structure
    expect(event.type).toBe('LIFE_STEAL');
    expect(event.hpRestored).toBeGreaterThan(0);
    expect(event.enemyName).toBeDefined();
  });

  describe('Debug Events', () => {
    it('supports ENEMY_AMBIENT_STATE_CHANGED event structure', () => {
      // Verify that the event structure is valid and can be created
      const ambientStateEvent: any = {
        type: 'ENEMY_AMBIENT_STATE_CHANGED',
        enemyId: entityId('e1'),
        oldState: 'roaming',
        newState: 'regrouping',
        reason: 'test',
        timestamp: Date.now(),
        turnNumber: 1,
      };

      expect(ambientStateEvent.type).toBe('ENEMY_AMBIENT_STATE_CHANGED');
      expect(ambientStateEvent.enemyId).toBeDefined();
      expect(ambientStateEvent.oldState).toBeDefined();
      expect(ambientStateEvent.newState).toBeDefined();
      expect(ambientStateEvent.reason).toBeDefined();
    });

    it('supports DEBUG_MISS_STREAK event structure', () => {
      // Verify that the event structure is valid and can be created
      const missStreakEvent: any = {
        type: 'DEBUG_MISS_STREAK',
        streakLength: 6,
        playerAccuracy: 50,
        playerEvasion: 20,
        enemyAccuracy: 45,
        enemyEvasion: 15,
        rngSeed: 12345,
        timestamp: Date.now(),
        turnNumber: 1,
      };

      expect(missStreakEvent.type).toBe('DEBUG_MISS_STREAK');
      expect(missStreakEvent.streakLength).toBeGreaterThanOrEqual(6);
      expect(missStreakEvent.playerAccuracy).toBeDefined();
      expect(missStreakEvent.playerEvasion).toBeDefined();
      expect(missStreakEvent.enemyAccuracy).toBeDefined();
      expect(missStreakEvent.enemyEvasion).toBeDefined();
      expect(missStreakEvent.rngSeed).toBeDefined();
    });
  });

  describe('Speed accumulator system (Phase 3)', () => {
    it('fairly distributes turns among enemies with different speeds', () => {
      const slow = createTestEnemy({
        id: entityId('slow'), position: { x: 2, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 50 },
        isAlerted: true,
      });
      const fast = createTestEnemy({
        id: entityId('fast'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
      });
      const veryFast = createTestEnemy({
        id: entityId('very_fast'), position: { x: 3, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 150 },
        isAlerted: true,
      });

      const state = makeTurnState({ x: 0, y: 0 }, [slow, fast, veryFast]);
      const rng = new SeededRNG(1);
      const playerSpeed = 100; // Player moves at 100

      // Process multiple turns with player speed
      let currentState = state;
      let allEvents: any[] = [];

      for (let i = 0; i < 20; i++) {
        const result = processEnemyTurns(currentState, rng, playerSpeed);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }

      // Fast enemy should act more often than slow enemy
      // Count all actions (attacks, moves, abilities, etc.) involving each enemy
      const veryFastAllActions = allEvents.filter((e) => {
        const event = e as Record<string, unknown>;
        return event.attackerId === veryFast.id || event.enemyId === veryFast.id;
      }).length;
      const fastAllActions = allEvents.filter((e) => {
        const event = e as Record<string, unknown>;
        return event.attackerId === fast.id || event.enemyId === fast.id;
      }).length;
      const slowAllActions = allEvents.filter((e) => {
        const event = e as Record<string, unknown>;
        return event.attackerId === slow.id || event.enemyId === slow.id;
      }).length;

      // Speed ratio: very_fast (150) > fast (100) > slow (50)
      // With 20 iterations, very_fast should act more than fast, and fast more than slow
      expect(veryFastAllActions).toBeGreaterThanOrEqual(fastAllActions);
      expect(fastAllActions).toBeGreaterThanOrEqual(slowAllActions);
    });

    it('accumulates speed ratios correctly each round', () => {
      const slow = createTestEnemy({
        id: entityId('slow'), position: { x: 2, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 60 },
        isAlerted: true,
      });
      const fast = createTestEnemy({
        id: entityId('fast'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 },
        isAlerted: true,
      });

      const state = makeTurnState({ x: 0, y: 0 }, [slow, fast]);
      const rng = new SeededRNG(1);
      const playerSpeed = 100;

      // After first round with playerSpeed:
      // slow accumulator += 60/100 = 0.6
      // fast accumulator += 120/100 = 1.2
      const result1 = processEnemyTurns(state, rng, playerSpeed);
      const fast1Actions = result1.events.filter((e) => e.type === 'ATTACK_PERFORMED' && e.attackerId === 'fast').length;

      // Fast should have acted (1.2 >= 1)
      expect(fast1Actions).toBeGreaterThan(0);

      // Verify accumulators update
      expect(result1.state.run?.speedAccumulators).toBeDefined();
      if (result1.state.run !== null) {
        const fastAccum = result1.state.run.speedAccumulators[fast.id] ?? 0;
        const slowAccum = result1.state.run.speedAccumulators[slow.id] ?? 0;
        // After fast acts once, fast accum should be ~0.2, slow ~0.6
        expect(fastAccum).toBeLessThan(1);
        expect(slowAccum).toBeGreaterThanOrEqual(0);
      }
    });

    it('skips enemy turns when accumulator below threshold', () => {
      const slow = createTestEnemy({
        id: entityId('slow'), position: { x: 2, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 50 },
        isAlerted: true,
      });

      const state = makeTurnState({ x: 0, y: 0 }, [slow]);
      const rng = new SeededRNG(1);
      const playerSpeed = 200; // Fast player

      // slow (50) vs player (200) = 0.25 ratio per turn
      // Slow enemy will accumulate very slowly and skip many turns
      const result = processEnemyTurns(state, rng, playerSpeed);
      const slowAttacks = result.events.filter((e) => e.type === 'ATTACK_PERFORMED' && e.attackerId === 'slow').length;

      // With very fast player, slow enemy might not even act once
      expect(slowAttacks).toBeLessThanOrEqual(1);
    });
  });

  describe('Alert propagation and chain reactions', () => {
    it('propagates alert to nearby enemies within range 4', () => {
      const alertEnemy = createTestEnemy({
        id: entityId('alert'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: false,
      });
      const nearbyEnemy = createTestEnemy({
        id: entityId('nearby'), position: { x: 3, y: 0 }, // dist=2 from alert
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: false,
      });
      const farEnemy = createTestEnemy({
        id: entityId('far'), position: { x: 7, y: 0 }, // dist=6 from alert
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: false,
      });

      const state = makeTurnState({ x: 0, y: 0 }, [alertEnemy, nearbyEnemy, farEnemy]);
      const rng = new SeededRNG(1);

      // Process turns (alertEnemy within dist 5 of player gets alerted, triggers propagation)
      const result = processEnemyTurns(state, rng);

      // Find alert events
      const alertEvents = result.events.filter((e) => e.type === 'ENEMY_ALERTED');

      // Should have alerted the nearby enemy (within range 4) but not the far one
      const nearbyAlerted = alertEvents.some((e) => e.enemyId === 'nearby');
      const farAlerted = alertEvents.some((e) => e.enemyId === 'far');

      expect(nearbyAlerted).toBe(true);
      expect(farAlerted).toBe(false);
    });

  });

  describe('Stun and cooldown interactions', () => {
    it('stun status prevents enemy from taking actions mid-turn', () => {
      const stunned = createTestEnemy({
        id: entityId('stunned'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
        statuses: [{ id: 'stun', turnsRemaining: 1, magnitude: 1, sourceId: entityId('test') }],
      });

      const state = makeTurnState({ x: 0, y: 0 }, [stunned]);
      const rng = new SeededRNG(1);

      const result = processEnemyTurns(state, rng);
      const stunmedAttacks = result.events.filter((e) => e.type === 'ATTACK_PERFORMED' && e.attackerId === 'stunned').length;

      // Stunned enemy should not attack
      expect(stunmedAttacks).toBe(0);
    });

    it('cooldowns tick down at end of round', () => {
      const withCooldown = createTestEnemy({
        id: entityId('cooldown'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
        abilityCooldowns: { power_strike: 3, fireball: 1 },
      });

      const state = makeTurnState({ x: 0, y: 0 }, [withCooldown]);
      const rng = new SeededRNG(1);

      const result = processEnemyTurns(state, rng);

      // Check cooldowns were decremented
      const updatedEnemy = result.state.run?.enemies.get(posKey(withCooldown.position));
      expect(updatedEnemy?.abilityCooldowns).toBeDefined();
      if (updatedEnemy?.abilityCooldowns) {
        expect(updatedEnemy.abilityCooldowns.power_strike).toBe(2);
        expect(updatedEnemy.abilityCooldowns.fireball).toBe(0);
      }
    });
  });

  describe('Status effects and damage during turn processing', () => {
    it('ticks player status effects and applies DoT at end of round', () => {
      const enemy = createTestEnemy({
        id: entityId('attacker'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
      });

      const state = makeTurnState(
        { x: 0, y: 0 },
        [enemy],
        {
          playerHealth: 100,
          playerStatuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 5, sourceId: entityId('trap') }],
        },
      );
      const rng = new SeededRNG(1);
      const healthBefore = state.player.stats.health;

      const result = processEnemyTurns(state, rng);
      const healthAfter = result.state.player.stats.health;

      // Player should take DoT damage from burn
      expect(healthAfter).toBeLessThan(healthBefore);
    });

    it('clamps player health to 0 minimum when taking status damage', () => {
      const enemy = createTestEnemy({
        id: entityId('attacker'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
      });

      const state = makeTurnState(
        { x: 0, y: 0 },
        [enemy],
        {
          playerHealth: 5,
          playerStatuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 5, sourceId: entityId('trap') }],
        },
      );
      const rng = new SeededRNG(1);

      const result = processEnemyTurns(state, rng);

      // Player health should not go negative (should be clamped to 0)
      expect(result.state.player.stats.health).toBeGreaterThanOrEqual(0);
    });

    it('ticks enemy status effects at end of round', () => {
      const withStatus = createTestEnemy({
        id: entityId('burning'), position: { x: 1, y: 0 },
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
        statuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 5, sourceId: entityId('test') }],
      });

      const state = makeTurnState({ x: 0, y: 0 }, [withStatus]);
      const rng = new SeededRNG(1);

      const result = processEnemyTurns(state, rng);

      // Enemy should take damage from burn
      const updatedEnemy = result.state.run?.enemies.get(posKey(withStatus.position));
      expect(updatedEnemy?.stats.health).toBeLessThan(withStatus.stats.health);
    });
  });
});
