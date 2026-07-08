/**
 * Test layer: unit
 * Behavior: id covers generateId; uses crypto.randomUUID when available; falls back to a v4 UUID when crypto is unavailable.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/utils/id.test.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from './id.js';

describe('generateId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    const expectedId = '123e4567-e89b-42d3-a456-426614174000';
    const randomUUID = vi.fn(() => expectedId);
    vi.stubGlobal('crypto', { randomUUID });

    expect(generateId()).toBe(expectedId);
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('falls back to a v4 UUID when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    const randomSpy = vi.spyOn(Math, 'random');

    const firstId = generateId();
    const secondId = generateId();

    expect(firstId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(secondId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(firstId).not.toBe(secondId);
    expect(randomSpy).not.toHaveBeenCalled();
  });
});
