import type { AiService, NpcDialogueContext, RumorContext, RunSummaryContext } from '@dungeon/core/ai/ai-service.js';
import { queryLmStudio } from './lm-studio-client.js';
import { buildNpcDialoguePrompt, buildRumorPrompt, buildRunSummaryPrompt } from '@dungeon/core/ai/prompt-builders.js';
import { FallbackAiService } from './fallback-ai.js';

export class CompositeAiService implements AiService {
  private fallback = new FallbackAiService();

  private async tryLmStudio(promptBuilder: () => string, fallbackFn: () => Promise<string>): Promise<string> {
    try {
      const prompt = promptBuilder();
      const result = await queryLmStudio(prompt);
      if (result.text) return result.text;
    } catch {
      // fall through to fallback
    }
    return fallbackFn();
  }

  async generateDialogue(context: NpcDialogueContext): Promise<string> {
    return this.tryLmStudio(
      () => buildNpcDialoguePrompt(context),
      () => this.fallback.generateDialogue(context),
    );
  }

  async generateRumor(context: RumorContext): Promise<string> {
    return this.tryLmStudio(
      () => buildRumorPrompt(context),
      () => this.fallback.generateRumor(context),
    );
  }

  async generateRunSummary(context: RunSummaryContext): Promise<string> {
    return this.tryLmStudio(
      () => buildRunSummaryPrompt(context),
      () => this.fallback.generateRunSummary(context),
    );
  }



}
