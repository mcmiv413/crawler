import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameView, ShopItemView } from '@dungeon/presenter';
import { ShopPanel } from './ShopPanel.js';

function shopItem(
  itemId: string,
  name: string,
  itemClass: string,
  rarity: string,
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
});
