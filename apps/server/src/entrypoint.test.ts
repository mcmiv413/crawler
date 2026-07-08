/**
 * Test layer: unit
 * Behavior: Entrypoint covers Server entrypoint separation; buildApp() can be imported without triggering listener startup; buildApp() creates a Fastify instance.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/server/src/entrypoint.test.ts
 */
import { describe, it, expect } from 'vitest';

describe('Server entrypoint separation', () => {
  it('buildApp() can be imported without triggering listener startup', async () => {
    const { buildApp } = await import('./app.js');
    expect(typeof buildApp).toBe('function');
  }, 15000);

  it('buildApp() creates a Fastify instance', async () => {
    const { buildApp } = await import('./app.js');
    const app = await buildApp();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    expect(typeof app.routing).toBe('function');
    await app.close();
  }, 15000);

  it('hosted entrypoint exports a handler function', async () => {
    const mod = await import('./index.js');
    expect(typeof mod.default).toBe('function');
  }, 15000);
});
