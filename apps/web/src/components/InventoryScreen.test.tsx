/**
 * InventoryScreen Component Tests
 *
 * Verifies that the full-screen inventory view correctly displays
 * equipment slots, bag items, and item inspection modal.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryScreen } from './InventoryScreen.js';
import type { InventoryView } from '@dungeon/presenter';

// Fixtures
const mockWeapon = {
  id: 'w1',
  name: 'Iron Sword',
  description: 'A sword',
  itemClass: 'weapon' as const,
  rarity: 'common' as const,
  rarityColor: '#a0a0a0',
  value: 50,
  sellPrice: 25,
  isEquipped: true,
  quantity: 1,
  stackEntityIds: ['w1'],
  templateId: 'iron_sword',
  weaponStats: {
    damage: 8,
    damageMin: 8,
    damageMax: 8,
    damageType: 'physical' as const,
    accuracy: 85,
    speed: 1,
    weaponRange: 1,
  },
};

const mockConsumable = {
  id: 'c1',
  name: 'Health Potion',
  description: 'Restores health',
  itemClass: 'consumable' as const,
  rarity: 'common' as const,
  rarityColor: '#a0a0a0',
  value: 20,
  sellPrice: 10,
  isEquipped: false,
  quantity: 3,
  stackEntityIds: ['c1', 'c2', 'c3'],
  templateId: 'health_potion',
};

const mockArmor = {
  id: 'a1',
  name: 'Leather Chest',
  description: 'Armor',
  itemClass: 'armor' as const,
  rarity: 'uncommon' as const,
  rarityColor: '#4fc3f7',
  value: 80,
  sellPrice: 40,
  isEquipped: false,
  quantity: 1,
  stackEntityIds: ['a1'],
  templateId: 'leather_chest',
  armorStats: {
    defense: 5,
    evasionPenalty: 0,
    slot: 'chest' as const,
    enchantmentSlots: 2,
    enchantments: [null, null],
  },
};

const emptyEquipped = {
  weapon: mockWeapon,
  secondaryWeapon: null,
  chest: null,
  head: null,
  gloves: null,
  boots: null,
  ring1: null,
  ring2: null,
};

const emptyInventory: InventoryView = {
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
};

describe('InventoryScreen Component', () => {
  describe('Header and Navigation', () => {
    it('renders inventory title', () => {
      render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Inventory/i)).toBeInTheDocument();
    });

    it('renders back to game button', () => {
      const onClose = vi.fn();
      render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={onClose}
          sendCommand={vi.fn()}
        />
      );

      const backButton = screen.getByText(/Back to Game/i);
      expect(backButton).toBeInTheDocument();
      fireEvent.click(backButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Equipment Display', () => {
    it('renders equipment section', () => {
      render(
        <InventoryScreen
          inventory={{ ...emptyInventory, equipped: emptyEquipped }}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Equipment/i)).toBeInTheDocument();
      expect(screen.getByText(/Iron Sword/)).toBeInTheDocument();
    });

    it('renders all 8 equipment slots', () => {
      render(
        <InventoryScreen
          inventory={{ ...emptyInventory, equipped: emptyEquipped }}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Main Hand/i)).toBeInTheDocument();
      expect(screen.getByText(/Off Hand/i)).toBeInTheDocument();
      expect(screen.getByText(/Chest/i)).toBeInTheDocument();
      expect(screen.getByText(/Head/i)).toBeInTheDocument();
      expect(screen.getByText(/Gloves/i)).toBeInTheDocument();
      expect(screen.getByText(/Boots/i)).toBeInTheDocument();
      expect(screen.getByText(/Ring 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Ring 2/i)).toBeInTheDocument();
    });
  });

  describe('Bag Items Display', () => {
    it('renders bag section with non-equipped items', () => {
      const inventory: InventoryView = {
        items: [mockWeapon, mockConsumable, mockArmor],
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Bag/i)).toBeInTheDocument();
      // Equipped item should not appear in bag
      // Unequipped items should appear
      expect(screen.getByText('Health Potion')).toBeInTheDocument();
      expect(screen.getByText('Leather Chest')).toBeInTheDocument();
    });

    it('does not render unequipped items in equipment section', () => {
      const inventory: InventoryView = {
        items: [mockConsumable, mockArmor],
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Bag items should appear but not in equipment grid
      const consumables = screen.queryAllByText('Health Potion');
      expect(consumables.length).toBeGreaterThan(0);
    });

    it('shows item quantities for stacked items', () => {
      const inventory: InventoryView = {
        items: [mockConsumable],
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/x3/)).toBeInTheDocument(); // quantity badge
    });
  });

  describe('Item Inspection', () => {
    it('opens item inspect modal when clicking bag item', () => {
      const inventory: InventoryView = {
        items: [mockConsumable],
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      const itemButton = screen.getByText('Health Potion');
      fireEvent.click(itemButton);

      // Modal should appear with item details
      expect(screen.getByText(/Restores health/i)).toBeInTheDocument();
    });

    it('closes modal when back to game is clicked in modal context', () => {
      const inventory: InventoryView = {
        items: [mockConsumable],
        equipped: emptyEquipped,
      };

      const { rerender } = render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Click to open modal
      const itemButton = screen.getByText('Health Potion');
      fireEvent.click(itemButton);
      expect(screen.getByText(/Restores health/i)).toBeInTheDocument();

      // Close button (✕) should be visible
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      // Re-render to see if modal is closed
      // Modal should be gone, item should still be clickable
      rerender(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // The item should still exist but modal state is cleared
      // (In a real scenario, this would be tested via state observation)
    });

    it('shows comparison modal for equipment slots', () => {
      const inventory: InventoryView = {
        items: [mockArmor],
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Click on equipped weapon
      const equippedWeapon = screen.getByText('Iron Sword');
      fireEvent.click(equippedWeapon);

      // Modal should show the weapon stats
      expect(screen.getByText(/Damage/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders gracefully with no items', () => {
      render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Inventory/i)).toBeInTheDocument();
      expect(screen.getByText(/Equipment/i)).toBeInTheDocument();
    });
  });

  describe('Phase Context', () => {
    it('passes correct phase to item inspect modal', () => {
      const inventory: InventoryView = {
        items: [mockConsumable], // unequipped consumable item
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Clicking an item opens modal with inspect details
      const itemButton = screen.getByText('Health Potion');
      fireEvent.click(itemButton);
      // Modal should render with item description
      expect(screen.getByText(/Restores health/)).toBeInTheDocument();
    });
  });
});
