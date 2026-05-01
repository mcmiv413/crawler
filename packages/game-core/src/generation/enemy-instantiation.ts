import type { EnemyInstance, EnemyTemplate, FactionState, Position } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { getFloorScalingMultipliers, getPrimaryFactionId, INSTANCE_COLORS } from '@dungeon/content';
import { generateId } from '../utils/id.js';
import { getFactionMemberStrengthMultiplier } from '../systems/factions.js';

interface EnemyInstanceOptions {
  readonly id?: ReturnType<typeof entityId>;
  readonly name?: string;
  readonly factions?: readonly FactionState[];
  readonly enemyHealthMultiplier?: number;
  readonly skipFactionStrength?: boolean;
}

export function createEnemyInstance(
  template: EnemyTemplate,
  position: Position,
  depth: number,
  options: EnemyInstanceOptions = {},
): EnemyInstance {
  const multipliers = getFloorScalingMultipliers(depth);
  const scale = (base: number, multiplier: number): number =>
    Math.round(base * Math.pow(multiplier, depth - 1));

  const healthMultiplier = options.enemyHealthMultiplier ?? 1;
  let scaledMaxHealth = Math.round(scale(template.stats.maxHealth, multipliers.healthMultiplier) * healthMultiplier);
  let scaledAttack = scale(template.stats.attack, multipliers.attackMultiplier);

  if (options.skipFactionStrength !== true && options.factions !== undefined) {
    const factionId = getPrimaryFactionId(template.templateId);
    const faction = options.factions.find(candidate => candidate.id === factionId);
    if (faction !== undefined) {
      const factionMultiplier = getFactionMemberStrengthMultiplier(faction);
      scaledMaxHealth = Math.max(1, Math.round(scaledMaxHealth * factionMultiplier));
      scaledAttack = Math.max(1, Math.round(scaledAttack * factionMultiplier));
    }
  }

  const abilities = template.abilities ?? [];
  const abilityCooldowns: Record<string, number> = {};
  for (const abilityId of abilities) {
    abilityCooldowns[abilityId] = 0;
  }

  return {
    id: options.id ?? entityId(generateId()),
    templateId: template.templateId,
    name: options.name ?? template.name,
    archetype: template.archetype,
    tier: template.tier,
    stats: {
      maxHealth: scaledMaxHealth,
      health: scaledMaxHealth,
      attack: scaledAttack,
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
    color: template.color,
    movementBehaviorId: template.movementBehaviorId,
    spriteName: template.spriteName,
    biomes: template.biomes,
    factions: template.factions,
    ambientBehaviorProfile: template.ambientBehaviorProfile,
    position,
    statuses: [],
    isAlerted: false,
    lastKnownPlayerPos: null,
  };
}

export function assignInstanceColors(enemies: ReadonlyMap<string, EnemyInstance>): ReadonlyMap<string, EnemyInstance> {
  const colorsByTemplate = new Map<string, number>();
  const coloredEnemies = new Map<string, EnemyInstance>();
  for (const [key, enemy] of enemies) {
    const colorIndex = colorsByTemplate.get(enemy.templateId) ?? 0;
    const instanceColor = INSTANCE_COLORS[colorIndex % INSTANCE_COLORS.length];
    colorsByTemplate.set(enemy.templateId, colorIndex + 1);
    coloredEnemies.set(key, { ...enemy, instanceColor });
  }
  return coloredEnemies;
}
