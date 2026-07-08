/**
 * Test layer: unit
 * Behavior: BumpAnimations stays DOM-less while the runtime emitter publishes bump-animation events to window listeners.
 * Proof: Asserts the rendered container has no firstChild and a listener registered for bump-animation is called after emitBumpAnimation receives a BumpAnimationEntry.
 * Validation: pnpm vitest run apps/web/src/components/BumpAnimations.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { emitBumpAnimation } from '../animation-runtime/emitters.js';
import { BumpAnimations } from './BumpAnimations.js';

describe('BumpAnimations', () => {
  it('renders null (animation happens on canvas)', () => {
    const { container } = render(<BumpAnimations />);
    expect(container.firstChild).toBeNull();
  });

  it('dispatches bump events through the runtime emitter boundary', () => {
    const mockListener = vi.fn();
    window.addEventListener('bump-animation', mockListener);

    const animation: BumpAnimationEntry = {
      attackerId: 'player-1' as any,
      defenderId: 'enemy-1' as any,
      attackerPos: { x: 10, y: 10 },
      defenderPos: { x: 11, y: 10 },
      durationMs: 150,
      impactFrameMs: 75,
    };

    emitBumpAnimation(animation);

    expect(mockListener).toHaveBeenCalled();

    window.removeEventListener('bump-animation', mockListener);
  });
});
