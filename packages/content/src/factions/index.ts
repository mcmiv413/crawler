import type { FactionState } from '@dungeon/contracts';

export interface FactionDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly lore: string;
  readonly initialPower: number;
  readonly initialDisposition: number;
}

export const FACTION_DEFINITIONS: readonly FactionDefinition[] = [
  {
    id: 'goblin_warband',
    name: 'Goblin Warband',
    description: 'Disorganized raiders motivated by greed and chaos.',
    lore: 'Once a loose rabble of cave-dwellers, these goblins have grown emboldened by the dungeon\'s depths. They hoard treasures and lay crude traps in the warrens they inhabit.',
    initialPower: 40,
    initialDisposition: -30,
  },
  {
    id: 'undead_legion',
    name: 'Undead Legion',
    description: 'Ancient skeletal warriors bound by necromantic power.',
    lore: 'Cursed to eternal servitude, these undead guardians were sealed within the stone crypt ages ago. They remain locked in their ancient duties, hostile to all living intrusions.',
    initialPower: 30,
    initialDisposition: -50,
  },
  {
    id: 'beast_swarm',
    name: 'Beast Swarm',
    description: 'A primal collective of mutated creatures.',
    lore: 'Born from the dungeon\'s corruption, these beasts thrive in the moss-filled caverns. Hunger drives them to attack anything moving, mindless yet cunning in their ferocity.',
    initialPower: 50,
    initialDisposition: -20,
  },
  {
    id: 'shadow_cult',
    name: 'Shadow Cult',
    description: 'Twisted cultists wielding dark arts.',
    lore: 'These shadowy servants of forgotten gods perform unspeakable rituals in the dungeon\'s deepest reaches. They view the surface as a realm of weakness, unworthy of their dark ambitions.',
    initialPower: 25,
    initialDisposition: -60,
  },
];

/** Convenience lookup map: factionId → FactionDefinition */
export const FACTIONS: ReadonlyMap<string, FactionDefinition> = new Map(
  FACTION_DEFINITIONS.map(f => [f.id, f])
);

/** Initial faction states at game start */
export const INITIAL_FACTIONS: readonly FactionState[] = FACTION_DEFINITIONS.map(f => ({
  id: f.id,
  name: f.name,
  power: f.initialPower,
  disposition: f.initialDisposition,
}));
