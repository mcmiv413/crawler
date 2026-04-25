import { ENEMY_TEMPLATES } from '../enemies/index.js';

export function getPrimaryFactionId(templateId: string): string | undefined {
  const template = ENEMY_TEMPLATES.get(templateId);
  if (template === undefined || !template.factions || template.factions.length === 0) return undefined;
  return template.factions[0]!.factionId;
}

export function getTemplateIdsForFaction(factionId: string): string[] {
  return Array.from(ENEMY_TEMPLATES.values())
    .filter(template => template.factions?.some(f => f.factionId === factionId))
    .map(template => template.templateId);
}

export function getFactionIdsForTemplate(templateId: string): string[] {
  const template = ENEMY_TEMPLATES.get(templateId);
  if (!template || !template.factions) return [];
  return template.factions.map(f => f.factionId);
}
