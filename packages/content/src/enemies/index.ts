// Auto-generated — do not edit manually
import type { EnemyTemplate } from '@dungeon/contracts';
import { ashBeetle } from './ash-beetle.js';
import { boneShaman } from './bone-shaman.js';
import { briarNeedler } from './briar-needler.js';
import { caveRat } from './cave-rat.js';
import { chainSpecter } from './chain-specter.js';
import { crystalGolem } from './crystal-golem.js';
import { dungeonOgre } from './dungeon-ogre.js';
import { emberBat } from './ember-bat.js';
import { fireImp } from './fire-imp.js';
import { frostWraith } from './frost-wraith.js';
import { goblinArcher } from './goblin-archer.js';
import { mireToad } from './mire-toad.js';
import { mossGolem } from './moss-golem.js';
import { pitSpider } from './pit-spider.js';
import { shadowLurker } from './shadow-lurker.js';
import { shardPriest } from './shard-priest.js';
import { skeletonWarrior } from './skeleton-warrior.js';
import { buildByBiomeMap, buildByFactionMap } from '../utils/biome-map.js';

const items: [string, EnemyTemplate][] = [
  [ashBeetle.templateId, ashBeetle],
  [boneShaman.templateId, boneShaman],
  [briarNeedler.templateId, briarNeedler],
  [caveRat.templateId, caveRat],
  [chainSpecter.templateId, chainSpecter],
  [crystalGolem.templateId, crystalGolem],
  [dungeonOgre.templateId, dungeonOgre],
  [emberBat.templateId, emberBat],
  [fireImp.templateId, fireImp],
  [frostWraith.templateId, frostWraith],
  [goblinArcher.templateId, goblinArcher],
  [mireToad.templateId, mireToad],
  [mossGolem.templateId, mossGolem],
  [pitSpider.templateId, pitSpider],
  [shadowLurker.templateId, shadowLurker],
  [shardPriest.templateId, shardPriest],
  [skeletonWarrior.templateId, skeletonWarrior],
];

export const ENEMY_TEMPLATES: ReadonlyMap<string, EnemyTemplate> = new Map(items);

/** Precomputed map via buildByBiomeMap */
export const ENEMIES_BY_BIOME = buildByBiomeMap(ENEMY_TEMPLATES);
/** Precomputed map via buildByFactionMap */
export const ENEMIES_BY_FACTION = buildByFactionMap(ENEMY_TEMPLATES);

export {
  ashBeetle, boneShaman, briarNeedler, caveRat, chainSpecter, crystalGolem, dungeonOgre, emberBat, fireImp, frostWraith, goblinArcher, mireToad, mossGolem, pitSpider, shadowLurker, shardPriest, skeletonWarrior,
};

// Add custom utilities below this line ↓
