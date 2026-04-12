import type { EnemyTemplate } from '@dungeon/contracts';
import { buildByBiomeMap, buildByFactionMap } from '../utils/biome-map.js';
import { skeletonWarrior } from './skeleton-warrior.js';
import { caveRat } from './cave-rat.js';
import { goblinArcher } from './goblin-archer.js';
import { shadowLurker } from './shadow-lurker.js';
import { fireImp } from './fire-imp.js';
import { mossGolem } from './moss-golem.js';
import { frostWraith } from './frost-wraith.js';
import { dungeonOgre } from './dungeon-ogre.js';
import { pitSpider } from './pit-spider.js';
import { briarNeedler } from './briar-needler.js';
import { shardPriest } from './shard-priest.js';
import { mireToad } from './mire-toad.js';
import { emberBat } from './ember-bat.js';
import { ashBeetle } from './ash-beetle.js';
import { crystalGolem } from './crystal-golem.js';
import { boneShaman } from './bone-shaman.js';
import { chainSpecter } from './chain-specter.js';

const templates: [string, EnemyTemplate][] = [
  [skeletonWarrior.templateId, skeletonWarrior],
  [caveRat.templateId, caveRat],
  [goblinArcher.templateId, goblinArcher],
  [shadowLurker.templateId, shadowLurker],
  [fireImp.templateId, fireImp],
  [mossGolem.templateId, mossGolem],
  [frostWraith.templateId, frostWraith],
  [dungeonOgre.templateId, dungeonOgre],
  [pitSpider.templateId, pitSpider],
  [briarNeedler.templateId, briarNeedler],
  [shardPriest.templateId, shardPriest],
  [mireToad.templateId, mireToad],
  [emberBat.templateId, emberBat],
  [ashBeetle.templateId, ashBeetle],
  [crystalGolem.templateId, crystalGolem],
  [boneShaman.templateId, boneShaman],
  [chainSpecter.templateId, chainSpecter],
];

export const ENEMY_TEMPLATES: ReadonlyMap<string, EnemyTemplate> = new Map(templates);

/** Precomputed map: biomeId → enemy templates that spawn there */
export const ENEMIES_BY_BIOME = buildByBiomeMap(ENEMY_TEMPLATES);

/** Precomputed map: factionId → enemy templates that belong to that faction */
export const ENEMIES_BY_FACTION = buildByFactionMap(ENEMY_TEMPLATES);

/** Returns the factionId the enemy is most affiliated with (highest weight) */
export function getPrimaryFactionId(templateId: string): string | undefined {
  const t = ENEMY_TEMPLATES.get(templateId);
  const factions = t?.factions ?? [];
  if (!t || factions.length === 0) return undefined;
  let maxWeight = 0;
  let maxFaction = factions[0];
  for (const f of factions) {
    if (f.weight > maxWeight) {
      maxWeight = f.weight;
      maxFaction = f;
    }
  }
  return maxFaction?.factionId;
}

/** Returns all factionIds an enemy belongs to */
export function getFactionIdsForTemplate(templateId: string): readonly string[] {
  return ENEMY_TEMPLATES.get(templateId)?.factions?.map(f => f.factionId) ?? [];
}

/** Returns all templateIds that belong to a faction */
export function getTemplateIdsForFaction(factionId: string): readonly string[] {
  return (ENEMIES_BY_FACTION.get(factionId) ?? []).map(t => t.templateId);
}

export {
  skeletonWarrior, caveRat, goblinArcher, shadowLurker,
  fireImp, mossGolem, frostWraith, dungeonOgre, pitSpider,
  briarNeedler, shardPriest, mireToad, emberBat, ashBeetle,
  crystalGolem, boneShaman, chainSpecter,
};
