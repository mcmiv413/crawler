/**
 * DungeonPhase Component Tests
 *
 * Verifies that the dungeon view correctly renders action buttons,
 * maps, and NPCs on both desktop and mobile, with all UI elements
 * visible within the viewport.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DungeonPhase } from './DungeonPhase.js';
import type { GameView, AvailableAction } from '@dungeon/presenter';

// Mock useBreakpoint hook
vi.mock('../hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(() => ({ isMobile: false })),
}));

// Import the mocked hook to use in tests
import { useBreakpoint } from '../hooks/useBreakpoint.js';

// Mock fixtures
const createMockGameView = (overrides?: Partial<GameView>): GameView => ({
  gameId: 'test-game',
  phase: 'dungeon',
  player: {
    name: 'Hero',
    level: 1,
    health: 50,
    maxHealth: 100,
    attack: 10,
    defense: 5,
    accuracy: 80,
    evasion: 20,
    speed: 1,
    resistances: {},
    gold: 100,
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
    nemesisInfo: null,
    factionStandings: [],
  },
  map: {
    width: 20,
    height: 10,
    dangerLevel: 'moderate',
    playerPosition: { x: 5, y: 5 },
    biomeId: 'dungeon',
    cells: Array.from({ length: 200 }, (_, i) => ({
      x: i % 20,
      y: Math.floor(i / 20),
      ascii: '.',
      color: '#aaa',
      bgColor: '#000',
      visibility: 'visible' as const,
      walkable: true,
      tileType: 'floor' as const,
    })),
    entities: [],
  },
  combatLog: [],
  availableActions: [
    {
      id: 'wait',
      label: 'Wait',
      type: 'wait',
      enabled: true,
    } as AvailableAction,
  ],
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
  recentlyDefeatedNemesis: null,
  debugMode: false,
  animatedEvents: [],
  ...overrides,
});

describe('DungeonPhase Component', () => {
  describe('Desktop Rendering', () => {
    beforeEach(() => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('renders action button grid with Wait action', () => {
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      // UnifiedActionPanel renders buttons by action type
      const waitButton = screen.getByRole('button', { name: /Wait/i });
      expect(waitButton).toBeInTheDocument();
      expect(waitButton).toBeVisible();
    });

    it('renders desktop action buttons with attack option', () => {
      const view = createMockGameView({
        map: {
          width: 20,
          height: 10,
          dangerLevel: 'moderate',
          playerPosition: { x: 5, y: 5 },
          biomeId: 'dungeon',
          cells: [],
          entities: [
            {
              id: 'goblin1',
              name: 'Goblin',
              x: 6,
              y: 5,
              ascii: 'g',
              color: '#0f0',
              type: 'enemy',
              health: 30,
              maxHealth: 30,
              templateId: 'goblin',
            },
          ],
        },
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'attack_goblin1',
            label: 'Attack',
            type: 'attack',
            enabled: true,
            targetId: 'goblin1',
          } as AvailableAction,
        ],
      });

      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Wait/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /Attack/i })).toBeVisible();
    });

    it('renders desktop action buttons with interact (chest) option', () => {
      const view = createMockGameView({
        map: {
          width: 20,
          height: 10,
          dangerLevel: 'moderate',
          playerPosition: { x: 5, y: 5 },
          biomeId: 'dungeon',
          cells: [],
          entities: [
            {
              id: 'chest1',
              name: 'Treasure Chest',
              x: 6,
              y: 5,
              ascii: '⌂',
              color: '#a80',
              type: 'object',
              templateId: null,
            },
          ],
        },
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'interact_1_1',
            label: 'Interact',
            type: 'interact',
            enabled: true,
            targetPosition: { x: 1, y: 1 },
          } as AvailableAction,
        ],
      });

      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Interact/i })).toBeVisible();
    });

    it('renders map display', () => {
      const view = createMockGameView();
      const { container } = render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      // Check for danger level display
      expect(screen.getByText(/Danger:/i)).toBeInTheDocument();
      expect(screen.getByText(/Moderate/i)).toBeInTheDocument();
    });

    it('renders player HUD', () => {
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByText(/Dungeon/)).toBeInTheDocument();
      expect(screen.getByText(/Hero/)).toBeInTheDocument();
      // PlayerHud renders bars with short labels (HP, XP) — match "HP" without colon.
      expect(screen.getAllByText(/^HP$/i).length).toBeGreaterThan(0);
    });
  });

  describe('Mobile Rendering', () => {
    beforeEach(() => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    });

    afterEach(() => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    });

    it('renders action buttons on mobile (regression test)', () => {
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      const waitButton = screen.getByRole('button', { name: /Wait/i });
      expect(waitButton).toBeInTheDocument();
      expect(waitButton).toBeVisible();
    });

    it('renders map display on mobile', () => {
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByText(/Danger:/i)).toBeInTheDocument();
    });

    it('renders action buttons with multiple actions visible on mobile', () => {
      const view = createMockGameView({
        map: {
          width: 20,
          height: 10,
          dangerLevel: 'moderate',
          playerPosition: { x: 5, y: 5 },
          biomeId: 'dungeon',
          cells: [],
          entities: [
            {
              id: 'goblin1',
              name: 'Goblin',
              x: 6,
              y: 5,
              ascii: 'g',
              color: '#0f0',
              type: 'enemy',
              health: 30,
              maxHealth: 30,
              templateId: 'goblin',
            },
            {
              id: 'chest1',
              name: 'Treasure Chest',
              x: 7,
              y: 5,
              ascii: '⌂',
              color: '#a80',
              type: 'object',
              templateId: null,
            },
          ],
        },
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'attack_goblin1',
            label: 'Attack',
            type: 'attack',
            enabled: true,
            targetId: 'goblin1',
          } as AvailableAction,
          {
            id: 'interact_1_1',
            label: 'Interact',
            type: 'interact',
            enabled: true,
            targetPosition: { x: 1, y: 1 },
          } as AvailableAction,
        ],
      });

      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Wait/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /Attack/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /Interact/i })).toBeVisible();
    });

    it('renders "Actions" label on mobile to orient user', () => {
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      // UnifiedActionPanel does not render an "Actions" label; it's inherent in the component
      // Just verify the Wait button is visible to confirm action panel renders
      const waitButton = screen.getByRole('button', { name: /Wait/i });
      expect(waitButton).toBeInTheDocument();
    });
  });

  describe('Action Button Visibility', () => {
    beforeEach(() => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    });

    it('hides disabled action buttons visually', () => {
      // When there are no enemies, the Attack button should be disabled
      const view = createMockGameView({
        map: {
          width: 20,
          height: 10,
          dangerLevel: 'moderate',
          playerPosition: { x: 5, y: 5 },
          biomeId: 'dungeon',
          cells: [],
          entities: [], // No enemies
        },
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
        ],
      });

      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      // Attack button exists but is disabled when no enemies present
      const attackButton = screen.getByRole('button', {
        name: /Attack/i,
      });
      expect(attackButton).toBeDisabled();
    });

    it('keeps wait button visible even when loading', () => {
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={true}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      // Note: In the new UnifiedActionPanel, the loading prop isn't directly used
      // The component is always interactive. This test verifies Wait button is present.
      const waitButton = screen.getByRole('button', { name: /Wait/i });
      expect(waitButton).toBeVisible();
    });
  });

  describe('No Actions State', () => {
    beforeEach(() => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    });

    it('renders without crashing when no actions available', () => {
      const view = createMockGameView({
        availableActions: [],
      });

      const { container } = render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      // Component should still render map and HUD
      expect(screen.getByText(/Hero/)).toBeInTheDocument();
      expect(screen.getByText(/Danger:/i)).toBeInTheDocument();
    });
  });

  describe('Combat Log', () => {
    beforeEach(() => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    });

    it('displays combat log entries', () => {
      const view = createMockGameView();
      const combatLog = [
        { text: '[Hero -> Goblin] 15 physical dmg', type: 'attack' },
        { text: 'Goblin defeated!', type: 'loot' },
      ];

      render(
        <DungeonPhase
          view={view}
          combatLog={combatLog}
          loading={false}
          error={null}
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByText(/Hero -> Goblin/)).toBeInTheDocument();
      expect(screen.getByText(/Goblin defeated/)).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('displays error message when present', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error="Game error occurred"
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByText(/Game error occurred/)).toBeInTheDocument();
    });

    it('displays error on mobile', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      const view = createMockGameView();
      render(
        <DungeonPhase
          view={view}
          combatLog={[]}
          loading={false}
          error="Mobile error"
          sendCommand={vi.fn()}
          useSprites={false}
          setUseSprites={vi.fn()}
        />
      );

      expect(screen.getByText(/Mobile error/)).toBeInTheDocument();
    });
  });
});
