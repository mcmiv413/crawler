import type { GameState } from '@dungeon/contracts';
import { getPrimaryFactionId } from '@dungeon/content';

/** Reduce faction power when an enemy is killed */
export function updateFactionOnKill(state: GameState, templateId: string): GameState {
  const factionId = getPrimaryFactionId(templateId);
  if (factionId === undefined || factionId === '') return state;

  return {
    ...state,
    world: {
      ...state.world,
      factions: state.world.factions.map(f =>
        f.id === factionId
          ? { ...f, power: Math.max(0, f.power - 3) }
          : f,
      ),
    },
  };
}

/** Increase faction power when a nemesis of that faction is active */
export function tickFactionPowerForNemeses(state: GameState): GameState {
  const activeFactionIds = new Set(
    state.world.nemeses
      .filter(n => n.isActive)
      .map(n => getPrimaryFactionId(n.sourceTemplateId))
      .filter((id): id is string => id !== undefined),
  );

  if (activeFactionIds.size === 0) return state;

  return {
    ...state,
    world: {
      ...state.world,
      factions: state.world.factions.map(f =>
        activeFactionIds.has(f.id)
          ? { ...f, power: Math.min(100, f.power + 5) }
          : f,
      ),
    },
  };
}
