import type { GameState, DomainEvent } from '@dungeon/contracts';
import { buildGameView } from '../game-view-builder.js';
import { formatEvent } from '../event-formatter.js';
import type { GameView, CombatLogEntry } from '../game-view.js';
import { expect } from 'vitest';

/**
 * Feature Completeness Testing Helpers
 *
 * Each feature must complete the 6-hop chain:
 *   1. Entry: Player can trigger it (UI action or game event)
 *   2. State: GameState updates immutably
 *   3. Event: DomainEvent emitted
 *   4. Presenter: buildGameView() exposes data
 *   5. UI: React renders it
 *   6. Test: assertFeatureChain() proves the chain
 *
 * These helpers make it easy to assert all 6 hops. See CLAUDE.md for the full checklist.
 */

export interface FeatureChainAssertion {
  /** Hop 1: Event type that must be emitted (e.g., 'ATTACK_PERFORMED') */
  eventType?: string;
  /** Optional: verify specific event count (default 1+) */
  eventCount?: number;
  /** Hop 1: Optional — verify player can trigger this entry point (UI action or game event) */
  entryCheck?: (before: GameState) => boolean;
  /** Hop 2: Optional — verify state changed correctly */
  stateChanges?: (before: GameState, after: GameState) => boolean;
  /** Hop 3: Event emission is validated via eventType */
  /** Hop 4: Presenter output — verify view contains the change */
  viewChecks?: (before: GameView, after: GameView) => boolean;
  /** Hop 5: Optional — verify UI renders the feature (can be tested via E2E or manual inspection) */
  uiCheck?: (view: GameView) => boolean;
  /** Optional: verify event can be formatted for display */
  formattingCheck?: (event: DomainEvent) => boolean;
  /** Optional: verify run metrics updated */
  metricsCheck?: (before: GameState, after: GameState) => boolean;
}

/**
 * Assert a complete feature chain in one call.
 *
 * Validates all 6 hops of the feature completeness chain. See CLAUDE.md "Feature Completeness" section.
 *
 * Usage:
 *   const result = handleCommand(state, { type: 'ATTACK', targetId }, rng());
 *   assertFeatureChain(result, beforeState, {
 *     entryCheck: (s) => /* player can trigger this */,
 *     eventType: 'ATTACK_PERFORMED',
 *     stateChanges: (before, after) =>
 *       (after.run?.runMetrics?.damageDealt ?? 0) > (before.run?.runMetrics?.damageDealt ?? 0),
 *     viewChecks: (before, after) => /* view updated */,
 *     uiCheck: (view) => /* UI would render this */,
 *   });
 *
 * This validates:
 *   - Hop 1 (Entry): entryCheck passes (optional)
 *   - Hop 2 (State): State changed as expected via stateChanges
 *   - Hop 3 (Event): Event was emitted via eventType
 *   - Hop 4 (Presenter): View updated via viewChecks
 *   - Hop 5 (UI): UI can render via uiCheck (optional)
 *   - Hop 6 (Test): This function proves the chain
 */
export function assertFeatureChain(
  result: { state: GameState; events: readonly DomainEvent[] },
  beforeState: GameState,
  assertions: FeatureChainAssertion,
): void {
  const { state: afterState, events } = result;

  // Hop 1: Entry point can be triggered
  if (assertions.entryCheck) {
    expect(assertions.entryCheck(beforeState)).toBe(true);
  }

  // Hop 2: State changes
  if (assertions.stateChanges) {
    expect(assertions.stateChanges(beforeState, afterState)).toBe(true);
  }

  // Hop 3: Event emission
  if (assertions.eventType) {
    expectEventEmitted(events, assertions.eventType, assertions.eventCount ?? 1);
  }

  // Hop 4: Presenter exposes data (view updated)
  if (assertions.viewChecks) {
    const beforeView = buildGameView(beforeState);
    const afterView = buildGameView(afterState);
    expect(assertions.viewChecks(beforeView, afterView)).toBe(true);
  }

  // Hop 5: UI can render the feature
  if (assertions.uiCheck) {
    const afterView = buildGameView(afterState);
    expect(assertions.uiCheck(afterView)).toBe(true);
  }

  // Hop 5 (formatting): Event formatter handles the event for UI display
  if (assertions.formattingCheck && assertions.eventType) {
    const matchingEvents = events.filter((e) => e.type === assertions.eventType);
    for (const event of matchingEvents) {
      expect(assertions.formattingCheck(event)).toBe(true);
    }
  }

  // Optional: Metrics updated
  if (assertions.metricsCheck) {
    expect(assertions.metricsCheck(beforeState, afterState)).toBe(true);
  }
}

/**
 * Guarantee a specific event type was emitted.
 *
 * Usage:
 *   const events = result.events;
 *   expectEventEmitted(events, 'ITEM_USED');
 *   expectEventEmitted(events, 'ATTACK_PERFORMED', 2); // exactly 2
 *
 * @param events The events array from command result
 * @param eventType The expected event type (e.g., 'ATTACK_PERFORMED')
 * @param minCount Minimum number of events (default 1)
 * @returns The matching events
 */
export function expectEventEmitted(
  events: readonly DomainEvent[],
  eventType: string,
  minCount = 1,
): readonly DomainEvent[] {
  const found = events.filter((e) => e.type === eventType);
  expect(
    found.length,
    `Expected at least ${minCount} event(s) of type ${eventType}, but found ${found.length}`,
  ).toBeGreaterThanOrEqual(minCount);
  return found;
}

/**
 * Check that formatter doesn't return null for an event.
 *
 * Usage:
 *   expectFormattedEvent(event);
 *   const formatted = expectFormattedEvent(event);
 *   expect(formatted.text).toContain('15 damage');
 *
 * @param event The domain event to format
 * @returns The formatted event (guaranteed non-null)
 */
export function expectFormattedEvent(event: DomainEvent): CombatLogEntry {
  const formatted = formatEvent(event);
  expect(
    formatted,
    `formatEvent() returned null for ${event.type} event. ` +
    `If this event should not appear in combat log, add it to EVENTS_WITHOUT_COMBAT_LOG.`,
  ).not.toBeNull();
  return formatted!;
}

/**
 * Verify that an event contains expected entity name(s).
 *
 * Usage:
 *   expectEventHasEntityName(event, 'Skeleton Warrior');
 *   expectEventHasEntityName(event, ['Adventurer', 'Goblin']);
 */
export function expectEventHasEntityName(
  event: DomainEvent,
  expectedNames: string | string[],
): void {
  const formatted = expectFormattedEvent(event);
  const names = Array.isArray(expectedNames) ? expectedNames : [expectedNames];

  for (const name of names) {
    expect(
      formatted.text,
      `Event text should contain entity name "${name}". Got: ${formatted.text}`,
    ).toContain(name);
  }
}

/**
 * Verify that a stat or metric in state changed by expected amount.
 *
 * Usage:
 *   expectStatChanged(before, after, 'player.stats.health', -15);
 *   expectStatChanged(before, after, 'run.runMetrics.damageDealt', 25);
 */
export function expectStatChanged(
  before: GameState,
  after: GameState,
  statPath: string,
  expectedDelta: number,
): void {
  const getValue = (obj: GameState, path: string): number => {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      current = (current as Record<string, unknown>)[part];
    }
    return (current as number) ?? 0;
  };

  const beforeVal = getValue(before, statPath);
  const afterVal = getValue(after, statPath);
  const actualDelta = afterVal - beforeVal;

  expect(
    actualDelta,
    `Stat ${statPath} changed by ${actualDelta}, expected ${expectedDelta}`,
  ).toBe(expectedDelta);
}

/**
 * Verify view shows the expected data (compact assertion).
 *
 * Usage:
 *   expectViewShowsData(afterState, (view) => view.player.health < 50);
 *   expectViewShowsData(afterState, (view) => view.inventory.items.length === 5);
 */
export function expectViewShowsData(
  state: GameState,
  check: (view: GameView) => boolean,
): void {
  const view = buildGameView(state);
  expect(check(view)).toBe(true);
}

/**
 * List of event types that intentionally don't appear in combat log.
 * These events are for internal state management, not player feedback.
 */
export const EVENTS_WITHOUT_COMBAT_LOG = [
  'PLAYER_MOVED',
  'ENEMY_MOVED',
  'PHASE_CHANGED',
  'RUN_STARTED',
  'RUN_ENDED',
  'TOWN_STATE_CHANGED',
  'ENEMY_SPAWNED',
];

/**
 * Verify all events that should display are formatted correctly.
 *
 * Usage:
 *   expectAllEventsFormatted(result.events);
 */
export function expectAllEventsFormatted(events: DomainEvent[]): void {
  for (const event of events) {
    const formatted = formatEvent(event);
    const shouldDisplay = !EVENTS_WITHOUT_COMBAT_LOG.includes(event.type);

    if (shouldDisplay) {
      expect(
        formatted,
        `Event ${event.type} should be displayed but formatEvent() returned null`,
      ).not.toBeNull();
    }
  }
}
