import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerHudView } from '@dungeon/presenter';

vi.mock('../hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(() => ({ isMobile: false })),
}));

import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { PlayerHud } from './PlayerHud.js';

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
    biomeId: 'forest',
    biomeColor: '#88aa44',
    statuses: [],
    abilities: [],
    weaponMastery: null,
    equippedItems: [],
    statBreakdowns: {},
    activeQuests: [],
    factionProgress: [],
    ogreProgress: {
      status: 'sealed',
      selectedSpawnDepth: null,
      eligibleSpawnDepths: [],
      brokenFactions: 1,
      totalFactions: 4,
      summaryText: '1/4 factions broken. Break 3 more to reveal the Dungeon Ogre.',
    },
    ...overrides,
  };
}

describe('PlayerHud compact layout', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
  });

  it('keeps compact bars stacked on desktop', () => {
    render(<PlayerHud player={createPlayer()} compact />);

    expect(screen.getByTestId('compact-player-hud-bars')).toHaveStyle(
      'grid-template-columns: 1fr',
    );
  });

  it('renders HP and XP side by side on mobile compact HUD', () => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    render(<PlayerHud player={createPlayer()} compact />);

    expect(screen.getByTestId('compact-player-hud-bars')).toHaveStyle(
      'grid-template-columns: repeat(2, minmax(0, 1fr))',
    );
    expect(screen.getByText('42/55')).toBeInTheDocument();
    expect(screen.getByText('30/100')).toBeInTheDocument();
    expect(screen.getByTestId('compact-hp-bar-track')).toBeInTheDocument();
    expect(screen.getByTestId('compact-hp-bar-fill')).toHaveStyle({
      width: `${(42 / 55) * 100}%`,
    });
    expect(screen.getByTestId('compact-xp-bar-fill')).toHaveStyle({
      width: '30%',
    });
  });

  it('keeps the low-health pulse visible in mobile compact HUD', () => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    render(<PlayerHud player={createPlayer({ health: 10, maxHealth: 50 })} compact />);

    expect(screen.getByTestId('compact-hp-bar-track')).toHaveStyle({
      borderColor: '#c85a4a',
    });
    expect(screen.getByTestId('compact-hp-bar-fill')).toHaveStyle({
      animation: 'hpPulse 1.2s ease-in-out infinite',
      width: '20%',
    });
  });
});
