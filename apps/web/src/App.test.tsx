/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DismissibleNotice, GameNotice, GameView, QuestAssignedNotice } from '@dungeon/presenter';
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

vi.mock('./hooks/useWalkController.js', () => ({
  useWalkController: () => undefined,
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
  DeathNotificationModal: ({
    deathContext,
    onDismiss,
  }: {
    deathContext: NonNullable<GameView['deathContext']>;
    onDismiss: () => void;
  }) => (
    <div>
      <div>death notice:{deathContext.totalDeaths}:{deathContext.killerName ?? 'unknown'}</div>
      <button type="button" onClick={onDismiss}>
        dismiss death notice
      </button>
    </div>
  ),
}));

vi.mock('./components/QuestAssignedScreen.js', () => ({
  QuestAssignedScreen: ({ questTitle }: { questTitle: string }) => <div>quest notice:{questTitle}</div>,
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

function createView(
  notice?: DismissibleNotice,
  notices: readonly GameNotice[] = notice ? [notice] : [],
): GameView {
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
      ringSchoolMasteries: [],
      learnedSpells: [],
      studyableSpells: [],
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
    notices,
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

function createDeathContext(
  overrides: Partial<NonNullable<GameView['deathContext']>> = {},
): NonNullable<GameView['deathContext']> {
  return {
    killerName: 'Goblin',
    killerSpriteName: 'goblin',
    floor: 3,
    equipmentLost: [],
    goldLost: 12,
    overkillDamage: 5,
    permadeathThreshold: 20,
    totalDeaths: 1,
    ...overrides,
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

  it('keeps a dismissed progress notice hidden when later views reuse the same stable id', () => {
    const progressNotice: DismissibleNotice = {
      id: 'leader_emerged_goblin_warband_goblin_warband_leader_12_4',
      kind: 'FACTION_LEADER_EMERGED',
      title: 'Faction Leader Emerged',
      message: 'Brakka, Knife-King, now leads the Goblin Warband.',
      detail: 'A new leader rose on floor 3.',
      spriteName: 'goblin king',
    };
    const olderQuestNotice: QuestAssignedNotice = {
      id: 'quest_assigned_rat-problem',
      kind: 'QUEST_ASSIGNED',
      questId: 'rat-problem',
      questTitle: 'Rat Problem',
      questDescription: 'Clear the cellar rats.',
      rewardGold: 25,
      giverNpcId: 'innkeeper',
    };
    let storeState = createStoreState(progressNotice);

    vi.mocked(useGameStore).mockImplementation(() => storeState as never);

    const { rerender } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    storeState = createStoreState(progressNotice, {
      notices: [olderQuestNotice, progressNotice],
    });
    rerender(<App />);

    expect(screen.queryByText(/Faction Leader Emerged/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('shows a later death notice after dismissing the previous death in the same game', () => {
    const firstDeath = createDeathContext({
      killerName: 'Goblin',
      floor: 2,
      totalDeaths: 1,
    });
    const secondDeath = createDeathContext({
      killerName: 'Ogre',
      killerSpriteName: 'ogre',
      floor: 5,
      goldLost: 24,
      overkillDamage: 9,
      totalDeaths: 2,
    });
    let storeState = createStoreState(undefined, {
      phase: 'town',
      deathContext: firstDeath,
    });

    vi.mocked(useGameStore).mockImplementation(() => storeState as never);

    const { rerender } = render(<App />);

    expect(screen.getByText('death notice:1:Goblin')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss death notice/i }));

    expect(screen.queryByText('death notice:1:Goblin')).not.toBeInTheDocument();

    storeState = createStoreState(undefined, {
      phase: 'town',
      deathContext: firstDeath,
    });
    rerender(<App />);

    expect(screen.queryByText('death notice:1:Goblin')).not.toBeInTheDocument();

    storeState = createStoreState(undefined, {
      phase: 'town',
      deathContext: secondDeath,
    });
    rerender(<App />);

    expect(screen.getByText('death notice:2:Ogre')).toBeInTheDocument();
  });

  it('shows quest assignment from typed notices instead of combat log parsing', () => {
    const questNotice: QuestAssignedNotice = {
      id: 'quest_assigned_rat-problem',
      kind: 'QUEST_ASSIGNED',
      questId: 'rat-problem',
      questTitle: 'Rat Problem',
      questDescription: 'Clear the cellar rats.',
      rewardGold: 25,
      giverNpcId: 'innkeeper',
    };

    vi.mocked(useGameStore).mockReturnValue(createStoreState(undefined, {
      phase: 'town',
      notices: [questNotice],
    }) as never);

    render(<App />);

    expect(screen.getByText('quest notice:Rat Problem')).toBeInTheDocument();
  });

  it('shows the game over surface for dungeon ogre victory', () => {
    vi.mocked(useGameStore).mockReturnValue(createStoreState(undefined, {
      phase: 'game_over',
      runResult: 'victory',
    }) as never);

    render(<App />);

    expect(screen.getByText(/game over/i)).toBeInTheDocument();
  });

  it('renders the tab bar on desktop layouts', () => {
    render(<App />);

    expect(screen.getByText('nav')).toBeInTheDocument();
  });
});
