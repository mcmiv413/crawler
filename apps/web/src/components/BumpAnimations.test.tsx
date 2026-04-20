import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { BumpAnimations, emitBumpAnimation } from './BumpAnimations.js';

describe('BumpAnimations', () => {
  it('renders null (animation happens on canvas)', () => {
    const { container } = render(<BumpAnimations />);
    expect(container.firstChild).toBeNull();
  });

  it('provides emitBumpAnimation helper', () => {
    const mockListener = vi.fn();
    window.addEventListener('bump-animation', mockListener);

    const animation: BumpAnimationEntry = {
      attackerId: 'player-1' as any,
      defenderId: 'enemy-1' as any,
      attackerPos: { x: 10, y: 10 },
      defenderPos: { x: 11, y: 10 },
    };

    emitBumpAnimation(animation);

    expect(mockListener).toHaveBeenCalled();

    window.removeEventListener('bump-animation', mockListener);
  });
});
