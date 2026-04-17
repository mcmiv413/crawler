import type { WeaponType } from '@dungeon/contracts';

export interface AbilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cooldown: number;
  readonly requiresTarget: boolean;
  readonly unlockLevel: number;
  /** If set, ability only works when one of these weapon types is equipped */
  readonly requiresWeaponTypes?: readonly WeaponType[];
}

export const ABILITY_DEFINITIONS: Readonly<Record<string, AbilityDefinition>> = {
  power_strike: {
    id: 'power_strike',
    name: 'Power Strike',
    description: 'Unleash a devastating blow dealing 2× your attack damage.',
    cooldown: 2,
    requiresTarget: true,
    unlockLevel: 2,
    requiresWeaponTypes: ['blade', 'bludgeon', 'axe'],
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Catch your breath, restoring 25% of your maximum HP.',
    cooldown: 4,
    requiresTarget: false,
    unlockLevel: 4,
  },
  // Blade mastery
  blade_bleed: {
    id: 'blade_bleed',
    name: 'Blade Bleed',
    description: 'A precise strike that guarantees bleeding (2 dmg/turn, 4 turns).',
    cooldown: 2,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['blade'],
  },
  blade_riposte: {
    id: 'blade_riposte',
    name: 'Blade Riposte',
    description: 'A guaranteed critical strike with +50% accuracy bonus.',
    cooldown: 3,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['blade'],
  },
  // Bludgeon mastery
  bludgeon_stagger: {
    id: 'bludgeon_stagger',
    name: 'Bludgeon Stagger',
    description: 'A heavy blow with 80% chance to stun (enemy skips next turn).',
    cooldown: 2,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['bludgeon'],
  },
  bludgeon_shatter: {
    id: 'bludgeon_shatter',
    name: 'Bludgeon Shatter',
    description: 'Smash through armor, permanently reducing target defense by 5.',
    cooldown: 4,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['bludgeon'],
  },
  // Axe mastery
  axe_cleave: {
    id: 'axe_cleave',
    name: 'Axe Cleave',
    description: 'Strike primary target and all adjacent enemies at 50% damage.',
    cooldown: 2,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['axe'],
  },
  axe_execute: {
    id: 'axe_execute',
    name: 'Axe Execute',
    description: 'Deal 3× damage to enemies below 30% HP.',
    cooldown: 3,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['axe'],
  },
  // Ranged mastery
  ranged_pin: {
    id: 'ranged_pin',
    name: 'Ranged Pin',
    description: 'Attack that roots the target in place (slow, 3 turns).',
    cooldown: 2,
    requiresTarget: true,
    unlockLevel: 0,
    requiresWeaponTypes: ['ranged'],
  },
  ranged_volley: {
    id: 'ranged_volley',
    name: 'Ranged Volley',
    description: 'Unleash arrows at all visible enemies for 70% attack damage.',
    cooldown: 4,
    requiresTarget: false,
    unlockLevel: 0,
    requiresWeaponTypes: ['ranged'],
  },
  // Dagger mastery
  dagger_disarm: {
    id: 'dagger_disarm',
    name: 'Disarm Trap',
    description: 'Remove an adjacent trap and add it to your inventory.',
    cooldown: 0,
    requiresTarget: false,
    unlockLevel: 0,
    requiresWeaponTypes: ['dagger'],
  },
  dagger_set_trap: {
    id: 'dagger_set_trap',
    name: 'Set Trap',
    description: 'Place a trap on an adjacent empty tile.',
    cooldown: 0,
    requiresTarget: false,
    unlockLevel: 0,
    requiresWeaponTypes: ['dagger'],
  },
} as const;

/** Ordered list of abilities granted at each level (index = level) */
export const ABILITY_UNLOCK_BY_LEVEL: Readonly<Record<number, string>> = {
  2: 'power_strike',
  4: 'second_wind',
} as const;

/** Hit thresholds for weapon mastery tier unlocks (run-scoped) */
export const MASTERY_THRESHOLDS: Record<1 | 2, number> = { 1: 10, 2: 25 };

/** Maps weapon type + tier → ability ID */
export const MASTERY_ABILITIES: Record<WeaponType, Record<1 | 2, string>> = {
  blade:    { 1: 'blade_bleed',      2: 'blade_riposte'    },
  bludgeon: { 1: 'bludgeon_stagger', 2: 'bludgeon_shatter' },
  axe:      { 1: 'axe_cleave',       2: 'axe_execute'      },
  ranged:   { 1: 'ranged_pin',       2: 'ranged_volley'    },
  dagger:   { 1: 'dagger_disarm',    2: 'dagger_set_trap'  },
};
