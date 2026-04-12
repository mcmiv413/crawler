import type { GameState, EnemyInstance } from '@dungeon/contracts';

/** Add an ability to the player's ability list (idempotent) */
export function grantAbility(state: GameState, abilityId: string): GameState {
  if (state.player.abilities.some(a => a.id === abilityId)) return state;
  return {
    ...state,
    player: {
      ...state.player,
      abilities: [...state.player.abilities, { id: abilityId, cooldownRemaining: 0 }],
    },
  };
}

/** Decrement all non-zero ability cooldowns by 1 */
export function tickAbilityCooldowns(state: GameState): GameState {
  if (state.player.abilities.length === 0) return state;
  return {
    ...state,
    player: {
      ...state.player,
      abilities: state.player.abilities.map(a => ({
        ...a,
        cooldownRemaining: Math.max(0, a.cooldownRemaining - 1),
      })),
    },
  };
}

/** Check if the player can use the given ability right now */
export function canUseAbility(state: GameState, abilityId: string): boolean {
  const ability = state.player.abilities.find(a => a.id === abilityId);
  return ability !== undefined && ability.cooldownRemaining === 0;
}

/** Check if an enemy can use the given ability right now */
export function canEnemyUseAbility(enemy: EnemyInstance, abilityId: string): boolean {
  if (!enemy.abilities || !enemy.abilities.includes(abilityId)) return false;
  const cooldown = enemy.abilityCooldowns?.[abilityId] ?? 0;
  return cooldown === 0;
}

/** Set an ability's cooldown (used after activation) */
export function setAbilityCooldown(state: GameState, abilityId: string, cooldown: number): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      abilities: state.player.abilities.map(a =>
        a.id === abilityId ? { ...a, cooldownRemaining: cooldown } : a,
      ),
    },
  };
}
