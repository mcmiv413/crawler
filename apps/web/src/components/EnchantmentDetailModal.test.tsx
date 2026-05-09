import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerHudView } from '@dungeon/presenter';
import { EnchantmentDetailModal } from './EnchantmentDetailModal.js';
import { EnchantmentLibrary } from './EnchantmentLibrary.js';

vi.mock('@dungeon/content', () => ({
  ENCHANTMENT_BY_ID: new Map([
    [
      'keen_edge',
      {
        id: 'keen_edge',
        name: 'Keen Edge',
        description: 'Adds a sharper edge.',
        tier: 1,
      },
    ],
  ]),
}));

function createPlayer(enchantmentIds: readonly string[]): PlayerHudView {
  return {
    name: 'Hero',
    level: 1,
    health: 10,
    maxHealth: 10,
    attack: 1,
    defense: 1,
    accuracy: 80,
    evasion: 5,
    speed: 100,
    totalDamageMin: 1,
    totalDamageMax: 2,
    resistances: {},
    gold: 0,
    floor: 1,
    experience: 0,
    experienceForNextLevel: 100,
    biomeId: null,
    biomeColor: '#888888',
    statuses: [],
    abilities: [],
    weaponMastery: null,
    equippedItems: [
      {
        slot: 'weapon',
        itemId: 'test_sword',
        name: 'Test Sword',
        rarity: 'common',
        rarityColor: '#888888',
        baseBonus: 1,
        enchantments: enchantmentIds.map(id => ({
          id,
          name: id,
          description: `${id} description`,
          tier: 1,
        })),
      },
    ],
    statBreakdowns: {},
    activeQuests: [],
    factionProgress: [],
    ogreProgress: {
      status: 'sealed',
      selectedSpawnDepth: null,
      eligibleSpawnDepths: [],
      brokenFactions: 0,
      totalFactions: 4,
      summaryText: 'No factions broken.',
    },
  };
}

describe('EnchantmentDetailModal', () => {
  it('selects only enchantments that exist in the catalog', () => {
    render(
      <EnchantmentDetailModal
        player={createPlayer(['missing_enchantment', 'keen_edge'])}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Keen Edge')).toBeInTheDocument();
    expect(screen.getByText(/Test Sword/)).toBeInTheDocument();
    expect(screen.queryByText('missing_enchantment')).not.toBeInTheDocument();
  });

  it('renders the empty detail state when equipped enchantments are missing from the catalog', () => {
    render(<EnchantmentDetailModal player={createPlayer(['missing_enchantment'])} onClose={vi.fn()} />);

    expect(screen.getByText('Select an enchantment to view details')).toBeInTheDocument();
    expect(screen.queryByText('missing_enchantment')).not.toBeInTheDocument();
  });
});

describe('EnchantmentLibrary', () => {
  it('does not render if no equipped enchantments exist in the catalog', () => {
    render(<EnchantmentLibrary player={createPlayer(['missing_enchantment'])} />);

    expect(screen.queryByText('ENCHANTMENTS')).not.toBeInTheDocument();
  });
});
