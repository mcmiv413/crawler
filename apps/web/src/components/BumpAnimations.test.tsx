import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { BumpAnimations } from './BumpAnimations.js';

describe('BumpAnimations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders no animations initially', () => {
    const { container } = render(
      <BumpAnimations vpLeft={0} vpTop={0} cellSize={24} duration={150} />
    );

    expect(container.querySelectorAll('[data-testid="bump-animation"]')).toHaveLength(0);
  });

  it('renders animation when bump-animation event is emitted', () => {
    const { container } = render(
      <BumpAnimations vpLeft={0} vpTop={0} cellSize={24} duration={150} />
    );

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });
    window.dispatchEvent(event);

    expect(container.querySelectorAll('[data-testid="bump-animation"]')).toHaveLength(1);
  });

  it('positions animation at attacker position', () => {
    const { container } = render(
      <BumpAnimations vpLeft={5} vpTop={5} cellSize={24} duration={150} />
    );

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });
    window.dispatchEvent(event);

    const animation = container.querySelector('[data-testid="bump-animation"]') as HTMLElement;
    expect(animation).toBeTruthy();

    // Position should be (10 - 5) * 24 = 120px left, (10 - 5) * 24 = 120px top
    expect(animation.style.left).toBe('120px');
    expect(animation.style.top).toBe('120px');
  });

  it('removes animation after duration expires', () => {
    const { container } = render(
      <BumpAnimations vpLeft={0} vpTop={0} cellSize={24} duration={150} />
    );

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });
    window.dispatchEvent(event);

    expect(container.querySelectorAll('[data-testid="bump-animation"]')).toHaveLength(1);

    // Fast-forward time past duration
    vi.advanceTimersByTime(151);

    expect(container.querySelectorAll('[data-testid="bump-animation"]')).toHaveLength(0);
  });

  it('handles multiple simultaneous animations', () => {
    const { container } = render(
      <BumpAnimations vpLeft={0} vpTop={0} cellSize={24} duration={150} />
    );

    const event1 = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });

    const event2 = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'enemy-2',
        defenderId: 'player-1',
        attackerPos: { x: 12, y: 12 },
        defenderPos: { x: 11, y: 12 },
      } as BumpAnimationEntry,
    });

    window.dispatchEvent(event1);
    window.dispatchEvent(event2);

    expect(container.querySelectorAll('[data-testid="bump-animation"]')).toHaveLength(2);
  });

  it('applies CSS animation with correct keyframes', () => {
    const { container } = render(
      <BumpAnimations vpLeft={0} vpTop={0} cellSize={24} duration={150} />
    );

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 12, y: 10 },
      } as BumpAnimationEntry,
    });
    window.dispatchEvent(event);

    const animation = container.querySelector('[data-testid="bump-animation"]') as HTMLElement;

    // Check that animation property is set
    expect(animation.style.animation).toContain('bump');
    expect(animation.style.animation).toContain('150ms');
  });
});
