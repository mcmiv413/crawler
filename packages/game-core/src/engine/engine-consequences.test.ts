import { describe, expect, it } from 'vitest';
import { GameEngine } from './game-engine.js';
import { createTestGameStateInCombat, createWaitCommand } from '../test-utils.js';

function createPriorDeathEvent(timestamp: number) {
  return {
    type: 'PLAYER_DIED' as const,
    killerId: null,
    killerName: null,
    killerSpriteName: null,
    floor: 1,
    cause: 'prior death',
    goldLost: 0,
    overkillDamage: 0,
    timestamp,
    turnNumber: timestamp,
  };
}

describe('GameEngine — applyRunConsequences integration', () => {
  it('uses current command events when evaluating same-run fear escalation', () => {
    const engine = new GameEngine();
    const baseState = createTestGameStateInCombat();
    const [enemy] = baseState.run?.enemies.values() ?? [];
    expect(enemy).toBeDefined();

    const state = {
      ...baseState,
      player: {
        ...baseState.player,
        baseStats: {
          ...baseState.player.baseStats,
          maxHealth: 200,
        },
        stats: {
          ...baseState.player.stats,
          health: 10,
          maxHealth: 200,
          defense: 0,
          evasion: 0,
        },
      },
      world: {
        ...baseState.world,
        eventHistory: [
          createPriorDeathEvent(1),
          createPriorDeathEvent(2),
        ],
        town: {
          ...baseState.world.town,
          fear: 30,
        },
      },
      run: {
        ...baseState.run!,
        enemies: new Map([
          ['1,0', {
            ...enemy!,
            stats: {
              ...enemy!.stats,
              attack: 100,
              accuracy: 100,
            },
          }],
        ]),
      },
    };

    const result = engine.submitCommand(state, createWaitCommand());

    expect(result.runEnded).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'PLAYER_DIED' }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'TOWN_STATE_CHANGED',
        field: 'fear',
      }),
    );
    expect(result.state.world.town.fear).toBeGreaterThan(state.world.town.fear);
  });
});
