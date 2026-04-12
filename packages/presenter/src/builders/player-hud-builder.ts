import type { GameState, WeaponType } from '@dungeon/contracts';
import { STATUS_DEFINITIONS, ABILITY_DEFINITIONS } from '@dungeon/content';
import type { PlayerHudView, StatusView, AbilityView } from '../game-view.js';

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
    statuses: p.statuses.map(s => {
      const def = STATUS_DEFINITIONS[s.id];
      return {
        id: s.id,
        name: def?.name ?? s.id,
        turnsRemaining: s.turnsRemaining,
        beneficial: def?.beneficial ?? false,
      } satisfies StatusView;
    }),
    abilities: (p.abilities ?? [])
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
      }),
    weaponMastery: state.run ? { ...state.run.weaponMastery } : null,
  };
}
