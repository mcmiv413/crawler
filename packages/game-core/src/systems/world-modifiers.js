import { getTemplateIdsForFaction, FEAR_MODIFIERS, CORRUPTION_MODIFIERS, WORLD_MODIFIER_CAPS, } from '@dungeon/content';
/** Compute world modifiers for a given floor depth */
export function buildWorldModifiers(world, depth) {
    let extraEnemies = 0;
    // Active nemesis on floors >= their floorOfAscension → more enemies
    const nemesisPresence = world.nemeses.filter(n => n.isActive && depth >= n.floorOfAscension).length;
    extraEnemies += nemesisPresence;
    // High fear → more ambush-type enemies
    const preferredArchetypes = world.town.fear > FEAR_MODIFIERS.preferFastEnemiesAbove ? ['ambusher', 'fast_skirmisher'] : [];
    // High corruption → prefer poison/corruption damage
    const preferredDamageTypes = world.town.corruption > CORRUPTION_MODIFIERS.preferCorruptEnemiesAbove ? ['poison', 'corruption'] : [];
    // Strong factions (power > 60) add their enemy types
    const factionTemplates = world.factions
        .filter(f => f.power > 60)
        .flatMap(faction => getTemplateIdsForFaction(faction.id));
    // Active nemeses add their source template to preferred spawns
    const activeNemesisTemplates = world.nemeses
        .filter(n => n.isActive && depth >= n.floorOfAscension)
        .map(n => n.sourceTemplateId)
        .filter(id => !factionTemplates.includes(id));
    const preferredTemplates = [...factionTemplates, ...activeNemesisTemplates];
    // Corruption stat effects
    let enemyHealthMultiplier = 1.0;
    let tierUpgradeChance = 0;
    let bossFloorAdjust = 0;
    if (world.town.corruption > CORRUPTION_MODIFIERS.enemyHealthBonusAbove) {
        enemyHealthMultiplier = CORRUPTION_MODIFIERS.enemyHealthMultiplier;
    }
    if (world.town.corruption > CORRUPTION_MODIFIERS.tierUpgradeChanceAbove) {
        tierUpgradeChance = CORRUPTION_MODIFIERS.tierUpgradeChance;
    }
    if (world.town.corruption > CORRUPTION_MODIFIERS.earlyBossAbove) {
        bossFloorAdjust = CORRUPTION_MODIFIERS.earlyBossFloorAdjust;
    }
    // Collect nemeses eligible for spawning on this floor
    const nemesesToSpawn = world.nemeses.filter(n => n.isActive && depth >= n.floorOfAscension);
    return {
        extraEnemies: Math.min(WORLD_MODIFIER_CAPS.maxExtraEnemies, extraEnemies),
        preferredArchetypes,
        preferredDamageTypes,
        preferredTemplates,
        enemyHealthMultiplier,
        tierUpgradeChance,
        bossFloorAdjust,
        nemesesToSpawn,
    };
}
//# sourceMappingURL=world-modifiers.js.map