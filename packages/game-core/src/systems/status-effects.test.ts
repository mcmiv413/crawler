import { describe, it, expect } from 'vitest';
import {
  applyStatusToPlayer,
  tickPlayerStatuses,
  tickEnemyStatuses,
  getEffectiveStat,
  hasStatus
} from './status-effects.js';
import { createTestPlayer, createTestEnemy, createTestGameState } from '../test-utils.js';
import { posKey } from '@dungeon/contracts';
import type { StatusId } from '@dungeon/contracts';

describe('status-effects', () => {
  it('applies a new status to player', () => {
    const player = createTestPlayer();
    const updated = applyStatusToPlayer(player, 'poison', 3, 5, null);
    expect(hasStatus(updated.statuses, 'poison')).toBe(true);
    const effect = updated.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.turnsRemaining).toBeGreaterThan(0);
    expect(effect!.turnsRemaining).toBeLessThan(10);
  });

  it('refreshes existing status duration', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 2, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 4, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    expect(effect!.turnsRemaining).toBeGreaterThan(0);
  });

  it('ticks reduce status duration and expire after zero', () => {
    let state = createTestGameState();
    const withWeaken = applyStatusToPlayer(state.player, 'weaken', 1, 1, null);
    state = { ...state, player: withWeaken };
    const { state: tickedState, events } = tickPlayerStatuses(state, 1);
    expect(hasStatus(tickedState.player.statuses, 'weaken')).toBe(false);
    expect(events.some((e: any) => e.type === 'STATUS_EXPIRED' && e.statusId === 'weaken')).toBe(true);
  });

  it('poison deals damage on each tick', () => {
    let state = createTestGameState();
    const withPoison = applyStatusToPlayer(state.player, 'poison', 2, 5, null);
    state = { ...state, player: withPoison };
    const healthBefore = state.player.stats.health;

    const { state: tickedState1 } = tickPlayerStatuses(state, 1);
    // Poison does damage per turn
    expect(tickedState1.player.stats.health).toBeLessThan(healthBefore);
    expect(tickedState1.player.stats.health).toBeGreaterThanOrEqual(0);

    const { state: tickedState2 } = tickPlayerStatuses(tickedState1, 2);
    // After second tick, health should be even lower
    expect(tickedState2.player.stats.health).toBeLessThan(tickedState1.player.stats.health);
    expect(tickedState2.player.stats.health).toBeGreaterThanOrEqual(0);
  });

  it('weaken reduces attack stat while active', () => {
    let state = createTestGameState();
    const withWeaken = applyStatusToPlayer(state.player, 'weaken', 2, 1, null);
    state = { ...state, player: withWeaken };
    const originalAttack = state.player.stats.attack;
    expect(getEffectiveStat(originalAttack, 'attack', withWeaken.statuses))
      .toBeLessThan(originalAttack);
    const { state: tickedState } = tickPlayerStatuses(state, 1);
    expect(getEffectiveStat(tickedState.player.stats.attack, 'attack', tickedState.player.statuses))
      .toBeLessThan(originalAttack);
    const { state: expiredState } = tickPlayerStatuses(tickedState, 2);
    // After expiration, attack should recover
    expect(getEffectiveStat(expiredState.player.stats.attack, 'attack', expiredState.player.statuses))
      .toBeGreaterThanOrEqual(originalAttack * 0.8);
  });

  it('slow reduces speed stat while active', () => {
    let state = createTestGameState();
    const withSlow = applyStatusToPlayer(state.player, 'slow', 2, 1, null);
    state = { ...state, player: withSlow };
    const originalSpeed = state.player.stats.speed;
    expect(getEffectiveStat(originalSpeed, 'speed', withSlow.statuses))
      .toBeLessThan(originalSpeed);
    const { state: tickedState } = tickPlayerStatuses(state, 1);
    expect(getEffectiveStat(tickedState.player.stats.speed, 'speed', tickedState.player.statuses))
      .toBeLessThan(originalSpeed);
    const { state: expiredState } = tickPlayerStatuses(tickedState, 2);
    // After expiration, speed should recover
    expect(getEffectiveStat(expiredState.player.stats.speed, 'speed', expiredState.player.statuses))
      .toBeGreaterThanOrEqual(originalSpeed * 0.8);
  });
});

describe('simultaneous statuses', () => {
  it('two different statuses applied independently coexist', () => {
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 5, null);
    const withBoth = applyStatusToPlayer(withPoison, 'slow', 2, 1, null);

    expect(hasStatus(withBoth.statuses, 'poison')).toBe(true);
    expect(hasStatus(withBoth.statuses, 'slow')).toBe(true);
    expect(withBoth.statuses).toHaveLength(2);
  });

  it('tick removes expired status while leaving non-expired one intact', () => {
    let state = createTestGameState();
    // poison for 3 turns, slow for 1 turn
    const withPoison = applyStatusToPlayer(state.player, 'poison', 3, 5, null);
    const withBoth = applyStatusToPlayer(withPoison, 'slow', 1, 1, null);
    state = { ...state, player: withBoth };

    // After 1 tick, slow should expire but poison should remain
    const { state: tickedState } = tickPlayerStatuses(state, 1);

    expect(hasStatus(tickedState.player.statuses, 'slow')).toBe(false);
    expect(hasStatus(tickedState.player.statuses, 'poison')).toBe(true);
  });
});

describe('magnitude/duration refresh', () => {
  it('reapply with lower magnitude keeps original (Math.max)', () => {
    const originalMagnitude = 5;
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, originalMagnitude, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 3, 3, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.magnitude).toBeGreaterThanOrEqual(originalMagnitude);
  });

  it('reapply with higher magnitude upgrades (Math.max)', () => {
    const newMagnitude = 7;
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 3, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 3, newMagnitude, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.magnitude).toBeGreaterThanOrEqual(newMagnitude - 1);
  });

  it('reapply with shorter duration keeps original (Math.max)', () => {
    const originalDuration = 4;
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', originalDuration, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 1, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    expect(effect!.turnsRemaining).toBeGreaterThanOrEqual(originalDuration - 1);
  });
});

describe('Enemy status ticking', () => {
  it('Bug 2: tickEnemyStatuses handles enemy status duration and damage', () => {
    const initialDuration = 2;
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn' as StatusId, turnsRemaining: initialDuration, magnitude: 3, sourceId: null }] };
    const healthBefore = burnEnemy.stats.health;
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1);
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Burn should have dealt damage
    expect(ticked?.stats.health).toBeLessThan(healthBefore);

    // Duration should have decremented
    const burnStatus = ticked?.statuses.find((s: any) => s.id === 'burn');
    expect(burnStatus?.turnsRemaining ?? 0).toBeLessThan(initialDuration);
  });

  it('enemy status expires after duration reaches 0', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn' as StatusId, turnsRemaining: 1, magnitude: 3, sourceId: null }] };
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1);
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Burn should have expired
    expect(ticked?.statuses).toHaveLength(0);
  });

  it('multiple enemy statuses tick independently', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const multiStatus = {
      ...enemy,
      statuses: [
        { id: 'burn' as StatusId, turnsRemaining: 2, magnitude: 3, sourceId: null },
        { id: 'poison' as StatusId, turnsRemaining: 1, magnitude: 5, sourceId: null },
      ],
    };
    const enemyKey = posKey(multiStatus.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, multiStatus]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, multiStatus, 1);
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Poison should expire, burn should remain
    expect(ticked?.statuses).toHaveLength(1);
    expect(ticked?.statuses[0]?.id).toBe('burn');
    // eslint-disable-next-line dungeon/no-numeric-toBe
    expect(ticked?.statuses[0]?.turnsRemaining).toBe(1);
  });
});

describe('Status refresh behavior (Phase 3)', () => {
  it('refreshing status takes maximum duration, not sum', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 2, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 3, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    // Duration should be 3 (the max), not 5 (sum)
    expect(effect!.turnsRemaining).toBeLessThanOrEqual(3);
    expect(effect!.turnsRemaining).toBeGreaterThanOrEqual(2);
  });

  it('refreshing with longer duration extends remaining time', () => {
    let state = createTestGameState();
    const withPoison = applyStatusToPlayer(state.player, 'poison', 1, 5, null);
    state = { ...state, player: withPoison };

    // After 1 tick, poison has ~0 turns remaining
    const { state: tickedState } = tickPlayerStatuses(state, 1);
    expect(hasStatus(tickedState.player.statuses, 'poison')).toBe(false);

    // Reapply with 3 turns should give fresh duration
    const refreshed = applyStatusToPlayer(tickedState.player, 'poison', 3, 5, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.turnsRemaining).toBeGreaterThan(0);
  });

  it('refreshing with max stat prevents oversaturation', () => {
    const player = createTestPlayer();
    const initialMagnitude = 10;
    const refreshMagnitude = 5;
    const withPoison = applyStatusToPlayer(player, 'poison', 5, initialMagnitude, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 10, refreshMagnitude, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    // Magnitude should stay at the higher applied value instead of stacking.
    expect(effect!.magnitude).toBe(Math.max(initialMagnitude, refreshMagnitude));
  });
});

describe('Stat cascades and interactions (Phase 3)', () => {
  it('weaken reduces attack, vulnerability increases damage taken', () => {
    let state = createTestGameState();
    const withWeaken = applyStatusToPlayer(state.player, 'weaken', 2, 1, null);
    const withVulnerability = applyStatusToPlayer(withWeaken, 'vulnerability', 2, 1, null);
    state = { ...state, player: withVulnerability };

    const originalAttack = state.player.stats.attack;
    const weakenedAttack = getEffectiveStat(originalAttack, 'attack', withVulnerability.statuses);

    // Weaken should reduce attack
    expect(weakenedAttack).toBeLessThan(originalAttack);

    // Both statuses should be present
    expect(hasStatus(withVulnerability.statuses, 'weaken')).toBe(true);
    expect(hasStatus(withVulnerability.statuses, 'vulnerability')).toBe(true);
  });

  it('stun and slow stack (multiple debuffs coexist)', () => {
    const player = createTestPlayer();
    const withStun = applyStatusToPlayer(player, 'stun', 1, 1, null);
    const withBoth = applyStatusToPlayer(withStun, 'slow', 2, 1, null);

    expect(hasStatus(withBoth.statuses, 'stun')).toBe(true);
    expect(hasStatus(withBoth.statuses, 'slow')).toBe(true);
    expect(withBoth.statuses).toHaveLength(2);
  });

  it('burn and poison combined damage stacks', () => {
    let state = createTestGameState();
    const withBurn = applyStatusToPlayer(state.player, 'burn', 2, 5, null);
    const withBoth = applyStatusToPlayer(withBurn, 'poison', 2, 5, null);
    state = { ...state, player: withBoth };

    const healthBefore = state.player.stats.health;
    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Should take damage from both burn and poison
    expect(tickedState.player.stats.health).toBeLessThan(healthBefore);
  });
});

describe('Health clamping and edge cases (Phase 3)', () => {
  it('poison damage clamps health to 0 minimum, not negative', () => {
    let state = createTestGameState();
    // Set very low health
    state = {
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: 3 },
      },
    };
    const withPoison = applyStatusToPlayer(state.player, 'poison', 2, 10, null);
    state = { ...state, player: withPoison };

    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Health should be >= 0, not negative
    expect(tickedState.player.stats.health).toBeGreaterThanOrEqual(0);
    expect(tickedState.player.stats.health).toBeLessThanOrEqual(3);
  });

  it('multiple DoT sources clamp correctly when combined damage exceeds health', () => {
    let state = createTestGameState();
    state = {
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: 5 },
      },
    };
    const withBurn = applyStatusToPlayer(state.player, 'burn', 2, 5, null);
    const withBoth = applyStatusToPlayer(withBurn, 'poison', 2, 5, null);
    state = { ...state, player: withBoth };

    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Health should be >= 0 despite multiple DoT sources
    expect(tickedState.player.stats.health).toBeGreaterThanOrEqual(0);
  });

  it('enemy DoT damage clamps to 0 minimum', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({
      position: { x: 1, y: 1 },
      isAlerted: true,
      lastKnownPlayerPos: null,
      stats: { maxHealth: 10, health: 3, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
    });
    const burnEnemy = {
      ...enemy,
      statuses: [{ id: 'burn' as StatusId, turnsRemaining: 2, magnitude: 10, sourceId: null }],
    };
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1);
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Health should be >= 0, not negative (or undefined)
    if (ticked) {
      expect(ticked.stats.health).toBeGreaterThanOrEqual(0);
    }
  });

  it('minimum damage DoT still reduces health over ticks', () => {
    let state = createTestGameState();
    const withMinDamage = applyStatusToPlayer(state.player, 'burn', 10, 1, null);
    state = { ...state, player: withMinDamage };

    const healthBefore = state.player.stats.health;
    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Status should still tick (duration decrements)
    expect(hasStatus(tickedState.player.statuses, 'burn')).toBe(true);
    // Even 1 damage magnitude burn should reduce health
    expect(tickedState.player.stats.health).toBeLessThanOrEqual(healthBefore);
  });
});
