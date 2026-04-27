/**
 * Classifies the target mode from an ability's target selector and tags.
 */
function classifyTargetMode(selector, tags) {
    // Special cases for directional trap interactions
    if (tags.includes('trap_disarm'))
        return 'trap_disarm';
    if (tags.includes('trap_set'))
        return 'trap_set';
    switch (selector.kind) {
        case 'self':
            return 'self';
        case 'single_enemy':
            return 'single_enemy';
        case 'all_visible_enemies':
            return 'all_visible_enemies';
        case 'target_plus_adjacent_enemies':
            return 'target_plus_adjacent_enemies';
        case 'nearest_enemy_melee':
            return 'single_enemy';
        case 'nearest_visible_enemy':
            return 'single_enemy';
        default:
            return 'self';
    }
}
/**
 * Extract weapon types from ability requirements.
 */
function extractWeaponTypes(requirements) {
    const weaponTypes = requirements
        .filter(req => req.kind === 'weapon_type' && 'weaponType' in req)
        .map(req => req.weaponType);
    return weaponTypes.length > 0 ? weaponTypes : undefined;
}
/**
 * Extract unlock level from ability unlocks.
 */
function extractUnlockLevel(unlocks) {
    const levelUnlock = unlocks.find(u => u.kind === 'level');
    return levelUnlock && 'minLevel' in levelUnlock ? levelUnlock.minLevel : 1;
}
/**
 * Determine if ability is ranged based on weapon type requirements.
 */
function isRangedAbility(weaponTypes) {
    return weaponTypes?.includes('ranged') ?? false;
}
/**
 * Derive UI-focused metadata from an ability definition.
 * This is the single source of truth that presenter and web layers consume.
 */
export function getAbilityUiMetadata(ability) {
    const weaponTypes = extractWeaponTypes(ability.requirements);
    const unlockLevel = extractUnlockLevel(ability.unlocks);
    const targetMode = classifyTargetMode(ability.targeting.selector, Array.from(ability.tags));
    const isRanged = isRangedAbility(weaponTypes);
    return {
        id: ability.id,
        name: ability.name,
        description: ability.description,
        cooldown: ability.cooldown,
        unlockLevel,
        requiresWeaponTypes: weaponTypes,
        targetMode,
        isRanged: isRanged === true ? true : undefined,
    };
}
/**
 * Build a map of ability ID to UI metadata for fast lookups.
 */
export function buildAbilityUiMetadataMap(abilities) {
    const map = new Map();
    for (const ability of abilities) {
        map.set(ability.id, getAbilityUiMetadata(ability));
    }
    return map;
}
//# sourceMappingURL=ability-ui-metadata.js.map