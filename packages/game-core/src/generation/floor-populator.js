import { entityId, posKey } from '@dungeon/contracts';
import { MAP_GENERATION, getFloorScalingMultipliers, ENEMY_TEMPLATES, ENEMIES_BY_BIOME, OBJECT_TEMPLATES, AMBIENT_PROFILES, OBJECT_POOL, dungeonOgre, chest, INSTANCE_COLORS } from '@dungeon/content';
import { generateId } from '../utils/id.js';
import { chebyshevDistance } from '../utils/grid.js';
import { preSimulateAmbientBehavior } from '../systems/ambient-behavior-engine.js';
/** Populate a floor with enemies and items */
export function populateFloor(floor, biome, rng, worldMods) {
    const walkablePositions = getWalkablePositions(floor);
    // Exclude entrance, exit, and positions within 2 tiles of entrance from spawn positions
    const spawnPositions = walkablePositions.filter(pos => {
        const key = posKey(pos);
        if (key === posKey(floor.exit))
            return false;
        if (chebyshevDistance(pos, floor.entrance) <= 2)
            return false;
        return true;
    });
    const shuffled = rng.shuffle(spawnPositions);
    // Spawn enemies — base count + world-modifier extras
    const baseMax = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * floor.depth;
    const maxEnemies = baseMax + (worldMods?.extraEnemies ?? 0);
    const enemyCount = Math.min(maxEnemies, Math.floor(shuffled.length * 0.15));
    const enemies = new Map();
    for (let i = 0; i < enemyCount && i < shuffled.length; i++) {
        const pos = shuffled[i];
        let template = pickEnemy(biome, rng, floor.depth, worldMods);
        if (template === null)
            continue;
        // C2: Tier upgrade chance (when corruption > 75)
        if (worldMods?.tierUpgradeChance !== undefined && rng.next() < worldMods.tierUpgradeChance) {
            // Find a higher-tier template from the same biome
            const biomePool = ENEMIES_BY_BIOME.get(biome.biomeId) ?? [];
            const upgradedCandidates = biomePool
                .filter((t) => t.tier > template.tier);
            if (upgradedCandidates.length > 0) {
                template = rng.pick(upgradedCandidates);
            }
        }
        const enemy = instantiateEnemy(template, pos, floor.depth, rng, worldMods);
        enemies.set(posKey(pos), enemy);
    }
    // Spawn objects (after enemies to avoid overlap)
    const maxObjects = MAP_GENERATION.itemBaseDensity + MAP_GENERATION.itemPerFloor * floor.depth;
    const objectPositions = shuffled.slice(enemyCount);
    const objects = new Map();
    // Place objects with category/rarity weighting
    for (let i = 0; i < maxObjects && i < objectPositions.length; i++) {
        const pos = objectPositions[i];
        const objectTemplate = pickObject(rng, floor.depth);
        if (objectTemplate === undefined)
            continue;
        objects.set(posKey(pos), {
            id: entityId(generateId()),
            templateId: objectTemplate.templateId,
            position: pos,
            isExhausted: false,
        });
    }
    // C3: Guarantee high-tier enemy on floor 5+ (adjusted by corruption modifier)
    const bossSpawnFloor = 5 + (worldMods?.bossFloorAdjust ?? 0);
    if (floor.depth >= bossSpawnFloor && !Array.from(enemies.values()).some(e => e.tier >= 3)) {
        const bossTemplate = ENEMY_TEMPLATES.get(dungeonOgre.templateId);
        if (bossTemplate !== undefined) {
            const occupiedPositions = new Set(enemies.keys());
            const availablePositions = spawnPositions.filter(pos => !occupiedPositions.has(posKey(pos)));
            if (availablePositions.length > 0) {
                const bossPos = rng.pick(availablePositions);
                const bossEnemy = instantiateEnemy(bossTemplate, bossPos, floor.depth, rng, worldMods);
                enemies.set(posKey(bossPos), bossEnemy);
            }
        }
    }
    // A10.2: Spawn nemesis (max one per floor) — replace regular enemy instead of adding extra
    if (worldMods?.nemesesToSpawn && worldMods.nemesesToSpawn.length > 0) {
        for (const nemesis of worldMods.nemesesToSpawn) {
            // Guaranteed on floorOfAscension, 70% chance on higher floors
            const shouldSpawn = floor.depth === nemesis.floorOfAscension || rng.next() < 0.7;
            if (shouldSpawn !== true)
                continue;
            const baseTemplate = ENEMY_TEMPLATES.get(nemesis.sourceTemplateId);
            if (baseTemplate === undefined)
                continue;
            // A10.2: Try to find an already-placed enemy of the same template and replace it
            let nemesisPos = null;
            let replacedEnemyKey = null;
            for (const [key, enemy] of enemies) {
                if (enemy.templateId === nemesis.sourceTemplateId) {
                    nemesisPos = enemy.position;
                    replacedEnemyKey = key;
                    break;
                }
            }
            // If no matching template enemy exists, pick a random available position
            if (nemesisPos === null) {
                const occupiedPositions = new Set(enemies.keys());
                const availablePositions = spawnPositions.filter(pos => !occupiedPositions.has(posKey(pos)));
                if (availablePositions.length > 0) {
                    nemesisPos = rng.pick(availablePositions);
                }
                else {
                    break; // No space available
                }
            }
            // Instantiate nemesis from template, then override with nemesis stats
            const nemesisEnemy = instantiateEnemy(baseTemplate, nemesisPos, floor.depth, rng, worldMods);
            const nemesisInstance = {
                ...nemesisEnemy,
                name: nemesis.name,
                stats: nemesis.stats,
                nemesisId: nemesis.id,
            };
            // Replace or add nemesis
            if (replacedEnemyKey !== null) {
                enemies.delete(replacedEnemyKey); // Remove the regular enemy
            }
            enemies.set(posKey(nemesisPos), nemesisInstance);
            break; // Only spawn one nemesis per floor
        }
    }
    // Assign instance colors for disambiguating multiple enemies of the same type
    const colorsByTemplate = new Map();
    const coloredEnemies = new Map();
    for (const [key, enemy] of enemies) {
        const colorIndex = colorsByTemplate.get(enemy.templateId) ?? 0;
        const instanceColor = INSTANCE_COLORS[colorIndex % INSTANCE_COLORS.length];
        colorsByTemplate.set(enemy.templateId, colorIndex + 1);
        coloredEnemies.set(key, { ...enemy, instanceColor });
    }
    // Pre-simulate ambient behavior for 10 rounds to position enemies naturally
    const simulatedEnemies = preSimulateAmbientBehavior(coloredEnemies, AMBIENT_PROFILES, 10, floor.seed);
    return { enemies: simulatedEnemies, objects };
}
function getWalkablePositions(floor) {
    return Array.from(floor.cells)
        .filter(([, cell]) => cell.tile.walkable)
        .map(([key]) => {
        const [x, y] = key.split(',').map(Number);
        return { x: x, y: y };
    });
}
function pickEnemy(biome, rng, depth, worldMods) {
    const biomePool = ENEMIES_BY_BIOME.get(biome.biomeId) ?? [];
    if (biomePool.length === 0)
        return null;
    const preferred = new Set(worldMods?.preferredTemplates ?? []);
    const preferredArchetypes = new Set(worldMods?.preferredArchetypes ?? []);
    const preferredDamageTypes = new Set(worldMods?.preferredDamageTypes ?? []);
    // Tier gating by floor depth:
    // Floors 1-2: tier 1 only
    // Floors 3-4: tier 1-2
    // Floors 5+: all tiers
    let maxTier;
    if (depth <= 2)
        maxTier = 1;
    else if (depth <= 4)
        maxTier = 2;
    else
        maxTier = 5;
    // Extend biome pool: include preferred templates even if not in the biome pool
    const biomePoolIds = biomePool.map(t => t.templateId);
    const extendedPool = [
        ...biomePoolIds,
        ...Array.from(preferred).filter(id => !biomePoolIds.includes(id)),
    ];
    // C1, C4: Filter by tier gating and apply preferred weights
    let weightedPool = [];
    for (const templateId of extendedPool) {
        const template = ENEMY_TEMPLATES.get(templateId);
        if (!template || template.tier > maxTier)
            continue;
        let weight = 1;
        // C1: Boost archetype preference
        if (preferredArchetypes.has(template.archetype))
            weight *= 2;
        // C4: Boost damage type preference
        if (preferredDamageTypes.has(template.equipment.weapon.damageType))
            weight *= 2;
        // Existing template preference
        if (preferred.has(templateId))
            weight *= 3;
        weightedPool = [...weightedPool, ...Array.from({ length: weight }, () => templateId)];
    }
    if (weightedPool.length === 0)
        return null;
    const templateId = rng.pick(weightedPool);
    return ENEMY_TEMPLATES.get(templateId) ?? null;
}
function pickObject(rng, depth) {
    // Select category based on weights
    const categoryPool = Object.entries(OBJECT_POOL.categoryWeights).flatMap(([category, weight]) => Array.from({ length: weight }, () => category));
    const selectedCategory = rng.pick(categoryPool);
    // Filter objects by category
    const categoryObjects = Array.from(OBJECT_TEMPLATES.values()).filter((obj) => obj.objectCategory === selectedCategory);
    if (categoryObjects.length === 0)
        return OBJECT_TEMPLATES.get(chest.templateId);
    // Filter by rarity: rare+ objects blocked on floors < 3
    const rarityGate = depth < OBJECT_POOL.rareMinDepth ? ['common', 'uncommon'] : Object.keys(OBJECT_POOL.rarityWeights);
    const gatedObjects = categoryObjects.filter((obj) => obj.rarity !== undefined && rarityGate.includes(obj.rarity));
    if (gatedObjects.length === 0)
        return OBJECT_TEMPLATES.get('chest');
    // Weight by rarity
    const rarityPool = gatedObjects.flatMap((obj) => {
        const rarity = obj.rarity || 'common';
        const weight = OBJECT_POOL.rarityWeights[rarity] ?? 1;
        return Array.from({ length: weight }, () => obj);
    });
    return rng.pick(rarityPool);
}
function instantiateEnemy(template, position, depth, _rng, worldMods) {
    // Scale stats by floor depth (reduced for floors 1-2)
    const multipliers = getFloorScalingMultipliers(depth);
    const scale = (base, multiplier) => Math.round(base * Math.pow(multiplier, depth - 1));
    const healthMult = worldMods?.enemyHealthMultiplier ?? 1.0;
    const scaledMaxHealth = Math.round(scale(template.stats.maxHealth, multipliers.healthMultiplier) * healthMult);
    // Initialize ability cooldowns to 0 (ready to use immediately)
    const abilityCooldowns = {};
    const abilities = template.abilities ?? [];
    for (const abilityId of abilities) {
        abilityCooldowns[abilityId] = 0;
    }
    return {
        id: entityId(generateId()),
        templateId: template.templateId,
        name: template.name,
        archetype: template.archetype,
        tier: template.tier,
        stats: {
            maxHealth: scaledMaxHealth,
            health: scaledMaxHealth,
            attack: scale(template.stats.attack, multipliers.attackMultiplier),
            defense: scale(template.stats.defense, multipliers.defenseMultiplier),
            accuracy: template.stats.accuracy,
            evasion: template.stats.evasion,
            speed: template.stats.speed,
        },
        equipment: template.equipment,
        affinities: { ...template.affinities },
        spawn: template.spawn,
        abilities: abilities.length > 0 ? abilities : undefined,
        abilityCooldowns,
        lootTableId: template.lootTableId,
        experienceValue: Math.round(template.experienceValue * Math.pow(multipliers.experienceMultiplier, depth - 1)),
        description: template.description,
        ascii: template.ascii,
        position,
        statuses: [],
        isAlerted: false,
        lastKnownPlayerPos: null,
    };
}
//# sourceMappingURL=floor-populator.js.map