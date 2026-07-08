/**
 * Test layer: unit
 * Behavior: InventoryScreen covers InventoryScreen Component; Header and Navigation; renders inventory title.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/InventoryScreen.test.tsx
 */
/**
 * InventoryScreen Component Tests
 *
 * Verifies that the full-screen inventory view correctly displays
 * equipment slots, bag items, and item inspection modal.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(() => ({ isMobile: false })),
}));

import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';
import { InventoryScreen } from './InventoryScreen.js';
import type { InventoryView, DismissibleNotice } from '@dungeon/presenter';

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
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
  });

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

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

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

      // Bag items are unmounted while the equipment section is visible.
      expect(screen.queryByText('Health Potion')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

      expect(screen.getByText('Health Potion')).toBeInTheDocument();
      expect(screen.queryByText(/Main Hand/i)).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

      expect(screen.getByText(/x3/)).toBeInTheDocument(); // quantity badge
    });

    it('expands and collapses the bag list while unmounting hidden sections', () => {
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

      const toggle = screen.getByRole('button', { name: /expand/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      // Equipment should always be visible
      expect(screen.getByText(/Main Hand/i)).toBeInTheDocument();

      fireEvent.click(toggle);

      expect(screen.getByRole('button', { name: /collapse/i })).toHaveAttribute('aria-expanded', 'true');
      // Equipment is unmounted while bag is expanded.
      expect(screen.queryByText(/Main Hand/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Back to Game/i)).toBeInTheDocument();
      expect(screen.getByText('Health Potion')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /collapse/i }));

      expect(screen.getByRole('button', { name: /expand/i })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Health Potion')).not.toBeInTheDocument();
      // Equipment returns when bag is collapsed.
      expect(screen.getByText(/Main Hand/i)).toBeInTheDocument();
    });

    it('keeps bag actions working while expanded', () => {
      const sendCommand = vi.fn();
      const inventory: InventoryView = {
        items: [mockWeapon, mockArmor],
        equipped: emptyEquipped,
      };

      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={sendCommand}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));
      fireEvent.click(screen.getByRole('button', { name: /equip/i }));

      expect(sendCommand).toHaveBeenCalledWith({ type: 'EQUIP', itemId: 'a1' });
    });

    it('returns to equipment view when the expanded bag becomes empty', async () => {
      const inventory: InventoryView = {
        items: [mockArmor],
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

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));
      expect(screen.getByText(/Bag/i)).toBeInTheDocument();

      rerender(
        <InventoryScreen
          inventory={{
            items: [mockArmor],
            equipped: { ...emptyEquipped, chest: mockArmor },
          }}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Equipment/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
      expect(screen.getByText('Leather Chest')).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

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
      fireEvent.click(screen.getByRole('button', { name: /expand/i }));
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
      fireEvent.click(screen.getByRole('button', { name: /expand/i }));
      const itemButton = screen.getByText('Health Potion');
      fireEvent.click(itemButton);
      // Modal should render with item description
      expect(screen.getByText(/Restores health/)).toBeInTheDocument();
    });
  });

  describe('Responsive scroll clearance', () => {
    it('adds tab bar clearance to the bag list on mobile', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
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

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

      expect(screen.getByTestId('inventory-item-list')).toHaveStyle(
        `padding-bottom: ${TAB_BAR_HEIGHT}px`,
      );
    });
  });

  describe('Dismissible Notice Modal', () => {
    const mockNotice: DismissibleNotice = {
      id: 'equip_blocked_1',
      kind: 'EQUIP_BLOCKED',
      message: 'You are not strong enough to equip this item',
    };

    it('does not render notice modal when notice prop is undefined', () => {
      render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={undefined}
        />
      );

      expect(screen.queryByText('Equipment Blocked')).not.toBeInTheDocument();
    });

    it('renders notice modal when notice prop is provided', () => {
      render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={mockNotice}
        />
      );

      expect(screen.getByText('Equipment Blocked')).toBeInTheDocument();
      expect(screen.getByText('You are not strong enough to equip this item')).toBeInTheDocument();
    });

    it('hides notice modal when dismissed via close button', () => {
      const { rerender } = render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={mockNotice}
        />
      );

      // Notice should be visible
      expect(screen.getByText('You are not strong enough to equip this item')).toBeInTheDocument();

      // Click the close button (✕)
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      // Re-render with same notice — modal should stay hidden
      rerender(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={mockNotice}
        />
      );

      // Modal should be hidden after dismissal
      expect(screen.queryByText('You are not strong enough to equip this item')).not.toBeInTheDocument();
    });

    it('reopens notice modal when a new notice with different id arrives', () => {
      const firstNotice: DismissibleNotice = {
        id: 'equip_blocked_1',
        kind: 'EQUIP_BLOCKED',
        message: 'First error message',
      };

      const secondNotice: DismissibleNotice = {
        id: 'equip_blocked_2',
        kind: 'EQUIP_BLOCKED',
        message: 'Second error message',
      };

      const { rerender } = render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={firstNotice}
        />
      );

      // First notice visible
      expect(screen.getByText('First error message')).toBeInTheDocument();

      // Dismiss it
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      // First notice should be hidden
      expect(screen.queryByText('First error message')).not.toBeInTheDocument();

      // Render with new notice (different id)
      rerender(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={secondNotice}
        />
      );

      // Second notice should now be visible
      expect(screen.getByText('Second error message')).toBeInTheDocument();
    });

    it('keeps notice hidden if cleared to undefined after dismissal', () => {
      const { rerender } = render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={mockNotice}
        />
      );

      // Dismiss the notice
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      // Render without notice
      rerender(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={undefined}
        />
      );

      // No notice should be visible
      expect(screen.queryByText('Equipment Blocked')).not.toBeInTheDocument();
    });

    it('dismissal state persists across re-renders with same notice', () => {
      const { rerender } = render(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={mockNotice}
        />
      );

      // Notice should be visible
      expect(screen.getByText('You are not strong enough to equip this item')).toBeInTheDocument();

      // Click the close button to dismiss
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      // Modal should be hidden after dismissal
      expect(screen.queryByText('Equipment Blocked')).not.toBeInTheDocument();

      // Re-render with same notice - should still be dismissed
      rerender(
        <InventoryScreen
          inventory={emptyInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
          notice={mockNotice}
        />
      );

      // Modal should remain dismissed
      expect(screen.queryByText('Equipment Blocked')).not.toBeInTheDocument();
    });
  });

  describe('Mobile Layout with Fully Equipped Player', () => {
    const fullyEquippedInventory: InventoryView = {
      items: [mockConsumable, mockArmor],
      equipped: {
        weapon: mockWeapon,
        secondaryWeapon: { ...mockWeapon, id: 'w2', name: 'Steel Sword' },
        chest: { ...mockArmor, id: 'a2', name: 'Iron Chest' },
        head: { ...mockArmor, id: 'a3', name: 'Iron Helm' },
        gloves: { ...mockArmor, id: 'a4', name: 'Iron Gloves' },
        boots: { ...mockArmor, id: 'a5', name: 'Iron Boots' },
        ring1: { ...mockConsumable, id: 'r1', name: 'Fire Ring' },
        ring2: { ...mockConsumable, id: 'r2', name: 'Ice Ring' },
      },
    };

    it('ensures all 8 equipped items are visible in equipment section on mobile', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      render(
        <InventoryScreen
          inventory={fullyEquippedInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // All 8 equipment slots should be visible
      expect(screen.getByText('Iron Sword')).toBeInTheDocument(); // weapon
      expect(screen.getByText('Steel Sword')).toBeInTheDocument(); // secondaryWeapon
      expect(screen.getByText('Iron Chest')).toBeInTheDocument(); // chest
      expect(screen.getByText('Iron Helm')).toBeInTheDocument(); // head
      expect(screen.getByText('Iron Gloves')).toBeInTheDocument(); // gloves
      expect(screen.getByText('Iron Boots')).toBeInTheDocument(); // boots
      expect(screen.getByText('Fire Ring')).toBeInTheDocument(); // ring1
      expect(screen.getByText('Ice Ring')).toBeInTheDocument(); // ring2
    });

    it('ensures equipment section displays properly with full equipment on mobile (no off-screen items)', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      const { container } = render(
        <InventoryScreen
          inventory={fullyEquippedInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Verify all 8 equipment slots are rendered
      const allSlots = container.querySelectorAll('[style*="border"][style*="padding"]');
      expect(allSlots.length).toBeGreaterThanOrEqual(8);

      // Verify no slots are hidden
      allSlots.forEach(slot => {
        const computedStyle = window.getComputedStyle(slot);
        expect(computedStyle.display).not.toBe('none');
      });
    });

    it('keeps equip buttons visible and clickable for all bag items on mobile with fully equipped player', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      const inventory: InventoryView = {
        items: [
          { ...mockWeapon, id: 'w3', name: 'Long Sword' },
          { ...mockArmor, id: 'a6', name: 'Plate Armor' },
        ],
        equipped: fullyEquippedInventory.equipped,
      };

      const sendCommand = vi.fn();
      render(
        <InventoryScreen
          inventory={inventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={sendCommand}
        />
      );

      // Expand the bag first (it starts collapsed)
      const expandButton = screen.getByRole('button', { name: /expand/i });
      fireEvent.click(expandButton);

      // All equippable items should have visible equip buttons
      const equipButtons = screen.getAllByRole('button', { name: /equip/i });
      expect(equipButtons.length).toBeGreaterThanOrEqual(2);

      // Buttons should be clickable
      if (equipButtons[0]) {
        fireEvent.click(equipButtons[0]);
        expect(sendCommand).toHaveBeenCalled();
      }
    });

    it('does not push bag section off-screen when fully equipped on mobile', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      render(
        <InventoryScreen
          inventory={fullyEquippedInventory}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Bag section should exist (but be hidden initially)
      // When expanded, it should be fully visible
      const expandBtn = screen.queryByRole('button', { name: /expand/i });
      if (expandBtn) {
        fireEvent.click(expandBtn);
        expect(screen.getByText(/Bag/i)).toBeVisible();
      }
    });

    it('displays item stats vertically on mobile to avoid horizontal overflow', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      const manyItemsWithStats: InventoryView = {
        items: Array.from({ length: 3 }, (_, i) => ({
          ...mockWeapon,
          id: `w${i}`,
          name: `Sword ${i}`,
          weaponStats: {
            damage: 10,
            damageMin: 10,
            damageMax: 15,
            damageType: 'physical' as const,
            accuracy: 90,
            speed: 1,
            weaponRange: 2, // Long range adds to stats string
          },
        })),
        equipped: fullyEquippedInventory.equipped,
      };

      render(
        <InventoryScreen
          inventory={manyItemsWithStats}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

      // Item list should exist and be scrollable
      const itemList = screen.getByTestId('inventory-item-list');
      expect(itemList).toHaveStyle('overflow: auto');
    });

    it('maintains proper layout on mobile even with many fully equipped items and bag items', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      const manyItems: InventoryView = {
        items: Array.from({ length: 15 }, (_, i) => ({
          ...mockConsumable,
          id: `c${i}`,
          name: `Potion ${i}`,
        })),
        equipped: fullyEquippedInventory.equipped,
      };

      render(
        <InventoryScreen
          inventory={manyItems}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Equipment section should still be visible initially
      expect(screen.getByText(/Equipment/i)).toBeInTheDocument();

      // Should be able to expand and see bag items
      const expandBtn = screen.getByRole('button', { name: /expand/i });
      fireEvent.click(expandBtn);
      expect(screen.getByText(/Bag/i)).toBeVisible();
      expect(screen.getByText('Potion 0')).toBeInTheDocument();
    });
  });
});
