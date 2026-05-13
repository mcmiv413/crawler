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
 * See CLAUDE.md "Feature Completeness" section for full details.
 */

export interface FeatureChainAssertion {
  /** Event type that must be emitted (e.g., 'ATTACK_PERFORMED') */
  eventType?: string;
  /** Optional: verify specific event count (default 1+) */
  eventCount?: number;
  /** Optional: verify the feature is triggerable from the before-state */
  entryCheck?: (before: GameState) => boolean;
  /** Optional: verify state changed correctly */
  stateChanges?: (before: GameState, after: GameState) => boolean;
  /** Optional: verify presenter output contains the change */
  viewChecks?: (before: GameView, after: GameView) => boolean;
  /** Optional: verify UI-facing GameView data is present for downstream render tests */
  uiCheck?: (view: GameView) => boolean;
  /** Optional: verify event can be formatted for display */
  formattingCheck?: (event: DomainEvent) => boolean;
  /** Optional: verify run metrics updated */
  metricsCheck?: (before: GameState, after: GameState) => boolean;
}

/**
 * Assert a complete feature chain in one call.
 *
 * Usage:
 *   const result = handleCommand(state, { type: 'ATTACK', targetId }, rng());
 *   assertFeatureChain(result, {
 *     eventType: 'ATTACK_PERFORMED',
 *     stateChanges: (before, after) =>
 *       (after.run?.runMetrics?.damageDealt ?? 0) > (before.run?.runMetrics?.damageDealt ?? 0),
 *     formattingCheck: (e) => formatEvent(e) !== null,
 *   });
 *
 * This validates:
 *   - Link 1: Entry point is available when entryCheck is provided
 *   - Link 3: Event was emitted
 *   - Link 2: State changed as expected
 *   - Link 5: Event can be formatted (will show in UI)
 *   - Link 4: GameView exposes the expected UI-facing data
 *
 * React render assertions still belong in component tests. uiCheck is for the
 * presenter-owned view contract that those component tests consume.
 */
export function assertFeatureChain(
  result: { state: GameState; events: readonly DomainEvent[] },
  beforeState: GameState,
  assertions: FeatureChainAssertion,
): void {
  const { state: afterState, events } = result;
  const needsViews = assertions.viewChecks !== undefined || assertions.uiCheck !== undefined;
  const beforeView = needsViews ? buildGameView(beforeState) : null;
  const afterView = needsViews ? buildGameView(afterState) : null;

  // Link 1: entry point is available from the before-state
  if (assertions.entryCheck) {
    expect(
      assertions.entryCheck(beforeState),
      'Expected the feature entry point to be triggerable from the before-state',
    ).toBe(true);
  }

  // Link 3: Event emission
  if (assertions.eventType) {
    expectEventEmitted(events, assertions.eventType, assertions.eventCount ?? 1);
  }

  // Link 2: State changes
  if (assertions.stateChanges) {
    expect(assertions.stateChanges(beforeState, afterState)).toBe(true);
  }

  // Link 5: Formatter handles the event
  if (assertions.formattingCheck && assertions.eventType) {
    const matchingEvents = events.filter((e) => e.type === assertions.eventType);
    for (const event of matchingEvents) {
      expect(assertions.formattingCheck(event)).toBe(true);
    }
  }

  // Link 4: View updated (optional detailed check)
  if (assertions.viewChecks && beforeView && afterView) {
    expect(
      assertions.viewChecks(beforeView, afterView),
      'Expected the presenter view to expose the feature change',
    ).toBe(true);
  }

  // Link 5: UI-facing GameView data is present for component render tests
  if (assertions.uiCheck && afterView) {
    expect(
      assertions.uiCheck(afterView),
      'Expected the GameView to contain the UI-facing data for this feature',
    ).toBe(true);
  }

  // Metrics updated (optional)
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
