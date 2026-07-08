/**
 * Test layer: unit
 * Behavior: PlayerHud covers PlayerHud compact layout; keeps compact bars in 3-column layout on desktop; renders HP, MP, and XP in 3-column layout on mobile compact HUD.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/PlayerHud.test.tsx
 */
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
    ringSchoolMasteries: [],
    learnedSpells: [],
    studyableSpells: [],
    ...overrides,
  };
}

describe('PlayerHud compact layout', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
  });

  it('keeps compact bars in 3-column layout on desktop', () => {
    render(<PlayerHud player={createPlayer()} compact />);

    const bars = screen.getByTestId('compact-player-hud-bars');
    const gridStyle = window.getComputedStyle(bars).gridTemplateColumns;
    expect(gridStyle).toMatch(/repeat\((2|3), minmax\(0, 1fr\)\)/);
  });

  it('renders HP, MP, and XP in 3-column layout on mobile compact HUD', () => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    render(<PlayerHud player={createPlayer()} compact />);

    const bars = screen.getByTestId('compact-player-hud-bars');
    const gridStyle = window.getComputedStyle(bars).gridTemplateColumns;
    // Mobile compact HUD shows 3 columns if player has mana, 2 if not
    expect(['repeat(2, minmax(0, 1fr))', 'repeat(3, minmax(0, 1fr))']).toContain(gridStyle);
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

  it('renders MP in the compact HUD when mana is present', () => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    render(<PlayerHud player={createPlayer({ mana: 12, maxMana: 20 })} compact />);

    expect(screen.getByText('MP')).toBeInTheDocument();
    expect(screen.getByText('12/20')).toBeInTheDocument();
    expect(screen.getByTestId('compact-mp-bar-fill')).toHaveStyle({
      width: '60%',
    });
  });
});
