import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AbilityDropdown } from './AbilityDropdown';
import type { AbilityView, EntityView, InventoryItemView } from '@dungeon/presenter';

const createEnemy = (id: string, x: number, y: number, name: string = 'Goblin'): EntityView => ({
  id,
  x,
  y,
  ascii: 'g',
  color: '#0f0',
  name,
  type: 'enemy',
  health: 10,
  maxHealth: 10,
  templateId: 'goblin',
});

const createTrap = (id: string, x: number, y: number, name: string = 'Spike Trap'): EntityView => ({
  id,
  x,
  y,
  ascii: '^',
  color: '#f00',
  name,
  type: 'object',
  isDisarmableTrap: true,
  templateId: 'trap_spikes',
});

const createTrapItem = (id: string, name: string = 'Spike Trap'): InventoryItemView => ({
  id,
  name,
  itemClass: 'trap',
  description: 'A trap item',
  rarity: 'common',
  rarityColor: '#888888',
  value: 10,
  sellPrice: 5,
  isEquipped: false,
  quantity: 1,
  stackEntityIds: ['trap_entity_1'],
  templateId: 'trap_spikes',
});

const createBow = (): InventoryItemView => ({
  id: 'bow1',
  name: 'Short Bow',
  itemClass: 'weapon',
  description: 'A ranged weapon',
  rarity: 'common',
  rarityColor: '#888888',
  value: 10,
  sellPrice: 5,
  isEquipped: true,
  quantity: 1,
  stackEntityIds: ['bow1'],
  templateId: 'short_bow',
  weaponStats: {
    damage: 6,
    damageMin: 5,
    damageMax: 7,
    damageType: 'physical',
    accuracy: 14,
    speed: 5,
    weaponRange: 5,
    minRange: 2,
  },
});

describe('AbilityDropdown', () => {
  describe('Self-targeted abilities', () => {
    it('does not assign targetId for self-targeted abilities', () => {
      const onSelect = vi.fn();

      const abilities: Array<AbilityView & { readonly isRanged?: boolean }> = [
        {
          id: 'second_wind',
          name: 'Second Wind',
          description: 'Heal yourself',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: false,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[createEnemy('enemy1', 1, 0)]}
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Second Wind'));

      expect(onSelect).toHaveBeenCalledWith({ abilityId: 'second_wind' });
    });
  });

  describe('Single-target abilities', () => {
    it('auto-fires when exactly one enemy in range', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'power_strike',
          name: 'Power Strike',
          description: 'Attack with force',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: true,
          requiresDirection: false,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[createEnemy('enemy1', 1, 0)]}
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Power Strike'));

      expect(onSelect).toHaveBeenCalledWith({ abilityId: 'power_strike', targetId: 'enemy1' });
    });

    it('shows target chooser when multiple enemies in range', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'power_strike',
          name: 'Power Strike',
          description: 'Attack with force',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: true,
          requiresDirection: false,
        },
      ];

      const enemies = [
        createEnemy('enemy1', 1, 0, 'Goblin 1'),
        createEnemy('enemy2', 0, 1, 'Goblin 2'),
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={enemies}
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Power Strike'));

      // Should display both enemies as choosable targets
      expect(screen.getByText('Goblin 1')).toBeInTheDocument();
      expect(screen.getByText('Goblin 2')).toBeInTheDocument();

      // Clicking an enemy should call onSelect
      fireEvent.click(screen.getByText('Goblin 1'));
      expect(onSelect).toHaveBeenCalledWith({ abilityId: 'power_strike', targetId: 'enemy1' });
    });

    it('disables when no enemies in range', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'power_strike',
          name: 'Power Strike',
          description: 'Attack with force',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: true,
          requiresDirection: false,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[createEnemy('enemy1', 5, 5)]} // Far away
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      const button = screen.getByText('Power Strike').closest('button');
      expect(button).toBeDisabled();
    });

    it('uses equipped weapon range for ranged abilities', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'ranged_pin',
          name: 'Ranged Pin',
          description: 'Pin an enemy at range',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: true,
          requiresDirection: false,
          isRanged: true,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[createEnemy('enemy1', 3, 0)]}
          inventory={[]}
          equippedWeapon={createBow()}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Ranged Pin'));

      expect(onSelect).toHaveBeenCalledWith({ abilityId: 'ranged_pin', targetId: 'enemy1' });
    });
  });

  describe('Disarm-trap ability', () => {
    it('auto-disarms when exactly one trap adjacent', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_disarm',
          name: 'Disarm',
          description: 'Disarm a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: false,
        },
      ];

      const mapObjects = [createTrap('trap1', 1, 0)];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={[]}
          playerX={0}
          playerY={0}
          mapObjects={mapObjects}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Disarm'));

      // Should auto-disarm without showing chooser
      expect(onSelect).toHaveBeenCalledWith({
        abilityId: 'dagger_disarm',
        direction: 'E',
      });
    });

    it('shows trap chooser when multiple adjacent traps', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_disarm',
          name: 'Disarm',
          description: 'Disarm a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: false,
        },
      ];

      const mapObjects = [
        createTrap('trap1', 1, 0, 'Spike Trap'),
        createTrap('trap2', 0, 1, 'Fire Trap'),
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={[]}
          playerX={0}
          playerY={0}
          mapObjects={mapObjects}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Disarm'));

      // Should show both traps as choosable
      expect(screen.getByText('Spike Trap')).toBeInTheDocument();
      expect(screen.getByText('Fire Trap')).toBeInTheDocument();

      // Clicking a trap should disarm it
      fireEvent.click(screen.getByText('Spike Trap'));
      expect(onSelect).toHaveBeenCalledWith({
        abilityId: 'dagger_disarm',
        direction: 'E',
      });
    });

    it('disables when no adjacent traps', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_disarm',
          name: 'Disarm',
          description: 'Disarm a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: false,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={[]}
          playerX={0}
          playerY={0}
          mapObjects={[]}
          onSelect={onSelect}
        />
      );

      const button = screen.getByText('Disarm').closest('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Set-trap ability', () => {
    it('shows trap picker when no trap selected', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_set_trap',
          name: 'Set Trap',
          description: 'Place a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: true,
        },
      ];

      const inventory: InventoryItemView[] = [createTrapItem('trap_item', 'Spike Trap')];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={inventory}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Set Trap'));

      // Should show trap picker
      expect(screen.getByText('Spike Trap')).toBeInTheDocument();
    });

    it('shows direction selector after trap selected', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_set_trap',
          name: 'Set Trap',
          description: 'Place a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: true,
        },
      ];

      const inventory: InventoryItemView[] = [createTrapItem('trap_item', 'Spike Trap')];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={inventory}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Set Trap'));
      fireEvent.click(screen.getByText('Spike Trap'));

      // Should show direction selector
      expect(screen.getByText('Select trap placement direction')).toBeInTheDocument();
      expect(screen.getByText('↑')).toBeInTheDocument(); // North button
    });

    it('completes set-trap with direction selection', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_set_trap',
          name: 'Set Trap',
          description: 'Place a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: true,
        },
      ];

      const inventory: InventoryItemView[] = [createTrapItem('trap_item', 'Spike Trap')];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={inventory}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Set Trap'));
      fireEvent.click(screen.getByText('Spike Trap'));
      fireEvent.click(screen.getByText('↑')); // Select North

      expect(onSelect).toHaveBeenCalledWith({
        abilityId: 'dagger_set_trap',
        direction: 'N',
        itemEntityId: 'trap_entity_1',
      });
    });

    it('disables when no traps in inventory', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'dagger_set_trap',
          name: 'Set Trap',
          description: 'Place a trap',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: true,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      const button = screen.getByText('Set Trap').closest('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Ability cooldowns', () => {
    it('disables ability with cooldown remaining', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'power_strike',
          name: 'Power Strike',
          description: 'Attack with force',
          ready: false,
          cooldownRemaining: 3,
          requiresTarget: true,
          requiresDirection: false,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[createEnemy('enemy1', 1, 0)]}
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      const button = screen.getByText('Power Strike').closest('button');
      expect(button).toBeDisabled();
      expect(screen.getByText('Cooldown: 3 turns')).toBeInTheDocument();
    });
  });

  describe('Direction-based abilities', () => {
    it('shows direction selector for direction-required abilities', () => {
      const onSelect = vi.fn();

      const abilities: AbilityView[] = [
        {
          id: 'test_direction_ability',
          name: 'Push',
          description: 'Push in a direction',
          ready: true,
          cooldownRemaining: 0,
          requiresTarget: false,
          requiresDirection: true,
        },
      ];

      render(
        <AbilityDropdown
          abilities={abilities}
          enemies={[]}
          inventory={[]}
          playerX={0}
          playerY={0}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Push'));

      // Should show direction selector
      expect(screen.getByText('Select direction for Push')).toBeInTheDocument();
    });
  });
});
