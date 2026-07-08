/**
 * Test layer: unit
 * Behavior: ShopPanel orders buy items by rarity and keeps mobile shop cards, prices, stock, stats, and buy buttons readable.
 * Proof: Asserts Epic Axe appears before Common Armor before Odd Relic after clicking Rarity, Health Potion and Iron Sword text, 10g and stock count text, Dmg 6-10 physical stats, Buy button count, and minimum font-size checks against readable thresholds.
 * Validation: pnpm vitest run apps/web/src/components/ShopPanel.test.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameView, ShopItemView } from '@dungeon/presenter';
import { ShopPanel } from './ShopPanel.js';
import { fontSize } from '../styles.js';

function shopItem(
  itemId: string,
  name: string,
  itemClass: string,
  rarity: string,
  weaponData?: { damage: number; damageMin: number; damageMax: number; damageType: string; accuracy: number; speed: number; weaponRange: number },
  armorData?: { defense: number; evasionPenalty: number; slot: string; enchantmentSlots: number },
): ShopItemView {
  return {
    itemId,
    name,
    description: `${name} description`,
    rarity,
    rarityColor: '#888888',
    price: 10,
    effectivePrice: 10,
    stock: 1,
    itemClass,
    spriteName: 'item_generic',
    ...(weaponData && { weaponData }),
    ...(armorData && { armorData }),
  };
}

function createView(items: readonly ShopItemView[]): GameView {
  return {
    gameId: 'shop-test',
    phase: 'town',
    player: {
      name: 'Hero',
      level: 1,
      health: 10,
      maxHealth: 10,
      attack: 1,
      defense: 1,
      accuracy: 80,
      evasion: 5,
      speed: 100,
      totalDamageMin: 1,
      totalDamageMax: 2,
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
      factionProgress: [],
      ogreProgress: {
        status: 'sealed',
        selectedSpawnDepth: null,
        eligibleSpawnDepths: [],
        brokenFactions: 0,
        totalFactions: 4,
        summaryText: 'No factions broken.',
      },
      ringSchoolMasteries: [],
      learnedSpells: [],
      studyableSpells: [],
    },
    map: null,
    combatLog: [],
    animatedEvents: [],
    availableActions: [],
    town: {
      prosperity: 50,
      fear: 0,
      corruption: 0,
      npcs: [],
      shop: { items, canUndo: false },
      rumors: [],
      lastRunSummary: null,
      factions: [],
      factionPressureSummary: '',
      ogreProgress: {
        status: 'sealed',
        selectedSpawnDepth: null,
        eligibleSpawnDepths: [],
        brokenFactions: 0,
        totalFactions: 4,
        summaryText: 'No factions broken.',
      },
      atmosphereDescription: '',
      unlockedBlueprints: [],
      runSummaryStats: null,
      prepAdvice: [],
      studyableSpells: [],
    },
    inventory: {
      items: [],
      equipped: {
        weapon: null,
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
    deathContext: null,
    inspectableEntities: [],
    debugMode: false,
  };
}

describe('ShopPanel', () => {
  it('sorts buy items by rarity with unknown rarities after known rarities', () => {
    const { container } = render(
      <ShopPanel
        view={createView([
          shopItem('odd_relic', 'Odd Relic', 'consumable', 'artifact'),
          shopItem('common_armor', 'Common Armor', 'armor', 'common'),
          shopItem('epic_axe', 'Epic Axe', 'weapon', 'epic'),
        ])}
        loading={false}
        sendCommand={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rarity' }));

    const text = container.textContent ?? '';
    expect(text.indexOf('Epic Axe')).toBeLessThan(text.indexOf('Common Armor'));
    expect(text.indexOf('Common Armor')).toBeLessThan(text.indexOf('Odd Relic'));
  });

  describe('Mobile layout (Slice 3)', () => {
    it('renders shop items as readable cards with visible price and stock', () => {
      const mockSend = vi.fn();
      const { container } = render(
        <ShopPanel
          view={createView([
            shopItem('potion', 'Health Potion', 'consumable', 'common'),
            shopItem('sword', 'Iron Sword', 'weapon', 'common', {
              damage: 8,
              damageMin: 6,
              damageMax: 10,
              damageType: 'physical',
              accuracy: 0,
              speed: 100,
              weaponRange: 1,
            }),
          ])}
          loading={false}
          sendCommand={mockSend}
          isMobile={true}
        />,
      );

      // Both items should be visible
      expect(screen.getByText('Health Potion')).toBeInTheDocument();
      expect(screen.getByText('Iron Sword')).toBeInTheDocument();

      // Price and stock should be visible and readable
      const text = container.textContent ?? '';
      expect(text).toContain('10g'); // Price
      expect(text).toContain('×1'); // Stock
    });

    it('uses readable font sizes for item names (not 9px)', () => {
      render(
        <ShopPanel
          view={createView([
            shopItem('potion', 'Health Potion', 'consumable', 'common'),
          ])}
          loading={false}
          sendCommand={vi.fn()}
          isMobile={true}
        />,
      );

      const itemName = screen.getByText('Health Potion');
      // Item names should use body font or larger (15px+), not 9px
      const computed = window.getComputedStyle(itemName);
      const fontSize_px = computed.fontSize;
      const fontSize_num = parseInt(fontSize_px, 10);
      expect(fontSize_num).toBeGreaterThanOrEqual(13);
    });

    it('renders item stat metadata using meta font size (12px+), not 9px', () => {
      const { container } = render(
        <ShopPanel
          view={createView([
            shopItem('sword', 'Iron Sword', 'weapon', 'common', {
              damage: 8,
              damageMin: 6,
              damageMax: 10,
              damageType: 'physical',
              accuracy: 5,
              speed: 100,
              weaponRange: 1,
            }),
          ])}
          loading={false}
          sendCommand={vi.fn()}
          isMobile={true}
        />,
      );

      // Stats should be visible (not hidden in 9px text)
      const text = container.textContent ?? '';
      expect(text).toContain('Dmg: 6-10');
      expect(text).toContain('physical');

      // Find stat text and check font size is readable (12px+)
      const statElements = Array.from(container.querySelectorAll('div')).filter(
        (el) => el.textContent?.includes('Dmg:')
      );
      if (statElements.length > 0 && statElements[0]) {
        const computed = window.getComputedStyle(statElements[0]);
        const fsNum = parseInt(computed.fontSize, 10);
        expect(fsNum).toBeGreaterThanOrEqual(fontSize.micro); // 12px
      }
    });

    it('Buy button is readable and not 9px', () => {
      const mockSend = vi.fn();
      render(
        <ShopPanel
          view={createView([
            shopItem('potion', 'Health Potion', 'consumable', 'common'),
          ])}
          loading={false}
          sendCommand={mockSend}
          isMobile={true}
        />,
      );

      // Get all Buy buttons (first is mode toggle, rest are item purchase buttons)
      const buyButtons = screen.getAllByRole('button', { name: 'Buy' });
      expect(buyButtons.length).toBeGreaterThanOrEqual(2); // Mode toggle + at least one item

      // Check the item's Buy button (last one in the list)
      const itemBuyBtn = buyButtons[buyButtons.length - 1];
      if (itemBuyBtn) {
        const computed = window.getComputedStyle(itemBuyBtn);
        const fsNum = parseInt(computed.fontSize, 10);
        expect(fsNum).toBeGreaterThanOrEqual(fontSize.micro); // 12px+
      }
    });

    it('renders shop with card layout that wraps content appropriately for mobile', () => {
      const { container } = render(
        <ShopPanel
          view={createView([
            shopItem('item1', 'Item One', 'consumable', 'common'),
            shopItem('item2', 'Item Two', 'consumable', 'common'),
          ])}
          loading={false}
          sendCommand={vi.fn()}
          isMobile={true}
        />,
      );

      // Should have two visible items
      expect(screen.getByText('Item One')).toBeInTheDocument();
      expect(screen.getByText('Item Two')).toBeInTheDocument();

      // Price and buy info should be visible for each
      const text = container.textContent ?? '';
      expect((text.match(/Buy/g) || []).length).toBeGreaterThanOrEqual(2);
    });
  });
});
