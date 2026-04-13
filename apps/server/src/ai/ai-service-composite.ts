import type { AiService, NpcDialogueContext, RumorContext, RunSummaryContext, NemesisNameContext, NemesisLootContext } from '@dungeon/core/ai/ai-service.js';
import { queryLmStudio } from './lm-studio-client.js';
import { buildNpcDialoguePrompt, buildRumorPrompt, buildRunSummaryPrompt, buildNemesisNamePrompt, buildNemesisLootPrompt } from '@dungeon/core/ai/prompt-builders.js';
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

  async generateNemesisName(context: NemesisNameContext): Promise<{ name: string; title: string }> {
    try {
      const prompt = buildNemesisNamePrompt(context);
      const result = await queryLmStudio(prompt);
      if (result.text) {
        try {
          const parsed = JSON.parse(result.text) as { name?: string; title?: string };
          if (parsed.name && parsed.title) {
            return { name: parsed.name, title: parsed.title };
          }
        } catch {
          // fall through to fallback
        }
      }
    } catch {
      // fall through to fallback
    }
    return this.fallback.generateNemesisName(context);
  }

  async generateNemesisLoot(context: NemesisLootContext): Promise<{ name: string; description: string }> {
    try {
      const prompt = buildNemesisLootPrompt(context);
      const result = await queryLmStudio(prompt);
      if (result.text) {
        try {
          const parsed = JSON.parse(result.text) as { name?: string; description?: string };
          if (parsed.name && parsed.description) {
            return { name: parsed.name, description: parsed.description };
          }
        } catch {
          // fall through to fallback
        }
      }
    } catch {
      // fall through to fallback
    }
    return this.fallback.generateNemesisLoot(context);
  }
}
