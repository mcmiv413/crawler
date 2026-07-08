/**
 * Test layer: unit
 * Behavior: ItemInspectModal covers ItemInspectModal Component; Basic Rendering; renders item name and description.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/ItemInspectModal.test.tsx
 */
/**
 * ItemInspectModal Component Tests
 *
 * Verifies that the item inspection modal displays full stats,
 * shows equipment comparisons, and handles interactions.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemInspectModal } from './ItemInspectModal.js';
import type { InventoryItemView } from '@dungeon/presenter';

// Fixtures
const mockWeapon: InventoryItemView = {
  id: 'w1',
  name: 'Iron Sword',
  description: 'A solid iron sword',
  itemClass: 'weapon',
  rarity: 'common',
  rarityColor: '#a0a0a0',
  value: 50,
  sellPrice: 25,
  isEquipped: false,
  quantity: 1,
  stackEntityIds: ['w1'],
  templateId: 'iron_sword',
  weaponStats: {
    damage: 8,
    damageMin: 8,
    damageMax: 8,
    damageType: 'physical',
    accuracy: 85,
    speed: 1,
    weaponRange: 1,
  },
};

const betterWeapon: InventoryItemView = {
  ...mockWeapon,
  id: 'w2',
  name: 'Steel Sword',
  rarity: 'uncommon',
  value: 120,
  sellPrice: 60,
  weaponStats: {
    damage: 12,
    damageMin: 12,
    damageMax: 12,
    damageType: 'physical',
    accuracy: 90,
    speed: 1,
    weaponRange: 1,
  },
};

const mockArmor: InventoryItemView = {
  id: 'a1',
  name: 'Leather Chest',
  description: 'A leather chest piece',
  itemClass: 'armor',
  rarity: 'uncommon',
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
    slot: 'chest',
    enchantmentSlots: 2,
    enchantments: [null, null],
  },
};

describe('ItemInspectModal Component', () => {
  describe('Basic Rendering', () => {
    it('renders item name and description', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText('Iron Sword')).toBeInTheDocument();
      expect(screen.getByText('A solid iron sword')).toBeInTheDocument();
    });

    it('renders backdrop with click-to-close', () => {
      const onClose = vi.fn();
      const { container } = render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={onClose}
          sendCommand={vi.fn()}
        />
      );

      const backdrop = container.querySelector('[style*="rgba"]');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalled();
    });

    it('renders close button', () => {
      const onClose = vi.fn();
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={onClose}
          sendCommand={vi.fn()}
        />
      );

      const closeButton = screen.getByText('✕');
      expect(closeButton).toBeInTheDocument();
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Weapon Stats Display', () => {
    it('displays weapon stats when weaponStats present', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/8 physical/i)).toBeInTheDocument(); // damage + type
      expect(screen.getByText(/Accuracy: 85/i)).toBeInTheDocument();
      expect(screen.getByText(/Speed: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Range: 1/i)).toBeInTheDocument();
    });

    it('does not display weapon stats for non-weapon items', () => {
      render(
        <ItemInspectModal
          item={mockArmor}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.queryByText(/physical/)).not.toBeInTheDocument();
    });
  });

  describe('Armor Stats Display', () => {
    it('displays armor stats when armorStats present', () => {
      render(
        <ItemInspectModal
          item={mockArmor}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Defense: 5/i)).toBeInTheDocument();
      expect(screen.getByText(/Enchantment Slots: 2/i)).toBeInTheDocument();
    });

    it('displays evasion penalty when present', () => {
      const withPenalty = {
        ...mockArmor,
        armorStats: { ...mockArmor.armorStats!, evasionPenalty: 10 },
      };

      render(
        <ItemInspectModal
          item={withPenalty}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Evasion Penalty: 10/i)).toBeInTheDocument();
    });
  });

  describe('Comparison Section', () => {
    it('does not render comparison when equippedInSlot is null', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.queryByText(/Comparison/i)).not.toBeInTheDocument();
    });

    it('does not render comparison when item is same as equipped', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={mockWeapon}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.queryByText(/Comparison/i)).not.toBeInTheDocument();
    });

    it('renders comparison section when equipped item is different', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={betterWeapon}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Comparison/i)).toBeInTheDocument();
      // The comparison should show the current item stats
      expect(screen.getByText('DMG: 8')).toBeInTheDocument();
      // And the equipped item stats with (equipped) marker
      expect(screen.getByText(/Steel Sword.*equipped/i)).toBeInTheDocument();
    });

    it('shows stat differences in comparison', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={betterWeapon}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      // Should show comparison section with both items
      const ironSwords = screen.getAllByText('Iron Sword');
      expect(ironSwords.length).toBeGreaterThan(1); // In header and comparison

      expect(screen.getByText(/Steel Sword.*equipped/i)).toBeInTheDocument();
      // Verify comparison section exists with damage stat
      expect(screen.getByText('DMG: 8')).toBeInTheDocument(); // mockWeapon damage
      expect(screen.getByText('DMG: 12')).toBeInTheDocument(); // betterWeapon damage
    });
  });

  describe('Action Buttons', () => {
    it('renders equip button for unequipped weapon', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      const equipButton = screen.getByText(/Equip/i);
      expect(equipButton).toBeInTheDocument();
    });

    it('renders unequip button for equipped item', () => {
      const equipped = { ...mockWeapon, isEquipped: true };
      render(
        <ItemInspectModal
          item={equipped}
          equippedInSlot={equipped}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      const unequipButton = screen.getByText(/Unequip/i);
      expect(unequipButton).toBeInTheDocument();
    });

    it('calls sendCommand with EQUIP when equip button clicked', () => {
      const sendCommand = vi.fn();
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={sendCommand}
        />
      );

      const equipButton = screen.getByText(/Equip/i);
      fireEvent.click(equipButton);

      expect(sendCommand).toHaveBeenCalledWith({ type: 'EQUIP', itemId: 'w1' });
    });

    it('calls sendCommand with UNEQUIP when unequip button clicked', () => {
      const sendCommand = vi.fn();
      const equipped = { ...mockWeapon, isEquipped: true };
      render(
        <ItemInspectModal
          item={equipped}
          equippedInSlot={equipped}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={sendCommand}
        />
      );

      const unequipButton = screen.getByText(/Unequip/i);
      fireEvent.click(unequipButton);

      expect(sendCommand).toHaveBeenCalledWith({ type: 'UNEQUIP', itemId: 'w1' });
    });

    it('renders use button for consumables', () => {
      const consumable: InventoryItemView = {
        ...mockWeapon,
        itemClass: 'consumable',
        weaponStats: undefined,
      };
      render(
        <ItemInspectModal
          item={consumable}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      const useButton = screen.getByText(/Use/i);
      expect(useButton).toBeInTheDocument();
    });

    it('renders sell button in town phase', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="town"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      const sellButton = screen.getByText(/Sell 25g/i);
      expect(sellButton).toBeInTheDocument();
    });

    it('calls sendCommand with TOWN_ACTION sell in town phase', () => {
      const sendCommand = vi.fn();
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="town"
          onClose={vi.fn()}
          sendCommand={sendCommand}
        />
      );

      const sellButton = screen.getByText(/Sell 25g/i);
      fireEvent.click(sellButton);

      expect(sendCommand).toHaveBeenCalledWith({
        type: 'TOWN_ACTION',
        action: 'shop_sell',
        targetId: 'w1',
      });
    });
  });

  describe('Rarity Display', () => {
    it('displays item rarity', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/common/i)).toBeInTheDocument();
    });

    it('displays value and sell price', () => {
      render(
        <ItemInspectModal
          item={mockWeapon}
          equippedInSlot={null}
          phase="dungeon"
          onClose={vi.fn()}
          sendCommand={vi.fn()}
        />
      );

      expect(screen.getByText(/Value: 50/i)).toBeInTheDocument();
      expect(screen.getByText(/Sell Price: 25/i)).toBeInTheDocument();
    });
  });
});
