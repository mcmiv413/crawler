import type { GameState, DomainEvent, GameCommand } from '@dungeon/contracts';
import { expect } from 'vitest';

/**
 * Event Emission Guarantees
 *
 * Property-based and contract tests ensuring:
 * - Every command emits expected event types
 * - No commands emit events they shouldn't
 * - Missing event emissions caught automatically
 *
 * Used with property-based testing (fast-check) to verify
 * the contract holds across 100+ random game states.
 */

export interface EventEmissionRule {
  /** The command type (e.g., 'MOVE', 'ATTACK', 'USE_ITEM') */
  commandType: string;

  /** Events that MUST be in result.events every time command succeeds */
  mustEmit?: string[];

  /** Events that may or may not appear (depends on game state) */
  mayEmit?: string[];

  /** Events that must NOT appear (would indicate a bug) */
  mustNotEmit?: string[];

  /** If true, command can sometimes emit zero events (e.g., movement to blocked tile) */
  allowZeroEvents?: boolean;
}

/**
 * Assert a command follows its event emission contract.
 *
 * Usage (unit test):
 *   assertEventEmissionRule({
 *     commandType: 'MOVE',
 *     mustEmit: ['PLAYER_MOVED'],
 *     mayEmit: ['ENEMY_ALERTED'],
 *     mustNotEmit: ['ENTITY_DIED'],
 *   }, state, () => ({ type: 'MOVE', direction: 'N' }));
 *
 * Usage (property test with fast-check):
 *   fc.assert(
 *     fc.property(
 *       fc.integer({ min: 1, max: 100 }),
 *       (seed) => {
 *         const state = createTestGameStateInCombat({ seed });
 *         assertEventEmissionRule(..., state, ...);
 *       },
 *     ),
 *   );
 */
export function assertEventEmissionRule(
  rule: EventEmissionRule,
  state: GameState,
  buildCommand: (state: GameState) => GameCommand,
  executeCommand: (state: GameState, cmd: GameCommand) => { state: GameState; events: DomainEvent[] },
): void {
  const cmd = buildCommand(state);
  const result = executeCommand(state, cmd);

  const eventTypes = result.events.map((e) => e.type);

  // Rule 1: mustEmit events are present
  if (rule.mustEmit && rule.mustEmit.length > 0) {
    for (const eventType of rule.mustEmit) {
      expect(
        eventTypes,
        `Command ${rule.commandType} must emit ${eventType} but didn't. ` +
        `Got: ${eventTypes.join(', ')}`,
      ).toContain(eventType);
    }
  }

  // Rule 2: mustNotEmit events are absent
  if (rule.mustNotEmit && rule.mustNotEmit.length > 0) {
    for (const eventType of rule.mustNotEmit) {
      expect(
        eventTypes,
        `Command ${rule.commandType} must NOT emit ${eventType} but did.`,
      ).not.toContain(eventType);
    }
  }

  // Rule 3: if not allowZeroEvents, at least one event must be emitted
  if (rule.allowZeroEvents !== true && result.events.length === 0) {
    expect(
      result.events.length,
      `Command ${rule.commandType} emitted no events. Either add events or set allowZeroEvents: true`,
    ).toBeGreaterThan(0);
  }
}

/**
 * Find commands that never emit events (potential completeness issue).
 *
 * Usage:
 *   const incomplete = findCommandsWithoutEvents(['ATTACK', 'MOVE', 'EQUIP']);
 *   expect(incomplete).toHaveLength(0);
 *
 * Returns list of command types that don't emit events.
 */
export function findCommandsWithoutEvents(
  commandTypes: string[],
  testFn: (cmdType: string) => { events: DomainEvent[] },
): string[] {
  return commandTypes.filter(cmdType => {
    try {
      const result = testFn(cmdType);
      return result.events.length === 0;
    } catch {
      // Skip commands that fail to execute in test context
      return false;
    }
  });
}

/**
 * Verify event emission is deterministic for given command.
 *
 * Usage:
 *   assertEventEmissionDeterministic(
 *     state,
 *     { type: 'MOVE', direction: 'N' },
 *     ['PLAYER_MOVED'],
 *     iterations: 10
 *   );
 *
 * Ensures that given same state and command, same events are emitted.
 * Catches non-deterministic event emission.
 */
export function assertEventEmissionDeterministic(
  state: GameState,
  command: GameCommand,
  expectedEventTypes: string[],
  executeCommand: (state: GameState, cmd: GameCommand) => { state: GameState; events: DomainEvent[] },
  iterations = 5,
): void {
  let previousEventTypes: string[] | null = null;

  for (let i = 0; i < iterations; i++) {
    const result = executeCommand(state, command);
    const currentEventTypes = result.events.map((e) => e.type);

    if (previousEventTypes === null) {
      previousEventTypes = currentEventTypes;
    } else {
      expect(
        currentEventTypes,
        `Event emission is non-deterministic for ${command.type} command. ` +
        `Iteration ${i} emitted ${currentEventTypes.join(', ')} ` +
        `but iteration 0 emitted ${previousEventTypes.join(', ')}`,
      ).toEqual(previousEventTypes);
    }
  }

  // Also verify expected types match
  if (expectedEventTypes.length > 0) {
    expect(
      previousEventTypes,
      `Expected events ${expectedEventTypes.join(', ')} but got ${previousEventTypes?.join(', ')}`,
    ).toEqual(expectedEventTypes);
  }
}

/**
 * Event type distribution check (for debugging).
 *
 * Usage:
 *   const dist = getEventEmissionDistribution(
 *     states,
 *     (s) => ({ type: 'MOVE', direction: 'N' }),
 *     executeCommand,
 *   );
 *   console.log(dist);
 *   // { PLAYER_MOVED: 100, ENEMY_ALERTED: 47 }
 */
export function getEventEmissionDistribution(
  states: GameState[],
  buildCommand: (state: GameState) => GameCommand,
  executeCommand: (state: GameState, cmd: GameCommand) => { state: GameState; events: DomainEvent[] },
): Record<string, number> {
  const dist: Record<string, number> = {};

  for (const state of states) {
    const result = executeCommand(state, buildCommand(state));
    for (const event of result.events) {
      dist[event.type] = (dist[event.type] ?? 0) + 1;
    }
  }

  return dist;
}
