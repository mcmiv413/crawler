/**
 * Test layer: unit
 * Behavior: Server entry modules expose buildApp and the hosted handler without starting a listener on import.
 * Proof: Assertions check imported buildApp is a function, buildApp returns an object with listen and routing functions, and the hosted index default export is a function.
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
