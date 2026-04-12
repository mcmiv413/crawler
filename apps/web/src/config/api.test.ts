import { describe, it, expect } from 'vitest';

describe('API_BASE_URL config', () => {
  it('defaults to /api when VITE_API_BASE_URL is not set', async () => {
    const { API_BASE_URL } = await import('./api.js');
    expect(API_BASE_URL).toBe('/api');
  });
});
