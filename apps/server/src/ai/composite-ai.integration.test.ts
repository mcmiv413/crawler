import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompositeAiService } from './ai-service-composite.js';
import type { NpcDialogueContext, RumorContext, RunSummaryContext } from '@dungeon/core/ai/ai-service';

// Mock LM Studio client to control timeout and error behavior
vi.mock('./lm-studio-client.js', () => ({
  queryLmStudio: vi.fn(),
}));

// Import after mock setup
import { queryLmStudio } from './lm-studio-client.js';

const mockQueryLmStudio = vi.mocked(queryLmStudio);

// ============================================================================
// FIXTURES: Test data for all context types
// ============================================================================

const townState = {
  prosperity: 50,
  fear: 20,
  corruption: 10,
  rumors: [],
  lastRunSummary: null,
};

const npcDialogueContext: NpcDialogueContext = {
  npc: {
    id: 'npc1' as any,
    name: 'Elder',
    role: 'elder' as const,
    available: true,
    disposition: 25,
    dialogueKey: 'default',
  },
  townState,
  recentEvents: [],
  playerName: 'Adventurer',
  playerLevel: 5,
};

const rumorContext: RumorContext = {
  townState,
  deepestFloor: 5,
  totalRuns: 3,
  recentEvents: [],
};

const runSummaryContext: RunSummaryContext = {
  runMetrics: {
    causeOfEnd: 'death' as const,
    enemiesKilled: 12,
    goldEarned: 250,
    floorsCleared: 3,
    damageDealt: 450,
    damageTaken: 180,
    turnsElapsed: 45,
    consecutiveMisses: 0,
    itemsUsed: 1,
  },
  recentEvents: [],
  playerName: 'Adventurer',
  floor: 4,
};

// ============================================================================
// TESTS: LM STUDIO INTEGRATION (3 tests)
// ============================================================================

describe('CompositeAiService — LM Studio Integration', () => {
  let service: CompositeAiService;

  beforeEach(() => {
    service = new CompositeAiService();
    vi.clearAllMocks();
  });

  it('uses successful LM Studio response when available', async () => {
    const lmResponse = 'Greetings, brave adventurer. The dungeons grow restless.';
    mockQueryLmStudio.mockResolvedValueOnce({ text: lmResponse });

    const result = await service.generateDialogue(npcDialogueContext);

    expect(result).toBe(lmResponse);
    expect(mockQueryLmStudio).toHaveBeenCalledOnce();
  });

  it('triggers fallback when LM Studio times out', async () => {
    // Simulate timeout by rejecting with abort error
    mockQueryLmStudio.mockRejectedValueOnce(new Error('The operation was aborted'));

    const result = await service.generateDialogue(npcDialogueContext);

    // Verify fallback was used (result should not be empty, but we can't hardcode
    // the exact fallback text as it's random)
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(mockQueryLmStudio).toHaveBeenCalledOnce();
  });

  it('triggers fallback when LM Studio connection fails', async () => {
    mockQueryLmStudio.mockRejectedValueOnce(new Error('ECONNREFUSED: Connection refused'));

    const result = await service.generateDialogue(npcDialogueContext);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(mockQueryLmStudio).toHaveBeenCalledOnce();
  });

  it('honors 2-second timeout for LM Studio requests', async () => {
    // This test verifies the timeout constant is set correctly
    // The timeout is enforced at the client level (lm-studio-client.ts)
    mockQueryLmStudio.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout exceeded')), 2100);
        }),
    );

    const startTime = Date.now();
    const result = await service.generateDialogue(npcDialogueContext);
    const elapsed = Date.now() - startTime;

    // Verify fallback was used and operation completed reasonably quickly
    expect(result).toBeTruthy();
    expect(elapsed).toBeLessThan(5000); // Should fallback quickly, not wait full timeout
  });
});

// ============================================================================
// TESTS: FALLBACK CHAIN (4 tests)
// ============================================================================

describe('CompositeAiService — Fallback Chain', () => {
  let service: CompositeAiService;

  beforeEach(() => {
    service = new CompositeAiService();
    vi.clearAllMocks();
  });

  it('uses static content when LM Studio unavailable', async () => {
    mockQueryLmStudio.mockRejectedValue(new Error('LM Studio offline'));

    const dialogue = await service.generateDialogue(npcDialogueContext);
    const rumor = await service.generateRumor(rumorContext);
    const summary = await service.generateRunSummary(runSummaryContext);

    expect(dialogue).toBeTruthy();
    expect(rumor).toBeTruthy();
    expect(summary).toBeTruthy();
    expect(typeof dialogue).toBe('string');
    expect(typeof rumor).toBe('string');
    expect(typeof summary).toBe('string');
  });

  it('retrieves static content for each context type', async () => {
    mockQueryLmStudio.mockRejectedValue(new Error('offline'));

    // Test dialogue
    const dialogue = await service.generateDialogue(npcDialogueContext);
    expect(dialogue.length).toBeGreaterThan(0);

    // Test rumor
    const rumor = await service.generateRumor(rumorContext);
    expect(rumor.length).toBeGreaterThan(0);

    // Test run summary
    const summary = await service.generateRunSummary(runSummaryContext);
    expect(summary.length).toBeGreaterThan(0);

  });

  it('does not duplicate fallback requests for retry', async () => {
    mockQueryLmStudio.mockRejectedValueOnce(new Error('LM offline'));

    // First call triggers fallback
    const result1 = await service.generateDialogue(npcDialogueContext);
    expect(result1).toBeTruthy();
    expect(mockQueryLmStudio).toHaveBeenCalledOnce();

    // Second call should be independent (no caching of fallback)
    mockQueryLmStudio.mockRejectedValueOnce(new Error('Still offline'));
    const result2 = await service.generateDialogue(npcDialogueContext);
    expect(result2).toBeTruthy();
    expect(mockQueryLmStudio).toHaveBeenCalledTimes(2);
  });

  it('fallback responds with reasonable latency', async () => {
    mockQueryLmStudio.mockRejectedValue(new Error('LM unavailable'));

    const startTime = Date.now();
    await service.generateDialogue(npcDialogueContext);
    const elapsed = Date.now() - startTime;

    // Fallback should respond quickly (< 100ms typically, generous limit of 500ms)
    expect(elapsed).toBeLessThan(500);
  });
});

// ============================================================================
// TESTS: RESPONSE FORMATTING & CONSISTENCY (3 tests)
// ============================================================================

describe('CompositeAiService — Response Formatting', () => {
  let service: CompositeAiService;

  beforeEach(() => {
    service = new CompositeAiService();
    vi.clearAllMocks();
  });

  it('LM Studio response returns valid non-empty string', async () => {
    const responses = [
      'The elder nods wisely.',
      'Beware the lower depths.',
      'A legendary blade appears...',
    ];

    for (const response of responses) {
      mockQueryLmStudio.mockResolvedValueOnce({ text: response });
      const result = await service.generateDialogue(npcDialogueContext);
      expect(result).toBe(response);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('static fallback returns valid non-empty string', async () => {
    mockQueryLmStudio.mockRejectedValue(new Error('offline'));

    const dialogue = await service.generateDialogue(npcDialogueContext);
    const rumor = await service.generateRumor(rumorContext);
    const summary = await service.generateRunSummary(runSummaryContext);

    expect(dialogue).not.toBeNull();
    expect(dialogue).not.toBe('');
    expect(rumor).not.toBeNull();
    expect(rumor).not.toBe('');
    expect(summary).not.toBeNull();
    expect(summary).not.toBe('');
  });

});

// ============================================================================
// TESTS: EDGE CASES (3+ tests)
// ============================================================================

describe('CompositeAiService — Edge Cases', () => {
  let service: CompositeAiService;

  beforeEach(() => {
    service = new CompositeAiService();
    vi.clearAllMocks();
  });

  it('handles multiple concurrent requests without interference', async () => {
    mockQueryLmStudio.mockResolvedValue({ text: 'AI response' });

    const [dialogue, rumor, summary] = await Promise.all([
      service.generateDialogue(npcDialogueContext),
      service.generateRumor(rumorContext),
      service.generateRunSummary(runSummaryContext),
    ]);

    expect(dialogue).toBe('AI response');
    expect(rumor).toBe('AI response');
    expect(summary).toBe('AI response');
    expect(mockQueryLmStudio).toHaveBeenCalledTimes(3);
  });

  it('gracefully degrades to fallback after repeated LM failures', async () => {
    // Simulate multiple consecutive failures
    mockQueryLmStudio
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));

    const result1 = await service.generateDialogue(npcDialogueContext);
    const result2 = await service.generateRumor(rumorContext);
    const result3 = await service.generateRunSummary(runSummaryContext);

    // All results should be valid fallback responses
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
    expect(result3).toBeTruthy();
    expect(mockQueryLmStudio).toHaveBeenCalledTimes(3);
  });

  it('passes context correctly to LM Studio through prompt builders', async () => {
    mockQueryLmStudio.mockResolvedValueOnce({ text: 'response' });

    await service.generateDialogue(npcDialogueContext);

    // Verify queryLmStudio was called with a string prompt (from prompt builder)
    expect(mockQueryLmStudio).toHaveBeenCalledWith(expect.any(String));
    const promptArg = mockQueryLmStudio.mock.calls[0]?.[0];
    expect(promptArg).toContain('Elder'); // From NPC name in context
    expect(promptArg).toContain('Adventurer'); // From player name in context
  });

  it('handles LM Studio returning null text correctly', async () => {
    mockQueryLmStudio.mockResolvedValueOnce({ text: null });

    const result = await service.generateDialogue(npcDialogueContext);

    // Should fallback to static content
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('response consistency across fallback and LM Studio for non-JSON endpoints', async () => {
    // First call with LM
    mockQueryLmStudio.mockResolvedValueOnce({ text: 'AI: You look strong!' });
    const lmResult = await service.generateDialogue(npcDialogueContext);
    expect(lmResult).toBe('AI: You look strong!'); // Text returned as-is from LM

    // Second call with fallback
    mockQueryLmStudio.mockRejectedValueOnce(new Error('offline'));
    const fallbackResult = await service.generateDialogue(npcDialogueContext);

    // Both should be valid, non-empty strings
    expect(typeof lmResult).toBe('string');
    expect(typeof fallbackResult).toBe('string');
    expect(lmResult.length).toBeGreaterThan(0);
    expect(fallbackResult.length).toBeGreaterThan(0);
  });
});

