import type { EnemyTemplateId } from './types.js';
import { ENEMY_TEMPLATES } from '../enemies/index.js';

export function getPrimaryFactionId(templateId: EnemyTemplateId): string | undefined {
  const template = ENEMY_TEMPLATES.get(templateId);
  if (template === undefined || !template.factions || template.factions.length === 0) return undefined;
  return template.factions[0]!.factionId;
}
