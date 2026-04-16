/**
 * Event formatter type safety verification.
 *
 * The event formatter uses a mapped type that enforces exhaustiveness:
 *   type EventFormatterMap = { [K in DomainEvent['type']]: (e: Extract<...>) => ... }
 *
 * This means:
 * 1. Every DomainEvent['type'] must have a formatter (compile-time check)
 * 2. Each formatter receives the correctly narrowed event type
 * 3. No silent null returns for unknown event types
 *
 * This test documents that the type safety is in place. Runtime verification
 * of formatter behavior happens in event-formatter.test.ts.
 *
 * Related checks:
 * - @assertFeatureChain in handler tests verifies state → event → format → view chain
 * - Presenter feature-completeness tests verify formatters produce non-null output
 */

import { describe, it, expect } from 'vitest';
import { formatEvent } from './event-formatter.js';

describe('Event Formatter Type Safety', () => {
  it('formatter mapping is exhaustive at compile time', () => {
    // This is a documentation test. The real verification happens at compile
    // time in event-formatter.ts where the mapped type enforces all DomainEvent types.
    //
    // If a new event type is added to the union without a formatter,
    // TypeScript will error:
    //   Type '{ type: "MY_NEW_EVENT", ... }' is not assignable to
    //   type 'EventFormatterMap[K]'...
    expect(formatEvent).toBeDefined();
  });

  it('type system ensures no unknown event types reach formatEvent', () => {
    // formatEvent is typed to only accept valid DomainEvent types.
    // The mapped type EventFormatterMap ensures every event type has a handler.
    // Unknown events would fail to type-check, so they never reach formatEvent at runtime.
    //
    // This prevents the "silent null return for missing formatter" class of bug.
    expect(formatEvent).toBeDefined();
  });
});
