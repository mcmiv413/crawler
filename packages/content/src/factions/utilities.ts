import type { FactionState } from '@dungeon/contracts';
import { FACTION_DEFINITIONS } from './index.js';
import { ENEMY_TEMPLATES } from '../enemies/index.js';

export const FACTIONS = FACTION_DEFINITIONS;

export const INITIAL_FACTIONS: readonly FactionState[] = Array.from(FACTION_DEFINITIONS.values()).map(f => ({
  id: f.id,
  name: f.name,
  power: f.initialPower,
  disposition: f.initialDisposition,
}));

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
