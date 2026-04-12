import type { AbilityDefinition } from './types.js';

/**
 * Registry of all ability definitions.
 * Maps ability ID to its definition for O(1) lookup.
 */
export type AbilityRegistry = ReadonlyMap<string, AbilityDefinition>;

/**
 * Build a registry from an array of ability definitions.
 */
export function buildRegistry(definitions: readonly AbilityDefinition[]): AbilityRegistry {
  const map = new Map<string, AbilityDefinition>();
  for (const def of definitions) {
    map.set(def.id, def);
  }
  return map;
}
