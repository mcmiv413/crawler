/**
 * Test layer: unit
 * Behavior: queryLmStudio posts chat-completion prompts to LM Studio and normalizes success, malformed response, HTTP error, network error, and missing-content outcomes.
 * Proof: Assertions check returned text or text-null error objects, trimmed content, fetch URL/method/body fields, status-code error messages, invalid JSON errors, and non-Error rejection text.
 * Validation: pnpm vitest run apps/server/src/ai/lm-studio-client.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { queryLmStudio } from './lm-studio-client.js';

describe('queryLmStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('returns text on successful API response', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        choices: [{ message: { content: 'Test response' } }],
      }),
      { status: 200 }
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('test prompt');

    expect(result).toEqual({ text: 'Test response' });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/chat/completions'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('trims whitespace from response text', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        choices: [{ message: { content: '  Trimmed text  \n' } }],
      }),
      { status: 200 }
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({ text: 'Trimmed text' });
  });

  it('returns null text and error on non-OK status', async () => {
    const mockResponse = new Response(null, { status: 500 });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({
      text: null,
      error: 'LM Studio returned 500',
    });
  });

  it('handles 400 Bad Request', async () => {
    const mockResponse = new Response(null, { status: 400 });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('bad prompt');

    expect(result).toEqual({
      text: null,
      error: 'LM Studio returned 400',
    });
  });

  it('returns error on network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('Network error')
    );

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({
      text: null,
      error: 'Network error',
    });
  });

  it('returns error on invalid JSON response', async () => {
    const mockResponse = new Response('not valid json', { status: 200 });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({
      text: null,
      error: expect.stringContaining('Unexpected token'),
    });
  });

  it('returns null text when response lacks choices', async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({ text: null });
  });

  it('returns null text when choices is empty', async () => {
    const mockResponse = new Response(
      JSON.stringify({ choices: [] }),
      { status: 200 }
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({ text: null });
  });

  it('returns null text when message is missing', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        choices: [{}],
      }),
      { status: 200 }
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({ text: null });
  });

  it('returns null text when content is missing', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        choices: [{ message: {} }],
      }),
      { status: 200 }
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({ text: null });
  });

  it('sends correct request body with temperature and max_tokens', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        choices: [{ message: { content: 'response' } }],
      }),
      { status: 200 }
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse);

    await queryLmStudio('test prompt');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test prompt' }],
          temperature: 0.7,
          max_tokens: 200,
        }),
      })
    );
  });

  it('makes request to lm-studio endpoint', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        choices: [{ message: { content: 'response' } }],
      }),
      { status: 200 }
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse);

    await queryLmStudio('prompt');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/chat/completions'),
      expect.any(Object)
    );
  });

  it('returns error with non-Error object caught', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce('Unknown error');

    const result = await queryLmStudio('prompt');

    expect(result).toEqual({
      text: null,
      error: 'Unknown error',
    });
  });
});
