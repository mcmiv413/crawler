import type { StatusId } from '@dungeon/contracts';

export interface StatusDefinition {
  readonly id: StatusId;
  readonly name: string;
  readonly description: string;
  readonly stackable: boolean;
  readonly beneficial: boolean;
  readonly tickEffect: 'damage' | 'heal' | 'none';
  readonly tickMagnitudeKey: string;
  readonly modifiesStat: string | null;
  readonly statMultiplierKey: string | null;
}

export const STATUS_DEFINITIONS: Record<StatusId, StatusDefinition> = {
  poison: {
    id: 'poison',
    name: 'Poison',
    description: 'Takes damage each turn from toxins.',
    stackable: false,
    beneficial: false,
    tickEffect: 'damage',
    tickMagnitudeKey: 'poison.damagePerTurn',
    modifiesStat: null,
    statMultiplierKey: null,
  },
  burn: {
    id: 'burn',
    name: 'Burn',
    description: 'Takes fire damage each turn.',
    stackable: false,
    beneficial: false,
    tickEffect: 'damage',
    tickMagnitudeKey: 'burn.damagePerTurn',
    modifiesStat: null,
    statMultiplierKey: null,
  },
  slow: {
    id: 'slow',
    name: 'Slow',
    description: 'Movement speed is reduced.',
    stackable: false,
    beneficial: false,
    tickEffect: 'none',
    tickMagnitudeKey: '',
    modifiesStat: 'speed',
    statMultiplierKey: 'slow.speedMultiplier',
  },
  stun: {
    id: 'stun',
    name: 'Stun',
    description: 'Cannot act this turn.',
    stackable: false,
    beneficial: false,
    tickEffect: 'none',
    tickMagnitudeKey: '',
    modifiesStat: null,
    statMultiplierKey: null,
  },
  bleed: {
    id: 'bleed',
    name: 'Bleed',
    description: 'Loses health each turn from open wounds.',
    stackable: false,
    beneficial: false,
    tickEffect: 'damage',
    tickMagnitudeKey: 'bleed.damagePerTurn',
    modifiesStat: null,
    statMultiplierKey: null,
  },
  weaken: {
    id: 'weaken',
    name: 'Weaken',
    description: 'Attack power is reduced.',
    stackable: false,
    beneficial: false,
    tickEffect: 'none',
    tickMagnitudeKey: '',
    modifiesStat: 'attack',
    statMultiplierKey: 'weaken.attackMultiplier',
  },
  vulnerability: {
    id: 'vulnerability',
    name: 'Vulnerability',
    description: 'Defense is lowered, taking more damage.',
    stackable: false,
    beneficial: false,
    tickEffect: 'none',
    tickMagnitudeKey: '',
    modifiesStat: 'defense',
    statMultiplierKey: 'vulnerability.defenseMultiplier',
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneration',
    description: 'Heals a small amount each turn.',
    stackable: false,
    beneficial: true,
    tickEffect: 'heal',
    tickMagnitudeKey: 'regeneration.healPerTurn',
    modifiesStat: null,
    statMultiplierKey: null,
  },
  strength: {
    id: 'strength',
    name: 'Strength',
    description: 'Attack power is temporarily increased.',
    stackable: false,
    beneficial: true,
    tickEffect: 'none',
    tickMagnitudeKey: '',
    modifiesStat: 'attack',
    statMultiplierKey: null,
  },
};
