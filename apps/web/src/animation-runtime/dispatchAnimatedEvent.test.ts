import { describe, expect, it, vi } from 'vitest';
import { entityId } from '@dungeon/contracts';
import type { AnimatedEvent } from '@dungeon/presenter';
import { dispatchAnimatedEvent } from './dispatchAnimatedEvent.js';
import { triggerDefenderHit } from '../hooks/useDefenderHitState.js';

vi.mock('./emitters.js', () => ({
  emitAbilityAnimation: vi.fn(),
  emitBumpAnimation: vi.fn(),
  emitCombatIndicator: vi.fn(),
  emitConsumableAnimation: vi.fn(),
  emitMoveAnimation: vi.fn(),
}));

vi.mock('../hooks/useDefenderHitState.js', () => ({
  triggerDefenderHit: vi.fn(),
}));

vi.mock('../hooks/useHitStop.js', () => ({
  triggerHitStop: vi.fn(),
}));

function makeAnimatedEvent(overrides: Partial<AnimatedEvent>): AnimatedEvent {
  return {
    type: 'defender-hit',
    sequenceIndex: 0,
    delayMs: 0,
    beatId: 'beat-0',
    beatIndex: 0,
    beatRelativeDelayMs: 0,
    batchId: 'batch-0',
    data: {
      entityId: entityId('enemy-1'),
      durationMs: 120,
      position: { x: 7, y: 4 },
    },
    ...overrides,
  } as AnimatedEvent;
}

describe('dispatchAnimatedEvent', () => {
  it('preserves defender-hit snapshot position', () => {
    dispatchAnimatedEvent(makeAnimatedEvent({}));

    expect(triggerDefenderHit).toHaveBeenCalledWith(
      entityId('enemy-1'),
      120,
      { x: 7, y: 4 },
    );
  });
});
