/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DismissibleNotice, GameView } from '@dungeon/presenter';
import { App } from './App.js';
import { useGameStore } from './store/game-store.js';

vi.mock('./store/game-store.js', () => ({
  useGameStore: vi.fn(),
}));

vi.mock('./hooks/useBreakpoint.js', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('./hooks/useKeyboard.js', () => ({
  useKeyboard: () => undefined,
}));

vi.mock('./hooks/useAutoWalk.js', () => ({
  useAutoWalk: () => undefined,
}));

vi.mock('./components/StartScreen.js', () => ({
  StartScreen: () => <div>start</div>,
}));

vi.mock('./components/TownPhase.js', () => ({
  TownPhase: () => <div>town</div>,
}));

vi.mock('./components/DungeonPhase.js', () => ({
  DungeonPhase: () => <div>dungeon</div>,
}));

vi.mock('./components/GameOverPhase.js', () => ({
  GameOverPhase: () => <div>game over</div>,
}));

vi.mock('./components/DeathNotificationModal.js', () => ({
  DeathNotificationModal: () => <div>death notice</div>,
}));

vi.mock('./components/QuestAssignedScreen.js', () => ({
  QuestAssignedScreen: () => <div>quest notice</div>,
}));

vi.mock('./components/MobileNav.js', () => ({
  MobileNav: () => <div>nav</div>,
}));

vi.mock('./components/CharacterScreen.js', () => ({
  CharacterScreen: () => <div>character</div>,
}));

vi.mock('./components/InventoryScreen.js', () => ({
  InventoryScreen: () => <div>inventory</div>,
}));

vi.mock('./components/CombatLogView.js', () => ({
  CombatLogView: () => <div>log</div>,
}));

function createView(notice?: DismissibleNotice): GameView {
  return {
    gameId: 'test-game',
    phase: 'dungeon',
    player: {
      name: 'Hero',
      level: 1,
      health: 100,
      maxHealth: 100,
      attack: 10,
      defense: 5,
      accuracy: 80,
      evasion: 10,
      speed: 100,
      totalDamageMin: 10,
      totalDamageMax: 12,
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
      equippedItems: [],
      statBreakdowns: {},
      activeQuests: [],
      factionProgress: [],
      ogreProgress: {
        status: 'sealed',
        selectedSpawnDepth: null,
        eligibleSpawnDepths: [],
        brokenFactions: 0,
        totalFactions: 4,
        summaryText: '0/4 factions broken. Break 4 more to reveal the Dungeon Ogre.',
      },
    },
    map: null,
    combatLog: [],
    availableActions: [],
    town: null,
    inventory: {
      items: [],
      equipped: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      },
    },
    activeQuests: [],
    runResult: null,
    deathStashFloor: null,
    deathSummary: null,
    deathContext: null,
    inspectableEntities: [],
    debugMode: false,
    animatedEvents: [],
    notice,
  };
}

function createStoreState(notice?: DismissibleNotice, viewOverrides?: Partial<GameView>) {
  return {
    view: { ...createView(notice), ...viewOverrides },
    gameId: 'test-game',
    combatLog: [],
    loading: false,
    error: null,
    deathTransitioning: false,
    createGame: vi.fn(),
    sendCommand: vi.fn(),
    clearError: vi.fn(),
    restoreSession: vi.fn().mockResolvedValue(true),
    resetGame: vi.fn(),
  };
}

describe('App progress notices', () => {
  beforeEach(() => {
    vi.mocked(useGameStore).mockReturnValue(createStoreState() as never);
  });

  it('shows the faction leader emerged surface', () => {
    vi.mocked(useGameStore).mockReturnValue(createStoreState({
      id: 'leader-emerged',
      kind: 'FACTION_LEADER_EMERGED',
      title: 'Faction Leader Emerged',
      message: 'Brakka, Knife-King, now leads the Goblin Warband.',
      detail: 'A new leader rose on floor 3.',
      spriteName: 'goblin king',
    }) as never);

    render(<App />);

    expect(screen.getByText(/Faction Leader Emerged/i)).toBeInTheDocument();
    expect(screen.getByText(/Brakka, Knife-King, now leads the Goblin Warband/i)).toBeInTheDocument();
  });

  it('shows the faction leader slain surface', () => {
    vi.mocked(useGameStore).mockReturnValue(createStoreState({
      id: 'leader-slain',
      kind: 'FACTION_LEADER_SLAIN',
      title: 'Faction Leader Slain',
      message: 'Brakka, Knife-King, has been slain.',
      detail: 'Goblin Warband is broken.',
    }) as never);

    render(<App />);

    expect(screen.getByText(/Faction Leader Slain/i)).toBeInTheDocument();
    expect(screen.getByText(/has been slain/i)).toBeInTheDocument();
  });

  it('shows the dungeon ogre emergence surface', () => {
    vi.mocked(useGameStore).mockReturnValue(createStoreState({
      id: 'ogre-emerged',
      kind: 'DUNGEON_OGRE_EMERGED',
      title: 'Dungeon Ogre Emerged',
      message: 'The Dungeon Ogre has claimed floor 9.',
      detail: 'Eligible depths were 8, 9, 10. Its lair will stay fixed until you slay it.',
      spriteName: 'ogre',
    }) as never);

    render(<App />);

    expect(screen.getByText(/Dungeon Ogre Emerged/i)).toBeInTheDocument();
    expect(screen.getByText(/claimed floor 9/i)).toBeInTheDocument();
  });

  it('shows the game over surface for dungeon ogre victory', () => {
    vi.mocked(useGameStore).mockReturnValue(createStoreState(undefined, {
      phase: 'game_over',
      runResult: 'victory',
    }) as never);

    render(<App />);

    expect(screen.getByText(/game over/i)).toBeInTheDocument();
  });
});
