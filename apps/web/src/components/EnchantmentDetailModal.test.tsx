/**
 * Test layer: unit
 * Behavior: EnchantmentDetailModal covers EnchantmentDetailModal; renders presenter-provided enchantment details; renders the empty detail state when presenter supplies no equippe....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/EnchantmentDetailModal.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerHudView } from '@dungeon/presenter';
import { EnchantmentDetailModal } from './EnchantmentDetailModal.js';
import { EnchantmentLibrary } from './EnchantmentLibrary.js';

function createPlayer(enchantments: readonly { id: string; name: string }[]): PlayerHudView {
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
        enchantments: enchantments.map(enchantment => ({
          id: enchantment.id,
          name: enchantment.name,
          description: `${enchantment.name} description`,
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
    ringSchoolMasteries: [],
    learnedSpells: [],
    studyableSpells: [],
  };
}

describe('EnchantmentDetailModal', () => {
  it('renders presenter-provided enchantment details', () => {
    render(
      <EnchantmentDetailModal
        player={createPlayer([{ id: 'keen_edge', name: 'Keen Edge' }])}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Keen Edge')).toBeInTheDocument();
    expect(screen.getByText(/Test Sword/)).toBeInTheDocument();
  });

  it('renders the empty detail state when presenter supplies no equipped enchantments', () => {
    render(<EnchantmentDetailModal player={createPlayer([])} onClose={vi.fn()} />);

    expect(screen.getByText('Select an enchantment to view details')).toBeInTheDocument();
  });
});

describe('EnchantmentLibrary', () => {
  it('does not render if presenter supplies no equipped enchantments', () => {
    render(<EnchantmentLibrary player={createPlayer([])} />);

    expect(screen.queryByText('ENCHANTMENTS')).not.toBeInTheDocument();
  });
});
