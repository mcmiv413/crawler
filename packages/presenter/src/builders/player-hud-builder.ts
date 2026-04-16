import type { GameState, WeaponType } from '@dungeon/contracts';
import { STATUS_DEFINITIONS, ABILITY_DEFINITIONS, ENCHANTMENT_BY_ID, XP_TABLE, FACTIONS, getRarityColor, BIOMES } from '@dungeon/content';
import type { PlayerHudView, StatusView, AbilityView, EquippedItemView, EnchantmentView, NemesisInfo, FactionStanding } from '../game-view.js';
import { calculateStatBreakdown } from './stat-breakdown-builder.js';

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
    const def = STATUS_DEFINITIONS[s.id];
    return {
      id: s.id,
      name: def?.name ?? s.id,
      turnsRemaining: s.turnsRemaining,
      beneficial: def?.beneficial ?? false,
    } satisfies StatusView;
  });

  const abilityList: AbilityView[] = (p.abilities ?? [])
    .filter(a => {
      const def = ABILITY_DEFINITIONS[a.id];
      if (!def) return true; // Include unknown abilities
      if (!def.requiresWeaponTypes || def.requiresWeaponTypes.length === 0) return true; // Include abilities without weapon requirements
      if (!equippedWeaponType) return false; // Hide weapon-specific abilities if no weapon is equipped
      return def.requiresWeaponTypes.includes(equippedWeaponType as WeaponType); // Only include if weapon type matches
    })
    .map(a => {
      const def = ABILITY_DEFINITIONS[a.id];
      return {
        id: a.id,
        name: def?.name ?? a.id,
        description: def?.description ?? '',
        ready: a.cooldownRemaining === 0,
        cooldownRemaining: a.cooldownRemaining,
        requiresTarget: def?.requiresTarget ?? false,
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
    rewardGold: q.rewardGold,
    giverNpcId: q.giverNpcId,
  }));

  // Build nemesis info - show first active nemesis
  let nemesisInfo: NemesisInfo | null = null;
  const activeNemesis = state.world.nemeses.find(n => n.isActive);
  if (activeNemesis !== undefined) {
    const tierToRarity: Record<number, string> = {
      1: 'common',
      2: 'uncommon',
      3: 'rare',
      4: 'epic',
      5: 'legendary',
    };
    nemesisInfo = {
      id: activeNemesis.id,
      name: activeNemesis.name,
      title: activeNemesis.title,
      rarity: tierToRarity[activeNemesis.tier] ?? 'unknown',
      defeats: activeNemesis.killCount,
      promotionStage: activeNemesis.rank,
      lastSeenFloor: state.run?.floor.depth ?? null,
      nextPossibleFloor: activeNemesis.floorOfAscension + 1,
    };
  }

  // Build faction standings
  const factionStandings: FactionStanding[] = state.world.factions.map(f => {
    const factionDef = FACTIONS.get(f.id);
    
    // Find enemies in current dungeon that belong to this faction
    const mutableEnemiesInCurrentDungeon: string[] = [];
    if (state.run) {
      for (const enemy of state.run.enemies.values()) {
        if (enemy.factions?.some(ef => ef.factionId === f.id)) {
          mutableEnemiesInCurrentDungeon.push(enemy.name);
        }
      }
    }

    return {
      factionId: f.id,
      name: f.name,
      alignment: f.power > 50 ? 'strong' : f.power < 50 ? 'weak' : 'neutral',
      standing: Math.max(0, f.disposition + 100),
      maxStanding: 200,
      description: factionDef?.description ?? '',
      enemiesInCurrentDungeon: mutableEnemiesInCurrentDungeon,
    };
  });

  return {
    name: p.name,
    level: p.level,
    health: p.stats.health,
    maxHealth: p.stats.maxHealth,
    attack: p.stats.attack,
    defense: p.stats.defense,
    accuracy: p.stats.accuracy,
    evasion: p.stats.evasion,
    speed: p.stats.speed,
    resistances: p.stats.resistances ?? {},
    gold: p.gold,
    floor: p.floor,
    experience: p.experience,
    experienceForNextLevel,
    biomeId: state.run?.floor.biomeId ?? null,
    biomeColor: state.run?.floor.biomeId ? (BIOMES.get(state.run.floor.biomeId)?.ambientColor ?? '#666') : '#666',
    statuses: statusList,
    abilities: abilityList,
    weaponMastery: state.run ? { ...state.run.weaponMastery } : null,
    equippedItems: mutableEquippedItems,
    statBreakdowns: calculateStatBreakdown(state),
    activeQuests,
    nemesisInfo,
    factionStandings,
  };
}
