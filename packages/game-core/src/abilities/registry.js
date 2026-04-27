/**
 * Build a registry from an array of ability definitions.
 */
export function buildRegistry(definitions) {
    const map = new Map();
    for (const def of definitions) {
        map.set(def.id, def);
    }
    return map;
}
//# sourceMappingURL=registry.js.map