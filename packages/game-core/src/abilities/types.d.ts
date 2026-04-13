import type { WeaponType, EntityId, GameState, EnemyInstance } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
/**
 * Ability tags for categorization and filtering.
 */
export type AbilityTag = 'melee' | 'ranged' | 'attack' | 'heal' | 'self';
/**
 * How an ability can be unlocked.
 */
export type AbilityUnlock = {
    kind: 'level';
    minLevel: number;
} | {
    kind: 'mastery';
    weaponType: WeaponType;
    masteryIndex: 1 | 2;
};
/**
 * Requirements that must be met to use an ability.
 */
export type AbilityRequirement = {
    kind: 'weapon_type';
    weaponType: WeaponType;
} | {
    kind: 'has_target';
} | {
    kind: 'no_target';
} | {
    kind: 'player_missing_hp';
} | {
    kind: 'target_in_melee_range';
} | {
    kind: 'target_visible';
} | {
    kind: 'target_below_hp_pct';
    percentage: number;
};
/**
 * Conditions for conditional effects.
 */
export type AbilityCondition = {
    kind: 'attack_hit';
} | {
    kind: 'target_below_hp_pct';
    percentage: number;
};
/**
 * Target selection strategies.
 */
export type TargetSelector = {
    kind: 'self';
} | {
    kind: 'single_enemy';
} | {
    kind: 'nearest_enemy_melee';
} | {
    kind: 'nearest_visible_enemy';
} | {
    kind: 'all_visible_enemies';
} | {
    kind: 'target_plus_adjacent_enemies';
};
/**
 * Targeting specification.
 */
export interface AbilityTargeting {
    selector: TargetSelector;
    /** If selector is single_enemy, use the provided targetId; otherwise ignore */
    requestedTargetId?: EntityId;
}
/**
 * Effect types that abilities can apply.
 */
export type AbilityEffect = AttackEffect | HealEffect | StatusEffect | ModifyStatEffect | ConditionalEffect;
/**
 * Deal damage to target(s).
 */
export interface AttackEffect {
    kind: 'attack';
    damageMultiplier: number;
    flatBonus?: number;
    accuracyBonus?: number;
    forceHit?: boolean;
    trackMastery?: boolean;
}
/**
 * Heal the player (self-targeted only).
 */
export interface HealEffect {
    kind: 'heal';
    flatAmount?: number;
    percentageOfMaxHealth?: number;
}
/**
 * Apply a status effect to target.
 */
export interface StatusEffect {
    kind: 'status';
    statusId: string;
    statusName: string;
    trigger: 'always' | 'on_hit';
    chance?: number;
    duration?: number;
}
/**
 * Modify a stat on the target.
 */
export interface ModifyStatEffect {
    kind: 'modify_stat';
    stat: 'attack' | 'defense' | 'accuracy' | 'evasion';
    operation: 'add' | 'subtract';
    amount: number;
    duration: 'permanent' | number;
    trigger: 'always' | 'on_hit';
    minimum?: number;
}
/**
 * Conditional effect: check a condition, then apply effects.
 */
export interface ConditionalEffect {
    kind: 'conditional';
    when: AbilityCondition;
    then: readonly AbilityEffect[];
    otherwise?: readonly AbilityEffect[];
}
/**
 * Complete ability definition with all metadata and effects.
 */
export interface AbilityDefinition {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly tags: readonly AbilityTag[];
    readonly cooldown: number;
    readonly unlocks: readonly AbilityUnlock[];
    readonly requirements: readonly AbilityRequirement[];
    readonly targeting: AbilityTargeting;
    readonly effects: readonly AbilityEffect[];
}
/**
 * Context passed through the ability execution runtime.
 */
export interface AbilityContext {
    readonly state: GameState;
    readonly rng: SeededRNG;
    readonly player: GameState['player'];
    readonly run: GameState['run'];
    readonly equippedWeaponId: GameState['player']['equipment']['weapon'];
    readonly target?: {
        instance: EnemyInstance;
        key: string;
    };
}
//# sourceMappingURL=types.d.ts.map