/**
 * Test layer: unit
 * Behavior: UseBreakpoint covers useBreakpoint Hook; returns isMobile: false when media query does not match; returns isMobile: true when media query matches.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/hooks/useBreakpoint.test.ts
 */
/**
 * useBreakpoint Hook Tests
 *
 * Verifies that the responsive breakpoint hook correctly detects
 * mobile/desktop viewport and subscribes to media query changes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBreakpoint } from './useBreakpoint.js';

describe('useBreakpoint Hook', () => {
  let addEventListenerSpy: ReturnType<typeof vi.fn>;
  let removeEventListenerSpy: ReturnType<typeof vi.fn>;
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventListenerSpy = vi.fn();
    removeEventListenerSpy = vi.fn();

    // Mock window.matchMedia
    matchMediaMock = vi.fn((query: string) => ({
      matches: false, // default: not mobile
      media: query,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      addListener: vi.fn(), // deprecated but might be called
      removeListener: vi.fn(), // deprecated but might be called
      onchange: null,
    }));

    global.window.matchMedia = matchMediaMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns isMobile: false when media query does not match', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(false);
  });

  it('returns isMobile: true when media query matches', () => {
    matchMediaMock.mockReturnValue({
      matches: true, // mobile
      media: '(max-width: 768px)',
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
    });

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(true);
  });

  it('subscribes to matchMedia change event', () => {
    renderHook(() => useBreakpoint());
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates isMobile when media query change event fires', () => {
    let changeHandler: ((e: any) => void) | null = null;

    addEventListenerSpy.mockImplementation((event: string, handler: (e: any) => void) => {
      if (event === 'change') {
        changeHandler = handler;
      }
    });

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(false);

    // Simulate media query change: now mobile
    act(() => {
      changeHandler?.({ matches: true });
    });

    expect(result.current.isMobile).toBe(true);

    // Simulate media query change: no longer mobile
    act(() => {
      changeHandler?.({ matches: false });
    });

    expect(result.current.isMobile).toBe(false);
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useBreakpoint());
    expect(removeEventListenerSpy).not.toHaveBeenCalled();

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('queries for max-width 768px breakpoint', () => {
    renderHook(() => useBreakpoint());
    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 768px)');
  });
});
