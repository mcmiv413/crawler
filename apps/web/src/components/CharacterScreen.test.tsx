/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlayerHudView } from '@dungeon/presenter';
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
    ...overrides,
  };
}

describe('CharacterScreen faction progress', () => {
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
});
