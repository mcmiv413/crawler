import type { EnemyTemplate, ObjectTemplate } from '@dungeon/contracts';

type HasBiomes = EnemyTemplate | ObjectTemplate;
type HasFactions = { factions?: ReadonlyArray<{ factionId: string }> };

/**
 * Private generic that builds an inverted map from templates to grouped keys.
 * Both biome and faction maps delegate to this for DRY consistency.
 */
function buildInvertedMap<T, K extends string>(
  templates: ReadonlyMap<string, T>,
  getKeys: (t: T) => readonly K[],
): ReadonlyMap<K, readonly T[]> {
  const map = new Map<K, T[]>();
  for (const t of templates.values()) {
    for (const key of getKeys(t)) {
      map.set(key, [...(map.get(key) ?? []), t]);
    }
  }
  return map;
}

export function buildByBiomeMap<T extends HasBiomes>(
  templates: ReadonlyMap<string, T>,
): ReadonlyMap<string, readonly T[]> {
  return buildInvertedMap(templates, t => t.biomes?.map(b => b.biomeId) ?? []);
}

export function buildByFactionMap<T extends HasFactions>(
  templates: ReadonlyMap<string, T>,
): ReadonlyMap<string, readonly T[]> {
  return buildInvertedMap(templates, t => t.factions?.map(f => f.factionId) ?? []);
}
