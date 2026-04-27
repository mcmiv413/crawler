import type { GameState } from '@dungeon/contracts';
import type { StatBreakdown, StatBonusSource } from '../game-view.js';

function collectWeaponBonuses(statName: string, weapon: unknown): StatBonusSource[] {
  if (!weapon || typeof weapon !== 'object' || !('name' in weapon) || !('weapon' in weapon)) return [];

  const w = (weapon as { name: string; weapon: { damage: number; accuracy: number; speed: number } }).weapon;
  const spriteName = 'spriteName' in weapon ? (weapon as { spriteName?: string }).spriteName : undefined;
  const mutableBonuses: StatBonusSource[] = [];

  // NOTE: weapon damage is NOT a bonus to attack stat; it's a separate damage range
  // The stat breakdown for attack shows only the flat attack bonus, weapon damage is shown separately
  if (statName === 'accuracy' && w.accuracy !== 0) {
    mutableBonuses.push({ source: `${(weapon as { name: string }).name} accuracy`, amount: w.accuracy, spriteName });
  }
  if (statName === 'speed' && w.speed !== 0) {
    mutableBonuses.push({ source: `${(weapon as { name: string }).name} speed`, amount: w.speed, spriteName });
  }

  return mutableBonuses;
}

function collectArmorBonuses(state: GameState, statName: string, armorSlots: readonly string[]): StatBonusSource[] {
  const mutableBonuses: StatBonusSource[] = [];

  for (const slot of armorSlots) {
    const itemId = state.player.equipment[slot as keyof typeof state.player.equipment] as unknown;
    if (!itemId || typeof itemId !== 'string') continue;

    const armor = state.itemRegistry.items.get(itemId as never);
    if (!armor || !('armor' in armor)) continue;

    const a = (armor as { name: string; armor: { defense: number; resistance?: Record<string, number> } }).armor;
    const spriteName = 'spriteName' in armor ? (armor as { spriteName?: string }).spriteName : undefined;

    if (statName === 'defense' && a.defense > 0) {
      mutableBonuses.push({ source: `${(armor as { name: string }).name}`, amount: a.defense, spriteName });
    }

    if (a.resistance) {
      for (const [damageType, resistance] of Object.entries(a.resistance)) {
        if (resistance !== 0) {
          mutableBonuses.push({
            source: `${(armor as { name: string }).name} vs ${damageType}`,
            amount: resistance,
            spriteName,
          });
        }
      }
    }
  }

  return mutableBonuses;
}

export function calculateStatBreakdown(state: GameState): Record<string, StatBreakdown> {
  const p = state.player;

  const breakdowns: Record<string, StatBreakdown> = {};

  // Base stats
  const stats = {
    health: p.stats.maxHealth,
    attack: p.stats.attack,
    defense: p.stats.defense,
    accuracy: p.stats.accuracy,
    evasion: p.stats.evasion,
    speed: p.stats.speed,
  };

  const armorSlots = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const;

  // Build breakdown for each stat
  for (const [statName, baseValue] of Object.entries(stats)) {
    const weaponBonuses = p.equipment.weapon ? collectWeaponBonuses(statName, state.itemRegistry.items.get(p.equipment.weapon)) : [];
    const armorBonuses = collectArmorBonuses(state, statName, armorSlots);
    const allBonuses = [...weaponBonuses, ...armorBonuses];
    const totalBonus = allBonuses.reduce((sum, b) => sum + b.amount, 0);

    breakdowns[statName] = {
      stat: statName,
      base: baseValue,
      bonuses: allBonuses,
      total: baseValue + totalBonus,
    };
  }

  return breakdowns;
}
