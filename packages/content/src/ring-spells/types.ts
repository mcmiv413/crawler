import type { StatusId } from '@dungeon/contracts';
import type { AbilityDefinition } from '../abilities/types.js';
import type { RingSchool } from '../ring-schools/types.js';
import type { RingSpellId } from './types.ids.js';

export type { RingSpellId } from './types.ids.js';

// Which target(s) a status effect applies to
export type EffectTarget = 'self' | 'target' | 'affectedTargets';

export interface StatusEffect {
  readonly statusId: StatusId; // dot-walked: statuses.burn.id
  readonly duration: number;
  readonly magnitude?: number;
  readonly target: EffectTarget;
}

// Composable study requirements — all must be satisfied for a spell to be studyable
export type SpellStudyRequirement =
  | { readonly kind: 'equippedSchool'; readonly school: RingSchool }
  | { readonly kind: 'minimumSchoolXp'; readonly school: RingSchool; readonly xp: number }
  | { readonly kind: 'goldCost'; readonly gold: number }
  | { readonly kind: 'prerequisiteSpell'; readonly spellId: RingSpellId };

// Effect type determines how a spell resolves in combat
// Non-custom kinds use data-driven execution; custom uses an effectHandlerId
export type RingSpellEffectKind = 'single_target_damage' | 'self_buff' | 'line_damage' | 'custom';

export interface RingSpellDefinition extends AbilityDefinition {
  readonly id: RingSpellId;
  // Multi-school membership — ['fire'] for single-school, ['fire', 'ice'] for combo
  readonly schools: readonly RingSchool[];

  // School XP awarded to each listed school when the spell is successfully cast
  readonly xpGainOnCast: number;

  // Minimum school mastery level required to see this spell (visibility gate)
  readonly minimumSchoolLevel?: number;

  // Composable study requirements — all must be met to unlock
  readonly studyRequirements: readonly SpellStudyRequirement[];

  // Effect kind determines resolution path
  readonly effectKind: RingSpellEffectKind;

  // Custom handler id — REQUIRED if effectKind is 'custom', forbidden otherwise
  readonly effectHandlerId?: string;

  // Game mechanics — data-driven for non-custom kinds
  readonly range: number;
  readonly baseDamage?: number;
  readonly statusEffects?: readonly StatusEffect[];

  // Note: unlockLevel is required for AbilityDefinition compatibility but is now derived
  // from minimumSchoolLevel for display purposes.
  // requiresTarget and requiresDirection are execution fields validated against effectKind.
}
