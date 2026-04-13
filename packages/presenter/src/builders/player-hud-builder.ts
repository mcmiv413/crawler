import type { GameState, WeaponType } from '@dungeon/contracts';
import { STATUS_DEFINITIONS, ABILITY_DEFINITIONS, ENCHANTMENT_BY_ID } from '@dungeon/content';
import type { PlayerHudView, StatusView, AbilityView, EquippedItemView, EnchantmentView } from '../game-view.js';
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
        baseBonus: weapon.weapon.damage,
        enchantments: [],
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
      baseBonus: armor.armor.defense,
      enchantments,
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
      } satisfies AbilityView;
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
    biomeId: state.run?.floor.biomeId ?? null,
    statuses: statusList,
    abilities: abilityList,
    weaponMastery: state.run ? { ...state.run.weaponMastery } : null,
    equippedItems: mutableEquippedItems,
    statBreakdowns: calculateStatBreakdown(state),
  };
}
