/**
 * Test layer: unit
 * Behavior: EquipmentDoll renders all equipment slots, empty placeholders, equipped item labels, rarity colors, and click callbacks for occupied slots.
 * Proof: Asserts eight slot labels, two-column grid styles, eight empty markers, no callback for empty clicks, equipped weapon/armor/ring names, common/epic/legendary color styles, and onSlotClick called with mockWeapon.
 * Validation: pnpm vitest run apps/web/src/components/EquipmentDoll.test.tsx
 */
/**
 * EquipmentDoll Component Tests
 *
 * Verifies that the equipment slot grid correctly displays
 * equipped and empty slots, and fires callbacks on click.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EquipmentDoll } from './EquipmentDoll.js';
import type { InventoryItemView } from '@dungeon/presenter';

// Local rarity color fixtures — mirrors the live values but avoids importing live config.
// If these colors change in content, update here too (or move the assertion to a contract test).
const RARITY_COLORS = {
  common: '#a0a0a0',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#ff00ff',
  legendary: '#ffaa00',
} as const;

// Fixture: empty equipment slots
const emptyEquipped = {
  weapon: null,
  secondaryWeapon: null,
  chest: null,
  head: null,
  gloves: null,
  boots: null,
  ring1: null,
  ring2: null,
};

// Fixture: sample equipped items
const mockWeapon: InventoryItemView = {
  id: 'w1',
  name: 'Iron Sword',
  description: 'A solid iron sword',
  itemClass: 'weapon',
  rarity: 'common',
  rarityColor: RARITY_COLORS.common,
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
    damageType: 'physical',
    accuracy: 85,
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
  rarityColor: RARITY_COLORS.uncommon,
  value: 80,
  sellPrice: 40,
  isEquipped: true,
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

describe('EquipmentDoll Component', () => {
  describe('Slot Labels and Structure', () => {
    it('renders all 8 equipment slots', () => {
      const onSlotClick = vi.fn();
      render(<EquipmentDoll equipped={emptyEquipped} onSlotClick={onSlotClick} />);

      expect(screen.getByText(/Main Hand/i)).toBeInTheDocument();
      expect(screen.getByText(/Off Hand/i)).toBeInTheDocument();
      expect(screen.getByText(/Chest/i)).toBeInTheDocument();
      expect(screen.getByText(/Head/i)).toBeInTheDocument();
      expect(screen.getByText(/Gloves/i)).toBeInTheDocument();
      expect(screen.getByText(/Boots/i)).toBeInTheDocument();
      expect(screen.getByText(/Ring 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Ring 2/i)).toBeInTheDocument();
    });

    it('renders 2-column grid layout', () => {
      const { container } = render(
        <EquipmentDoll equipped={emptyEquipped} onSlotClick={vi.fn()} />
      );
      const grid = container.querySelector('[style*="grid"]');
      expect(grid).toHaveStyle('display: grid');
      expect(grid).toHaveStyle('gridTemplateColumns: 1fr 1fr');
    });
  });

  describe('Empty Slots', () => {
    it('displays placeholder text for empty slots', () => {
      const onSlotClick = vi.fn();
      render(<EquipmentDoll equipped={emptyEquipped} onSlotClick={onSlotClick} />);

      const emptySlots = screen.getAllByText(/\[empty\]/i);
      expect(emptySlots.length).toBe(8); // All slots are empty
    });

    it('does not call onSlotClick when clicking empty slot', () => {
      const onSlotClick = vi.fn();
      render(<EquipmentDoll equipped={emptyEquipped} onSlotClick={onSlotClick} />);

      const emptySlot = screen.getAllByText(/\[empty\]/i)[0]!;
      fireEvent.click(emptySlot);

      expect(onSlotClick).not.toHaveBeenCalled();
    });
  });

  describe('Equipped Items', () => {
    it('displays equipped item name in weapon slot', () => {
      const equipped = { ...emptyEquipped, weapon: mockWeapon };
      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      expect(screen.getByText('Iron Sword')).toBeInTheDocument();
    });

    it('displays equipped item name in armor slot', () => {
      const equipped = { ...emptyEquipped, chest: mockArmor };
      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      expect(screen.getByText('Leather Chest')).toBeInTheDocument();
    });

    it('displays rarity color for equipped items', () => {
      const equipped = { ...emptyEquipped, weapon: mockWeapon };
      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      const itemText = screen.getByText('Iron Sword');
      expect(itemText).toHaveStyle('color: #a0a0a0'); // common rarity color
    });

    it('calls onSlotClick with equipped item when slot is clicked', () => {
      const onSlotClick = vi.fn();
      const equipped = { ...emptyEquipped, weapon: mockWeapon };
      render(<EquipmentDoll equipped={equipped} onSlotClick={onSlotClick} />);

      const itemButton = screen.getByText('Iron Sword');
      fireEvent.click(itemButton);

      expect(onSlotClick).toHaveBeenCalledWith(mockWeapon);
    });

    it('handles off-hand weapon in secondaryWeapon slot', () => {
      const offHandWeapon = { ...mockWeapon, id: 'w2', name: 'Dagger', isEquipped: true };
      const equipped = { ...emptyEquipped, secondaryWeapon: offHandWeapon };
      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    it('handles all armor slots', () => {
      const equippedArmor = { ...mockArmor, isEquipped: true };
      const equipped = {
        ...emptyEquipped,
        weapon: mockWeapon,
        chest: { ...equippedArmor, id: 'a1', name: 'Leather Chest', armorStats: { ...equippedArmor.armorStats, slot: 'chest' } },
        head: { ...equippedArmor, id: 'a2', name: 'Leather Cap', armorStats: { ...equippedArmor.armorStats, slot: 'head' } },
        gloves: { ...equippedArmor, id: 'a3', name: 'Leather Gloves', armorStats: { ...equippedArmor.armorStats, slot: 'gloves' } },
        boots: { ...equippedArmor, id: 'a4', name: 'Leather Boots', armorStats: { ...equippedArmor.armorStats, slot: 'boots' } },
        ring1: { ...equippedArmor, id: 'r1', name: 'Iron Ring', armorStats: undefined, weaponStats: undefined },
        ring2: { ...equippedArmor, id: 'r2', name: 'Silver Ring', armorStats: undefined, weaponStats: undefined },
      } as any;

      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      expect(screen.getByText('Iron Sword')).toBeInTheDocument();
      expect(screen.getByText('Leather Chest')).toBeInTheDocument();
      expect(screen.getByText('Leather Cap')).toBeInTheDocument();
      expect(screen.getByText('Leather Gloves')).toBeInTheDocument();
      expect(screen.getByText('Leather Boots')).toBeInTheDocument();
      expect(screen.getByText('Iron Ring')).toBeInTheDocument();
      expect(screen.getByText('Silver Ring')).toBeInTheDocument();
    });
  });

  describe('Rarity Coloring', () => {
    it('applies correct color for legendary rarity', () => {
      const legendary = { ...mockWeapon, rarity: 'legendary' as const, rarityColor: RARITY_COLORS.legendary };
      const equipped = { ...emptyEquipped, weapon: legendary };
      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      const itemText = screen.getByText('Iron Sword');
      expect(itemText).toHaveStyle('color: #ffaa00'); // legendary color
    });

    it('applies correct color for epic rarity', () => {
      const epic = { ...mockWeapon, rarity: 'epic' as const, rarityColor: RARITY_COLORS.epic };
      const equipped = { ...emptyEquipped, weapon: epic };
      render(<EquipmentDoll equipped={equipped} onSlotClick={vi.fn()} />);

      const itemText = screen.getByText('Iron Sword');
      expect(itemText).toHaveStyle('color: #ff00ff'); // epic color
    });
  });
});
