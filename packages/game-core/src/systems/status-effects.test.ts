import { describe, it, expect } from 'vitest';
import {
  applyStatusToPlayer,
  tickPlayerStatuses,
  tickEnemyStatuses,
  getEffectiveStat,
  hasStatus
} from './status-effects.js';
import { createTestPlayer, createTestEnemy } from '../test-utils.js';

describe('status-effects', () => {
  it('applies a new status to player', () => {
    const player = createTestPlayer();
    const updated = applyStatusToPlayer(player, 'poison', 3, 5, null);
    expect(hasStatus(updated.statuses, 'poison')).toBe(true);
    const effect = updated.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.turnsRemaining).toBe(3);
  });

  it('refreshes existing status duration', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 2, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 4, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    expect(effect!.turnsRemaining).toBe(4);
  });

  it('ticks reduce status duration and expire after zero', () => {
    const player = createTestPlayer();
    const withWeaken = applyStatusToPlayer(player, 'weaken', 1, 1, null);
    const { player: ticked, events } = tickPlayerStatuses(withWeaken, 1);
    expect(hasStatus(ticked.statuses, 'weaken')).toBe(false);
    expect(events.some((e: any) => e.type === 'STATUS_EXPIRED' && e.statusId === 'weaken')).toBe(true);
  });

  it('poison deals damage on each tick', () => {
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 2, 5, null);
    expect(withPoison.statuses.some(s => s.id === 'poison')).toBe(true);

    const { player: ticked1 } = tickPlayerStatuses(withPoison, 1);
    // Poison does 3 damage per turn (from STATUS_DEFAULTS)
    expect(ticked1.stats.health).toBe(player.stats.health - 3); // 250 - 3 = 247

    const { player: ticked2 } = tickPlayerStatuses(ticked1, 2);
    // After second tick, should have 6 total damage
    expect(ticked2.stats.health).toBe(player.stats.health - 6); // 250 - 6 = 244
    expect(ticked2.stats.health).toBeLessThan(ticked1.stats.health);
  });

  it('weaken reduces attack stat while active', () => {
    const player = createTestPlayer();
    const withWeaken = applyStatusToPlayer(player, 'weaken', 2, 1, null);
    expect(getEffectiveStat(player.stats.attack, 'attack', withWeaken.statuses))
      .toBeLessThan(player.stats.attack);
    const { player: ticked } = tickPlayerStatuses(withWeaken, 1);
    expect(getEffectiveStat(ticked.stats.attack, 'attack', ticked.statuses))
      .toBeLessThan(player.stats.attack);
    const { player: expired } = tickPlayerStatuses(ticked, 2);
    expect(getEffectiveStat(expired.stats.attack, 'attack', expired.statuses))
      .toBe(expired.stats.attack);
  });

  it('slow reduces speed stat while active', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 2, 1, null);
    expect(getEffectiveStat(player.stats.speed, 'speed', withSlow.statuses))
      .toBeLessThan(player.stats.speed);
    const { player: ticked } = tickPlayerStatuses(withSlow, 1);
    expect(getEffectiveStat(ticked.stats.speed, 'speed', ticked.statuses))
      .toBeLessThan(player.stats.speed);
    const { player: expired } = tickPlayerStatuses(ticked, 2);
    expect(getEffectiveStat(expired.stats.speed, 'speed', expired.statuses))
      .toBe(expired.stats.speed);
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
    const player = createTestPlayer();
    // poison for 3 turns, slow for 1 turn
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 5, null);
    const withBoth = applyStatusToPlayer(withPoison, 'slow', 1, 1, null);

    // After 1 tick, slow should expire but poison should remain
    const { player: ticked } = tickPlayerStatuses(withBoth, 1);

    expect(hasStatus(ticked.statuses, 'slow')).toBe(false);
    expect(hasStatus(ticked.statuses, 'poison')).toBe(true);
  });
});

describe('magnitude/duration refresh', () => {
  it('reapply with lower magnitude keeps original (Math.max)', () => {
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 5, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 3, 3, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.magnitude).toBe(5);
  });

  it('reapply with higher magnitude upgrades (Math.max)', () => {
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 3, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 3, 7, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.magnitude).toBe(7);
  });

  it('reapply with shorter duration keeps original (Math.max)', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 4, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 1, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    expect(effect!.turnsRemaining).toBe(4);
  });
});

describe('Enemy status ticking', () => {
  it('Bug 2: tickEnemyStatuses handles enemy status duration and damage', () => {
    const enemy = createTestEnemy();
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 3, sourceId: null }] };
    const healthBefore = burnEnemy.stats.health;

    const { enemy: ticked } = tickEnemyStatuses(burnEnemy, 1);

    // Burn should have dealt damage
    expect(ticked.stats.health).toBeLessThan(healthBefore);

    // Duration should have decremented
    const burnStatus = ticked.statuses.find((s: any) => s.id === 'burn');
    expect(burnStatus?.turnsRemaining).toBe(1);
  });

  it('enemy status expires after duration reaches 0', () => {
    const enemy = createTestEnemy();
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn', turnsRemaining: 1, magnitude: 3, sourceId: null }] };

    const { enemy: ticked } = tickEnemyStatuses(burnEnemy, 1);

    // Burn should have expired
    expect(ticked.statuses.some((s: any) => s.id === 'burn')).toBe(false);
  });

  it('multiple enemy statuses tick independently', () => {
    const enemy = createTestEnemy();
    const multiStatus = {
      ...enemy,
      statuses: [
        { id: 'burn', turnsRemaining: 2, magnitude: 3, sourceId: null },
        { id: 'poison', turnsRemaining: 1, magnitude: 5, sourceId: null },
      ],
    };

    const { enemy: ticked } = tickEnemyStatuses(multiStatus, 1);

    // Poison should expire, burn should remain
    expect(ticked.statuses.some((s: any) => s.id === 'poison')).toBe(false);
    expect(ticked.statuses.some((s: any) => s.id === 'burn')).toBe(true);
  });
});
