/**
 * Test layer: property
 * Behavior: Command Handler covers command-handler invariants; turn number never decreases after any command; health never exceeds maxHealth after any command.
 * Proof: seeded/generated cases preserve the invariant under varied inputs.
 * Validation: pnpm vitest run packages/game-core/src/engine/command-handler.property.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { handleCommand } from './command-handler.js';
import { SeededRNG } from '../utils/rng.js';
import { createTestGameStateInCombat } from '../test-utils.js';

describe('command-handler invariants', () => {
  it('turn number never decreases after any command', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        fc.constantFrom('WAIT', 'ATTACK'),
        (seed, commandType) => {
          const state = createTestGameStateInCombat();
          const rng = new SeededRNG(seed);
          const targetId = [...state.run!.enemies.values()][0]!.id;
          const command = commandType === 'ATTACK'
            ? { type: 'ATTACK' as const, targetId }
            : { type: 'WAIT' as const };

          const result = handleCommand(state, command as any, rng);
          return result.state.turnNumber >= state.turnNumber;
        },
      ),
      { numRuns: 50 },
    );
  });

  it('health never exceeds maxHealth after any command', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        (seed) => {
          const state = createTestGameStateInCombat();
          const rng = new SeededRNG(seed);
          const result = handleCommand(state, { type: 'WAIT' } as any, rng);
          return result.state.player.stats.health <= result.state.player.stats.maxHealth;
        },
      ),
      { numRuns: 50 },
    );
  });

  it('CommandResult always has valid structure', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        (seed) => {
          const state = createTestGameStateInCombat();
          const rng = new SeededRNG(seed);
          const result = handleCommand(state, { type: 'WAIT' } as any, rng);

          return (
            result.state !== undefined &&
            Array.isArray(result.events) &&
            typeof result.runEnded === 'boolean'
          );
        },
      ),
      { numRuns: 50 },
    );
  });
});
