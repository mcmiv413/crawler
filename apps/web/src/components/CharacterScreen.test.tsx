/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlayerHudView } from '@dungeon/presenter';

vi.mock('../hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(() => ({ isMobile: false })),
}));

import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';
import { CharacterScreen } from './CharacterScreen.js';

function createPlayer(overrides?: Partial<PlayerHudView>): PlayerHudView {
  return {
    name: 'Hero',
    level: 4,
    health: 42,
    maxHealth: 55,
    attack: 10,
    defense: 8,
    accuracy: 80,
    evasion: 10,
    speed: 100,
    totalDamageMin: 10,
    totalDamageMax: 16,
    resistances: {},
    gold: 120,
    floor: 4,
    experience: 30,
    experienceForNextLevel: 100,
    biomeId: null,
    biomeColor: '#888888',
    statuses: [],
    abilities: [],
    weaponMastery: null,
    equippedItems: [],
    statBreakdowns: {},
    activeQuests: [],
    factionProgress: [
      {
        id: 'goblin_warband',
        name: 'Goblin Warband',
        description: 'Disorganized raiders motivated by greed and chaos.',
        lore: 'They hoard treasure in the lower warrens.',
        power: 68,
        disposition: -30,
        status: 'led',
        powerBand: 'strong',
        leader: {
          state: 'emerged',
          name: 'Brakka',
          title: 'Knife-King',
          templateId: 'goblin_warlord',
          spriteName: 'goblin king',
          emergedOnRun: 2,
          emergedOnDepth: 3,
        },
        leaderStateText: 'Brakka, Knife-King',
        membersKilledByPlayer: 6,
        leadersKilledByPlayer: 0,
        playerDeathsCaused: 1,
        worldEffectText: 'Strong dungeon pressure: members spawn at 150% and fight at 110% strength. Active leader pressure is in play.',
        townEffectText: 'Town effect per run: prosperity -2, corruption +2.',
        currentDungeonEnemies: ['Goblin Archer'],
      },
    ],
    ogreProgress: {
      status: 'sealed',
      selectedSpawnDepth: null,
      eligibleSpawnDepths: [],
      brokenFactions: 1,
      totalFactions: 4,
      summaryText: '1/4 factions broken. Break 3 more to reveal the Dungeon Ogre.',
    },
    ringSchoolMasteries: [],
    learnedSpells: [],
    studyableSpells: [],
    ...overrides,
  };
}

describe('CharacterScreen faction progress', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
  });

  it('shows faction progress and ogre progress from presenter data', () => {
    render(<CharacterScreen player={createPlayer()} sendCommand={vi.fn()} />);

    expect(screen.getByText(/Faction Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Goblin Warband/i)).toBeInTheDocument();
    expect(screen.getByText(/Strong · Led/i)).toBeInTheDocument();
    expect(screen.getByText(/Leader active: Brakka, Knife-King/i)).toBeInTheDocument();
    expect(screen.getByText(/Break 3 more to reveal the Dungeon Ogre/i)).toBeInTheDocument();
  });

  it('opens the faction detail modal with leader and town impact details', () => {
    render(<CharacterScreen player={createPlayer()} sendCommand={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));

    expect(screen.getAllByText(/Faction Progress/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/Brakka, Knife-King/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/Town effect per run: prosperity -2, corruption \+2\./i)).toBeInTheDocument();
    expect(screen.getByText(/Members Slain/i)).toBeInTheDocument();
  });

  it('adds tab bar clearance to the scrollable body on mobile', () => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    render(<CharacterScreen player={createPlayer()} sendCommand={vi.fn()} />);

    expect(screen.getByTestId('character-scroll-content')).toHaveStyle(
      `padding-bottom: ${TAB_BAR_HEIGHT}px`,
    );
  });

  it('shows magic progression, MP and spell power tiles, and a dedicated magic modal without duplicate spell abilities', () => {
    render(
      <CharacterScreen
        player={createPlayer({
          abilities: [
            {
              id: 'heat_surge',
              name: 'Heat Surge',
              description: 'A fiery self-buff.',
              ready: true,
              cooldownRemaining: 0,
              cooldown: 4,
              requiresTarget: false,
            },
            {
              id: 'power_strike',
              name: 'Power Strike',
              description: 'A heavy melee attack.',
              ready: true,
              cooldownRemaining: 0,
              cooldown: 2,
              requiresTarget: true,
              targetRange: { min: 1, max: 1 },
            },
          ],
          mana: 12,
          maxMana: 25,
          magicExperience: 60,
          magicLevel: 2,
          magicExperienceForNextLevel: 150,
          spellPower: 1,
          ringSchoolMasteries: [{
            school: 'fire',
            xp: 60,
            displayLevel: 2,
            nextDisplayLevelXp: 100,
          }],
          learnedSpells: [{
            spellId: 'heat_surge',
            name: 'Heat Surge',
            description: 'A fiery self-buff.',
            schools: ['fire'],
            cooldown: 4,
            manaCost: 11,
            xpGainOnCast: 2,
            learned: true,
            unlocked: true,
          }],
        })}
        sendCommand={vi.fn()}
      />,
    );

    expect(screen.getByText(/MAGIC EXPERIENCE/i)).toBeInTheDocument();
    expect(screen.getByText(/60 \/ 150 XP toward Magic Lv 3/i)).toBeInTheDocument();
    expect(screen.getByText('MP')).toBeInTheDocument();
    expect(screen.getByText('SPL')).toBeInTheDocument();
    expect(screen.queryByText(/RING MAGIC/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LEARNED SPELLS/i)).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Power Strike' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Heat Surge' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Magic' }));

    expect(screen.getByText(/Fire Magic/i)).toBeInTheDocument();
    expect(screen.getByText(/Spell Power: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 XP\/cast/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Heat Surge/i)).toHaveLength(1);
  });

  it('does not render stale mastery detail state for a missing weapon key', () => {
    const { rerender } = render(
      <CharacterScreen
        player={createPlayer({
          weaponMastery: { blade: 12, bludgeon: 0, axe: 0, ranged: 0 },
          weaponMasteryTiers: [
            {
              weaponType: 'blade',
              uses: 12,
              tier: 1,
              listProgressLabel: '12/25',
              nextTier: {
                tier: 2,
                progress: 2,
                requiredUses: 15,
                totalRequiredUses: 25,
              },
            },
          ],
        })}
        sendCommand={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Masteries' }));
    fireEvent.click(screen.getByRole('button', { name: /blade/i }));

    expect(screen.getByText(/blade Mastery/i)).toBeInTheDocument();

    rerender(
      <CharacterScreen
        player={createPlayer({
          weaponMastery: { axe: 5 } as PlayerHudView['weaponMastery'],
          weaponMasteryTiers: [
            {
              weaponType: 'axe',
              uses: 5,
              tier: 0,
              listProgressLabel: '5/10',
              nextTier: {
                tier: 1,
                progress: 5,
                requiredUses: 10,
                totalRequiredUses: 10,
              },
            },
          ],
        })}
        sendCommand={vi.fn()}
      />,
    );

    expect(screen.queryByText(/blade Mastery/i)).not.toBeInTheDocument();
  });
});
