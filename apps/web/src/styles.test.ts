/**
 * Test layer: unit
 * Behavior: Styles covers Typography tokens (Slice 1); should export fontSize tokens with mobile-friendly values; should ensure primary mobile text is 15px or larger.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/styles.test.ts
 */
import { describe, it, expect } from 'vitest';
import { fontSize, spacing } from './styles.js';

describe('Typography tokens (Slice 1)', () => {
  it('should export fontSize tokens with mobile-friendly values', () => {
    expect(fontSize.pageTitle).toBe(22);
    expect(fontSize.panelTitle).toBe(18);
    expect(fontSize.sectionTitle).toBe(16);
    expect(fontSize.body).toBe(15);
    expect(fontSize.bodySmall).toBe(14);
    expect(fontSize.meta).toBe(13);
    expect(fontSize.micro).toBe(12);
  });

  it('should ensure primary mobile text is 15px or larger', () => {
    expect(fontSize.body).toBeGreaterThanOrEqual(15);
    expect(fontSize.pageTitle).toBeGreaterThanOrEqual(15);
    expect(fontSize.panelTitle).toBeGreaterThanOrEqual(15);
    expect(fontSize.sectionTitle).toBeGreaterThanOrEqual(15);
  });

  it('should ensure secondary mobile text is 14px or larger', () => {
    expect(fontSize.bodySmall).toBeGreaterThanOrEqual(14);
  });

  it('should ensure metadata is 12px or larger', () => {
    expect(fontSize.meta).toBeGreaterThanOrEqual(12);
    expect(fontSize.micro).toBeGreaterThanOrEqual(12);
  });

  it('should export spacing tokens', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
  });

  it('should not have any 9px or 10px tokens in fontSize', () => {
    const values = Object.values(fontSize);
    expect(values).not.toContain(9);
    expect(values).not.toContain(10);
    expect(values).not.toContain(11);
  });
});
