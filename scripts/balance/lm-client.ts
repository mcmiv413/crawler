/**
 * lm-client.ts — LM Studio HTTP client for game strategy queries
 */

export const LM_HOST = process.env['LM_HOST'] ?? 'localhost';
export const LM_PORT = process.env['LM_PORT'] ?? '1234';
export const LM_TIMEOUT = 30_000;

export async function queryLmStudio(prompt: string): Promise<{ text: string | null; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LM_TIMEOUT);
  try {
    const response = await fetch(`http://${LM_HOST}:${LM_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    if (!response.ok) return { text: null, error: `LM Studio returned ${response.status}` };
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? null;
    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { text: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
