/**
 * DungeonPhase Component Tests
 *
 * Verifies that the dungeon view correctly renders action buttons,
 * maps, and NPCs on both desktop and mobile, with all UI elements
 * visible within the viewport.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DungeonPhase } from './DungeonPhase.js';
import type { GameView, AvailableAction } from '@dungeon/presenter';

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
    statuses: [],
    abilities: [],
    weaponMastery: null,
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
  ...overrides,
});

describe('DungeonPhase Component', () => {
  describe('Desktop Rendering', () => {
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
          isMobile={false}
        />
      );

      const waitButton = screen.getByRole('button', { name: /Wait/i });
      expect(waitButton).toBeInTheDocument();
      expect(waitButton).toBeVisible();
    });

    it('renders desktop action buttons with attack option', () => {
      const view = createMockGameView({
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'attack_goblin1',
            label: 'Attack Goblin',
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
          isMobile={false}
        />
      );

      expect(screen.getByRole('button', { name: /Wait/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /Attack Goblin/i })).toBeVisible();
    });

    it('renders desktop action buttons with interact (chest) option', () => {
      const view = createMockGameView({
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'interact_1_1',
            label: 'Open Chest',
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
          isMobile={false}
        />
      );

      expect(screen.getByRole('button', { name: /Open Chest/i })).toBeVisible();
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
          isMobile={false}
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
          isMobile={false}
        />
      );

      expect(screen.getByText(/Dungeon/)).toBeInTheDocument();
      // HUD shows player information and interface buttons
      expect(screen.getByRole('button', { name: /Inventory/i })).toBeInTheDocument();
    });
  });

  describe('Mobile Rendering', () => {
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
          isMobile={true}
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
          isMobile={true}
        />
      );

      expect(screen.getByText(/Danger:/i)).toBeInTheDocument();
    });

    it('renders action buttons with multiple actions visible on mobile', () => {
      const view = createMockGameView({
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'attack_goblin1',
            label: 'Attack Goblin',
            type: 'attack',
            enabled: true,
            targetId: 'goblin1',
          } as AvailableAction,
          {
            id: 'interact_1_1',
            label: 'Open Chest',
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
          isMobile={true}
        />
      );

      expect(screen.getByRole('button', { name: /Wait/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /Attack Goblin/i })).toBeVisible();
      expect(screen.getByRole('button', { name: /Open Chest/i })).toBeVisible();
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
          isMobile={true}
        />
      );

      // Look for the Actions header/label
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });
  });

  describe('Action Button Visibility', () => {
    it('hides disabled action buttons visually', () => {
      const view = createMockGameView({
        availableActions: [
          { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
          {
            id: 'attack_goblin1',
            label: 'Attack (no range)',
            type: 'attack',
            enabled: false,
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
          isMobile={false}
        />
      );

      const disabledButton = screen.getByRole('button', {
        name: /Attack \(no range\)/i,
      });
      expect(disabledButton).toBeDisabled();
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
          isMobile={false}
        />
      );

      const waitButton = screen.getByRole('button', { name: /Wait/i });
      expect(waitButton).toBeVisible();
      expect(waitButton).toBeDisabled();
    });
  });

  describe('No Actions State', () => {
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
          isMobile={false}
        />
      );

      // Component should still render map and HUD
      expect(screen.getByText(/Hero/)).toBeInTheDocument();
      expect(screen.getByText(/Danger:/i)).toBeInTheDocument();
    });
  });

  describe('Combat Log', () => {
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
          isMobile={false}
        />
      );

      expect(screen.getByText(/Hero -> Goblin/)).toBeInTheDocument();
      expect(screen.getByText(/Goblin defeated/)).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('displays error message when present', () => {
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
          isMobile={false}
        />
      );

      expect(screen.getByText(/Game error occurred/)).toBeInTheDocument();
    });

    it('displays error on mobile', () => {
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
          isMobile={true}
        />
      );

      expect(screen.getByText(/Mobile error/)).toBeInTheDocument();
    });
  });
});
