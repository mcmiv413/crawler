import type { GameState, WeaponType } from '@dungeon/contracts';
import { STATUS_DEFINITIONS, ABILITY_DEFINITIONS, ENCHANTMENT_BY_ID, XP_TABLE, getRarityColor, BIOMES, daggerDisarm, daggerSetTrap, getDamageBand, getWeaponDamageProfile } from '@dungeon/content';
import { getObjectiveText } from '@dungeon/core/systems/quest-progress.js';
import { getEffectiveStat } from '@dungeon/core/systems/status-effects.js';
import type { AbilityView, EnchantmentView, EquippedItemView, PlayerHudView, StatusView } from '../game-view.js';
import { calculateStatBreakdown } from './stat-breakdown-builder.js';
import { buildFactionView, buildOgreProgressView } from './faction-progress-builder.js';
import { getStatusPresentation } from '../animation-metadata.js';

export function buildPlayerHud(state: GameState): PlayerHudView {
  const p = state.player;

  // Get equipped weapon type for ability filtering
  let equippedWeaponType: string | null = null;
  if (p.equipment.weapon) {
    const weaponItem = state.itemRegistry.items.get(p.equipment.weapon);
    if (weaponItem && 'weapon' in weaponItem) {
      equippedWeaponType = weaponItem.weapon.weaponType;
    }
  }

  // Build equipped items list
  const mutableEquippedItems: EquippedItemView[] = [];

  if (p.equipment.weapon) {
    const weapon = state.itemRegistry.items.get(p.equipment.weapon);
    if (weapon && 'weapon' in weapon) {
      mutableEquippedItems.push({
        slot: 'weapon',
        itemId: p.equipment.weapon as unknown as string,
        name: weapon.name,
        rarity: weapon.rarity,
        rarityColor: getRarityColor(weapon.rarity),
        baseBonus: weapon.weapon.damage,
        enchantments: [],
        spriteName: weapon.spriteName,
      });
    }
  }

  const armorSlots = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const;
  for (const slot of armorSlots) {
    const itemId = (p.equipment as unknown as Record<string, unknown>)[slot] as string | undefined;
    if (!itemId) continue;

    const armor = state.itemRegistry.items.get(itemId as never);
    if (!armor || !('armor' in armor)) continue;

    const enchantments: EnchantmentView[] = armor.armor.enchantments
      ? armor.armor.enchantments
          .map(encId => {
            if (!encId) return null;
            const encDef = ENCHANTMENT_BY_ID.get(encId);
            return encDef
              ? ({
                  id: encId,
                  name: encDef.name,
                  description: encDef.description,
                  tier: encDef.tier,
                } satisfies EnchantmentView)
              : null;
          })
          .filter((e): e is EnchantmentView => e !== null)
      : [];

    mutableEquippedItems.push({
      slot,
      itemId: itemId as unknown as string,
      name: armor.name,
      rarity: armor.rarity,
      rarityColor: getRarityColor(armor.rarity),
      baseBonus: armor.armor.defense,
      enchantments,
      spriteName: armor.spriteName,
    });
  }

  const statusList: StatusView[] = p.statuses.map(s => {
    const def = STATUS_DEFINITIONS.get(s.id);
    const presentation = getStatusPresentation(s.id);
    return {
      id: s.id,
      name: def?.name ?? s.id,
      turnsRemaining: s.turnsRemaining,
      beneficial: def?.beneficial ?? false,
      ...(presentation !== undefined ? { presentation } : {}),
    } satisfies StatusView;
  });

  const abilityList: AbilityView[] = (p.abilities ?? [])
    .filter(a => {
      const def = ABILITY_DEFINITIONS.get(a.id);
      if (!def) return true; // Include unknown abilities
      if (!def.requiresWeaponTypes || def.requiresWeaponTypes.length === 0) return true; // Include abilities without weapon requirements
      if (!equippedWeaponType) return false; // Hide weapon-specific abilities if no weapon is equipped
      return def.requiresWeaponTypes.includes(equippedWeaponType as WeaponType); // Only include if weapon type matches
    })
    .map(a => {
      const def = ABILITY_DEFINITIONS.get(a.id);
      return {
        id: a.id,
        name: def?.name ?? a.id,
        description: def?.description ?? '',
        ready: a.cooldownRemaining === 0,
        cooldownRemaining: a.cooldownRemaining,
        requiresTarget: def?.requiresTarget ?? false,
        requiresDirection: a.id === daggerDisarm.id || a.id === daggerSetTrap.id,
      } satisfies AbilityView;
    });

  // Calculate XP needed for next level
  const experienceForNextLevel = p.level + 1 < XP_TABLE.length ? XP_TABLE[p.level + 1]! : XP_TABLE[XP_TABLE.length - 1]!;

  // Build active quests list
  const activeQuests = state.activeQuests.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    status: q.status,
    objectiveText: getObjectiveText(q),
    progress: q.objective.progress,
    rewardGold: q.reward.type === 'gold' ? q.reward.amount : 0,
    giverNpcId: q.giverNpcId,
  }));

  const factionProgress = state.world.factions.map(faction => {
    const mutableCurrentDungeonEnemies: string[] = [];
    if (state.run) {
      for (const enemy of state.run.enemies.values()) {
        if (enemy.factions?.some(candidate => candidate.factionId === faction.id)) {
          mutableCurrentDungeonEnemies.push(enemy.name);
        }
      }
    }

    return buildFactionView(faction, mutableCurrentDungeonEnemies);
  });

  // Calculate total damage range (effective attack stat + weapon damage range)
  const effectiveAttack = getEffectiveStat(p.stats.attack, 'attack', p.statuses);
  let totalDamageMin = effectiveAttack;
  let totalDamageMax = effectiveAttack;
  if (p.equipment.weapon !== null) {
    const weapon = state.itemRegistry.items.get(p.equipment.weapon);
    if (weapon && 'weapon' in weapon) {
      const w = weapon.weapon;
      const profile = getWeaponDamageProfile(w.weaponType, w.weaponRange);
      const band = getDamageBand(w.damage, profile);
      totalDamageMin = band.min + effectiveAttack;
      totalDamageMax = band.max + effectiveAttack;
    }
  }

  return {
    name: p.name,
    level: p.level,
    health: p.stats.health,
    maxHealth: p.stats.maxHealth,
    attack: effectiveAttack,
    defense: p.stats.defense,
    accuracy: p.stats.accuracy,
    evasion: p.stats.evasion,
    speed: p.stats.speed,
    totalDamageMin,
    totalDamageMax,
    resistances: p.stats.resistances ?? {},
    gold: p.gold,
    floor: state.run?.floor.depth ?? p.floor,
    experience: p.experience,
    experienceForNextLevel,
    biomeId: state.run?.floor.biomeId ?? null,
    biomeColor: state.run?.floor.biomeId ? (BIOMES.get(state.run.floor.biomeId)?.ambientColor ?? '#666') : '#666',
    statuses: statusList,
    abilities: abilityList,
    weaponMastery: state.run ? { ...state.weaponMastery } : null,
    equippedItems: mutableEquippedItems,
    statBreakdowns: calculateStatBreakdown(state),
    activeQuests,
    factionProgress,
    ogreProgress: buildOgreProgressView(state.world),
  };
}
