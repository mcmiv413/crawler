/**
 * Tests for UnifiedActionPanel component.
 * Verifies all action buttons render, can be clicked, and dispatch correct commands.
 */

/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameView } from '@dungeon/presenter';
import { UnifiedActionPanel } from './UnifiedActionPanel';

// Mock fixture: minimal game view with combat scenario
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
    totalDamageMin: 5,
    totalDamageMax: 15,
    resistances: {},
    gold: 100,
    floor: 1,
    experience: 0,
    experienceForNextLevel: 100,
    biomeId: 'dungeon',
    biomeColor: '#888888',
    statuses: [],
    abilities: [
      {
        id: 'ability1',
        name: 'Test Ability',
        description: 'A test ability',
        ready: true,
        cooldownRemaining: 0,
        requiresTarget: false,
      },
    ],
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
  combatLog: [],
  availableActions: [],
  town: null,
  inventory: {
    items: [
      {
        id: 'sword1',
        name: 'Iron Sword',
        description: 'A basic sword',
        itemClass: 'weapon',
        rarity: 'common',
        rarityColor: '#a0a0a0',
        value: 50,
        sellPrice: 25,
        isEquipped: true,
        quantity: 1,
        stackEntityIds: [],
        templateId: 'sword',
        weaponStats: { damage: 10, damageMin: 10, damageMax: 10, damageType: 'physical', accuracy: 80, speed: 1, weaponRange: 1 },
      },
      {
        id: 'potion1',
        name: 'Health Potion',
        description: 'Restores 50 HP',
        itemClass: 'consumable',
        rarity: 'common',
        rarityColor: '#a0a0a0',
        value: 20,
        sellPrice: 10,
        isEquipped: false,
        quantity: 3,
        stackEntityIds: [],
        templateId: 'potion_health',
      },
    ],
    equipped: {
      weapon: {
        id: 'sword1',
        name: 'Iron Sword',
        description: 'A basic sword',
        itemClass: 'weapon',
        rarity: 'common',
        rarityColor: '#a0a0a0',
        value: 50,
        sellPrice: 25,
        isEquipped: true,
        quantity: 1,
        stackEntityIds: [],
        templateId: 'sword',
        weaponStats: { damage: 10, damageMin: 10, damageMax: 10, damageType: 'physical', accuracy: 80, speed: 1, weaponRange: 1 },
      },
      chest: null,
      head: null,
      gloves: null,
      boots: null,
      ring1: null,
      ring2: null,
      secondaryWeapon: null,
    },
  },
  activeQuests: [],
  runResult: null,
  deathStashFloor: null,
  deathSummary: null,
  inspectableEntities: [],
  debugMode: false,
  deathContext: null,

  animatedEvents: [],
  ...overrides,
});

describe('UnifiedActionPanel', () => {
  let mockSendCommand: ReturnType<typeof vi.fn>;
  let mockInspectOpen: ReturnType<typeof vi.fn>;

  // Helper to find action buttons by name
  const findActionButton = (action: string) => {
    const buttons = screen. getAllByRole('button');
    return buttons.find(b => b.getAttribute('aria-label')?.startsWith(action + ':'));
  };

  beforeEach(() => {
    mockSendCommand = vi.fn();
    mockInspectOpen = vi.fn();
  });

  describe('Button Rendering', () => {
    it('renders all 7 action buttons', () => {
      const view = createMockGameView();
      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // Use getAllByRole since we have many buttons, then find by aria-label prefix
      const buttons = screen.getAllByRole('button');
      const ariaLabels = buttons.map(b => b.getAttribute('aria-label') || '');

      expect(ariaLabels.some(l => l.startsWith('Wait:'))).toBe(true);
      expect(ariaLabels.some(l => l.startsWith('Attack:'))).toBe(true);
      expect(ariaLabels.some(l => l.startsWith('Swap:'))).toBe(true);
      expect(ariaLabels.some(l => l.startsWith('Ability:'))).toBe(true);
      expect(ariaLabels.some(l => l.startsWith('Interact:'))).toBe(true);
      expect(ariaLabels.some(l => l.startsWith('Use:'))).toBe(true);
      expect(ariaLabels.some(l => l.startsWith('Inspect:'))).toBe(true);
    });
  });

  describe('Direct Actions', () => {
    it('dispatches WAIT command when Wait button clicked', async () => {
      const view = createMockGameView();
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const waitButton = findActionButton('Wait');
      expect(waitButton).toBeDefined();
      await user.click(waitButton!);

      expect(mockSendCommand).toHaveBeenCalledWith({ type: 'WAIT' });
    });

    it('dispatches SWAP_WEAPONS command when Swap button clicked', async () => {
      const view = createMockGameView({
        inventory: {
          ...createMockGameView().inventory,
          equipped: {
            ...createMockGameView().inventory.equipped,
            secondaryWeapon: {
              id: 'sword2',
              name: 'Secondary Sword',
              description: 'A secondary sword',
              itemClass: 'weapon',
              rarity: 'common',
              rarityColor: '#a0a0a0',
              value: 50,
              sellPrice: 25,
              isEquipped: false,
              quantity: 1,
              stackEntityIds: [],
              templateId: 'sword',
              weaponStats: { damage: 8, damageMin: 8, damageMax: 8, damageType: 'physical', accuracy: 75, speed: 2, weaponRange: 1 },
            },
          },
        },
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const swapButton = findActionButton('Swap');
      expect(swapButton).toBeDefined();
      await user.click(swapButton!);

      expect(mockSendCommand).toHaveBeenCalledWith({ type: 'SWAP_WEAPONS' });
    });

    it('calls onInspectOpen when Inspect button clicked', async () => {
      const view = createMockGameView({
        inspectableEntities: [
          {
            id: 'goblin1',
            name: 'Goblin',
            description: 'A small goblin',
            ascii: 'g',
            color: '#0f0',
            entityType: 'enemy',
            health: 10,
            maxHealth: 10,
          },
        ],
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const inspectButton = findActionButton('Inspect');
      expect(inspectButton).toBeDefined();
      await user.click(inspectButton!);

      // Should call onInspectOpen callback
      expect(mockInspectOpen).toHaveBeenCalled();
    });
  });

  describe('Dropdown Actions', () => {
    it('auto-attacks single enemy in range', async () => {
      const view = createMockGameView();
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // Click Attack button with default mock (1 goblin in range)
      const attackButton = findActionButton('Attack');
      expect(attackButton).toBeDefined();
      await user.click(attackButton!);

      // Should auto-attack without showing dropdown
      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'ATTACK',
        targetId: 'goblin1',
      });
    });

    it('opens attack dropdown when multiple enemies in range', async () => {
      const view = createMockGameView({
        map: {
          ...createMockGameView().map!,
          playerPosition: { x: 5, y: 5 },
          entities: [
            {
              id: 'goblin1',
              name: 'Goblin One',
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
              id: 'goblin2',
              name: 'Goblin Two',
              x: 5,
              y: 6,
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
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // Initially no overlay visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Click Attack button
      const attackButton = findActionButton('Attack');
      expect(attackButton).toBeDefined();
      await user.click(attackButton!);

      // Overlay should now be visible
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('dispatches ATTACK command with targetId when enemy selected from dropdown', async () => {
      const view = createMockGameView({
        map: {
          ...createMockGameView().map!,
          playerPosition: { x: 5, y: 5 },
          entities: [
            {
              id: 'goblin1',
              name: 'Goblin One',
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
              id: 'goblin2',
              name: 'Goblin Two',
              x: 5,
              y: 6,
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
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // Open attack dropdown (with 2 enemies, should show dropdown)
      await user.click(screen.getByRole('button', { name: /Attack/i }));

      // Wait for dropdown to appear and click first enemy
      await waitFor(() => {
        expect(screen.getByText('Goblin One')).toBeInTheDocument();
      });

      const goblinButton = screen.getByText('Goblin One').closest('button');
      await user.click(goblinButton!);

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'ATTACK',
        targetId: 'goblin1',
      });
    });

    it('opens ability dropdown when Ability button clicked', async () => {
      const view = createMockGameView();
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const abilityButton = findActionButton('Ability');
      expect(abilityButton).toBeDefined();
      await user.click(abilityButton!);

      await waitFor(() => {
        expect(screen.getByText('Test Ability')).toBeInTheDocument();
      });
    });

    it('dispatches USE_ABILITY for a no-target ability', async () => {
      const baseView = createMockGameView();
      const view = createMockGameView({
        player: {
          ...baseView.player,
          abilities: [
            {
              id: 'second_wind',
              name: 'Second Wind',
              description: 'Recover health.',
              ready: true,
              cooldownRemaining: 0,
              requiresTarget: false,
              requiresDirection: false,
            },
          ],
        },
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      await user.click(findActionButton('Ability')!);
      await waitFor(() => {
        expect(screen.getByText('Second Wind')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Second Wind'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'USE_ABILITY',
        abilityId: 'second_wind',
        targetId: undefined,
        direction: undefined,
      });
    });

    it('dispatches USE_ABILITY for a single-target ability with one enemy in range', async () => {
      const baseView = createMockGameView();
      const view = createMockGameView({
        player: {
          ...baseView.player,
          abilities: [
            {
              id: 'power_strike',
              name: 'Power Strike',
              description: 'Hit a single enemy.',
              ready: true,
              cooldownRemaining: 0,
              requiresTarget: true,
              requiresDirection: false,
            },
          ],
        },
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      await user.click(findActionButton('Ability')!);
      await waitFor(() => {
        expect(screen.getByText('Power Strike')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Power Strike'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'USE_ABILITY',
        abilityId: 'power_strike',
        targetId: 'goblin1',
        direction: undefined,
      });
    });

    it('dispatches USE_ABILITY after selecting from a multi-target chooser', async () => {
      const baseView = createMockGameView();
      const view = createMockGameView({
        player: {
          ...baseView.player,
          abilities: [
            {
              id: 'power_strike',
              name: 'Power Strike',
              description: 'Hit a single enemy.',
              ready: true,
              cooldownRemaining: 0,
              requiresTarget: true,
              requiresDirection: false,
            },
          ],
        },
        map: {
          ...baseView.map!,
          entities: [
            {
              id: 'goblin1',
              name: 'Goblin One',
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
              id: 'goblin2',
              name: 'Goblin Two',
              x: 5,
              y: 6,
              ascii: 'g',
              color: '#0f0',
              type: 'enemy',
              health: 30,
              maxHealth: 30,
              templateId: 'goblin',
            },
          ],
        },
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      await user.click(findActionButton('Ability')!);
      await waitFor(() => {
        expect(screen.getByText('Power Strike')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Power Strike'));

      await waitFor(() => {
        expect(screen.getByText('Goblin One')).toBeInTheDocument();
        expect(screen.getByText('Goblin Two')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Goblin Two'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'USE_ABILITY',
        abilityId: 'power_strike',
        targetId: 'goblin2',
        direction: undefined,
      });
    });

    it('dispatches USE_ABILITY for a direction-required ability', async () => {
      const baseView = createMockGameView();
      const view = createMockGameView({
        player: {
          ...baseView.player,
          abilities: [
            {
              id: 'cinder_wake',
              name: 'Cinder Wake',
              description: 'Burn enemies in a line.',
              ready: true,
              cooldownRemaining: 0,
              requiresTarget: false,
              requiresDirection: true,
            },
          ],
        },
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      await user.click(findActionButton('Ability')!);
      await waitFor(() => {
        expect(screen.getByText('Cinder Wake')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Cinder Wake'));
      await waitFor(() => {
        expect(screen.getByText('Select direction for Cinder Wake')).toBeInTheDocument();
      });
      await user.click(screen.getByText('→'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'USE_ABILITY',
        abilityId: 'cinder_wake',
        targetId: undefined,
        direction: 'E',
      });
    });

    it('dispatches SET_TRAP with trap item and direction', async () => {
      const baseView = createMockGameView();
      const view = createMockGameView({
        player: {
          ...baseView.player,
          abilities: [
            {
              id: 'dagger_set_trap',
              name: 'Set Trap',
              description: 'Place a trap.',
              ready: true,
              cooldownRemaining: 0,
              requiresTarget: false,
              requiresDirection: true,
            },
          ],
        },
        inventory: {
          ...baseView.inventory,
          items: [
            ...baseView.inventory.items,
            {
              id: 'trap-stack-1',
              name: 'Spike Trap',
              description: 'Placeable trap.',
              itemClass: 'trap',
              rarity: 'common',
              rarityColor: '#a0a0a0',
              value: 30,
              sellPrice: 15,
              isEquipped: false,
              quantity: 1,
              stackEntityIds: ['trap_entity_1'],
              templateId: 'trap_spikes',
            },
          ],
        },
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      await user.click(findActionButton('Ability')!);
      await waitFor(() => {
        expect(screen.getByText('Set Trap')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Set Trap'));
      await waitFor(() => {
        expect(screen.getByText('Spike Trap')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Spike Trap'));
      await waitFor(() => {
        expect(screen.getByText('Select trap placement direction')).toBeInTheDocument();
      });
      await user.click(screen.getByText('↑'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'SET_TRAP',
        direction: 'N',
        itemEntityId: 'trap_entity_1',
      });
    });

    it('dispatches USE_ITEM command when consumable selected', async () => {
      const view = createMockGameView();
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // Open Use dropdown
      const useButton = findActionButton('Use');
      expect(useButton).toBeDefined();
      await user.click(useButton!);

      // Wait for dropdown and click potion
      await waitFor(() => {
        expect(screen.getByText('Health Potion')).toBeInTheDocument();
      });

      const potionButton = screen.getByText('Health Potion').closest('button');
      await user.click(potionButton!);

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'USE_ITEM',
        itemId: 'potion1',
      });
    });

    it('closes attack dropdown when Cancel clicked', async () => {
      const view = createMockGameView({
        map: {
          ...createMockGameView().map!,
          playerPosition: { x: 5, y: 5 },
          entities: [
            {
              id: 'goblin1',
              name: 'Goblin One',
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
              id: 'goblin2',
              name: 'Goblin Two',
              x: 5,
              y: 6,
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
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // Open attack dropdown
      const attackButton = findActionButton('Attack');
      expect(attackButton).toBeDefined();
      await user.click(attackButton!);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click Cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Dialog should disappear
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // No commands should have been sent
      expect(mockSendCommand).not.toHaveBeenCalled();
    });
  });

  describe('Button Enable/Disable States', () => {
    it('disables Attack button when no enemies in range', () => {
      const view = createMockGameView({
        map: {
          ...createMockGameView().map!,
          entities: [], // No enemies
        },
      });

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const attackButton = findActionButton('Attack');
      expect(attackButton).toBeDefined();
      expect(attackButton).toBeDisabled();
    });

    it('enables Use button when consumables available', () => {
      const view = createMockGameView();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const useButton = findActionButton('Use');
      expect(useButton).toBeDefined();
      expect(useButton).not.toBeDisabled();
    });

    it('enables Swap button when primary weapon exists', () => {
      const view = createMockGameView();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const swapButton = findActionButton('Swap');
      expect(swapButton).toBeDefined();
      expect(swapButton).not.toBeDisabled();
    });

    it('disables Swap button when no primary weapon', () => {
      const view = createMockGameView({
        inventory: {
          ...createMockGameView().inventory,
          equipped: {
            ...createMockGameView().inventory.equipped,
            weapon: null,
          },
        },
      });

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      const swapButton = findActionButton('Swap');
      expect(swapButton).toBeDefined();
      expect(swapButton).toBeDisabled();
    });
  });

  describe('Weapon Range Filtering', () => {
    it('only shows enemies within weapon range in Attack dropdown', async () => {
      const view = createMockGameView({
        map: {
          ...createMockGameView().map!,
          playerPosition: { x: 5, y: 5 },
          entities: [
            // Enemy within melee range (1 tile)
            {
              id: 'goblin1',
              name: 'Nearby Goblin',
              x: 6,
              y: 5,
              ascii: 'g',
              color: '#0f0',
              type: 'enemy',
              health: 30,
              maxHealth: 30,
              templateId: 'goblin',
            },
            // Enemy outside melee range (2 tiles)
            {
              id: 'goblin2',
              name: 'Far Goblin',
              x: 7,
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
      });
      const user = userEvent.setup();

      render(
        <UnifiedActionPanel
          view={view}
          onSendCommand={mockSendCommand}
          onInspectOpen={mockInspectOpen}
        />
      );

      // With only 1 enemy in range, should auto-attack
      const attackButton = findActionButton('Attack');
      expect(attackButton).toBeDefined();
      await user.click(attackButton!);

      // Should auto-attack the nearby goblin
      expect(mockSendCommand).toHaveBeenCalledWith({
        type: 'ATTACK',
        targetId: 'goblin1',
      });
    });
  });
});
