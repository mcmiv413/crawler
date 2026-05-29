import { describe, expect, it } from 'vitest';
import {
  getDefaultEvalProfiles,
  getGoofyProfile,
  getInstallableGoofyProfiles,
  loadGoofyModelCatalog,
  profileToOllamaCreateRequest,
} from '../../scripts/local-ai/goofy-catalog.mjs';
import { extractFirstJsonObject, gradeEvalCase, loadGoofyEvalSuite, renderEvalPrompt } from '../../scripts/local-ai/goofy-eval-lib.mjs';

describe('goofy local model catalog', () => {
  it('tracks the recommended Q4 default and Q3 fallback', () => {
    const catalog = loadGoofyModelCatalog();
    const q4 = getGoofyProfile(catalog, catalog.defaultProfileId);
    const q3 = getGoofyProfile(catalog, 'goofy-qwen3-coder-q3');

    expect(q4.model).toBe('goofy-qwen3-coder-q4');
    expect(q4.from).toBe('hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q4_K_XL');
    expect(q4.contextLength).toBe(65536);
    expect(q4.stretchContextLengths).toEqual([98304, 131072]);
    expect(q4.temperature).toBe(0.7);
    expect(q4.topP).toBe(0.8);
    expect(q4.topK).toBe(20);
    expect(q4.repeatPenalty).toBe(1.05);

    expect(q3.model).toBe('goofy-qwen3-coder-q3');
    expect(q3.from).toBe('hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q3_K_XL');
    expect(q3.contextLength).toBe(65536);
  });

  it('keeps the current Goofy baseline available for evaluation', () => {
    const catalog = loadGoofyModelCatalog();
    const baseline = getGoofyProfile(catalog, 'current-qwen35-27b');

    expect(baseline.install).toBe(false);
    expect(baseline.model).toBe('qwen3.5:27b');
    expect(baseline.contextLength).toBe(32768);

    const defaultEvalProfiles = getDefaultEvalProfiles(catalog).map((profile) => profile.id);
    expect(defaultEvalProfiles).toEqual(['current-qwen35-27b', 'goofy-qwen3-coder-q4', 'goofy-qwen3-coder-q3']);
  });

  it('maps installable profiles to Ollama create requests', () => {
    const catalog = loadGoofyModelCatalog();
    const installableProfiles = getInstallableGoofyProfiles(catalog);

    expect(installableProfiles.map((profile) => profile.id)).toEqual(['goofy-qwen3-coder-q4', 'goofy-qwen3-coder-q3']);

    const createRequest = profileToOllamaCreateRequest(installableProfiles[0]);
    expect(createRequest).toEqual({
      model: 'goofy-qwen3-coder-q4',
      from: 'hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q4_K_XL',
      parameters: {
        num_ctx: 65536,
        temperature: 0.7,
        top_p: 0.8,
        top_k: 20,
        repeat_penalty: 1.05,
      },
    });
  });
});

describe('goofy eval helpers', () => {
  it('renders prompts with explicit file lists and JSON schema', () => {
    const suite = loadGoofyEvalSuite();
    const prompt = renderEvalPrompt(suite.cases[0], '/repo');

    expect(prompt).toContain('/repo/scripts/local-ai/fixtures/mini-repo/overview.fixture');
    expect(prompt).toContain('{"caseId":"architecture-presenter","choice":"A|B|C","confidence":"high|medium|low"}');
    expect(prompt).toContain('Do not add markdown fences or prose.');
  });

  it('extracts JSON from raw output with launcher noise or fences', () => {
    expect(extractFirstJsonObject('{"caseId":"x","choice":"A","confidence":"high"}')).toEqual({
      caseId: 'x',
      choice: 'A',
      confidence: 'high',
    });

    expect(
      extractFirstJsonObject(
        [
          'Claude/Ollama profile',
          'Model: goofy-qwen3-coder-q4',
          '```json',
          '{"caseId":"x","choice":"B","confidence":"medium"}',
          '```',
        ].join('\n'),
      ),
    ).toEqual({
      caseId: 'x',
      choice: 'B',
      confidence: 'medium',
    });
  });

  it('grades parsed outputs against the expected choice', () => {
    const suite = loadGoofyEvalSuite();
    const evalCase = suite.cases[0];

    expect(gradeEvalCase(evalCase, '{"caseId":"architecture-presenter","choice":"B","confidence":"high"}')).toMatchObject({
      passed: true,
      validJson: true,
      actualChoice: 'B',
    });

    expect(gradeEvalCase(evalCase, '{"caseId":"architecture-presenter","choice":"A","confidence":"high"}')).toMatchObject({
      passed: false,
      validJson: true,
      actualChoice: 'A',
    });

    expect(gradeEvalCase(evalCase, 'not json')).toMatchObject({
      passed: false,
      validJson: false,
      actualChoice: null,
    });
  });
});
