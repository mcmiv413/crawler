import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCombatIndicators } from './useCombatIndicators.js';

describe('useCombatIndicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not throw when given valid inputs', () => {
    const combatLog = [
      { text: 'Player dealt 25 damage to Goblin', type: 'damage' },
    ];

    expect(() => {
      renderHook(() =>
        useCombatIndicators(
          [{ id: 'goblin', x: 5, y: 5 }],
          combatLog,
          { x: 10, y: 10 },
        ),
      );
    }).not.toThrow();
  });

  it('should handle empty combat log', () => {
    expect(() => {
      renderHook(() =>
        useCombatIndicators(
          [{ id: 'goblin', x: 5, y: 5 }],
          [],
          { x: 10, y: 10 },
        ),
      );
    }).not.toThrow();
  });

  it('should handle empty entity list', () => {
    const combatLog = [
      { text: 'Player dealt 25 damage to Goblin', type: 'damage' },
    ];

    expect(() => {
      renderHook(() =>
        useCombatIndicators(
          [],
          combatLog,
          { x: 10, y: 10 },
        ),
      );
    }).not.toThrow();
  });

  it('should handle multiple combat log entries', () => {
    const combatLog = [
      { text: 'Player dealt 25 damage to Goblin', type: 'damage' },
      { text: 'Goblin dealt 8 damage to Player', type: 'damage' },
      { text: 'Player was Poisoned!', type: 'status' },
      { text: 'Healing potion used: healed for 30', type: 'item' },
    ];

    expect(() => {
      renderHook(() =>
        useCombatIndicators(
          [{ id: 'goblin', x: 5, y: 5 }],
          combatLog,
          { x: 10, y: 10 },
        ),
      );
    }).not.toThrow();
  });

  it('should handle rerender with updated combat log', () => {
    const initialLog = [
      { text: 'Player dealt 25 damage to Goblin', type: 'damage' },
    ];

    const { rerender } = renderHook(
      ({ log }) =>
        useCombatIndicators(
          [{ id: 'goblin', x: 5, y: 5 }],
          log,
          { x: 10, y: 10 },
        ),
      { initialProps: { log: initialLog } },
    );

    // Re-render with same log - should not throw
    expect(() => {
      rerender({ log: initialLog });
    }).not.toThrow();

    // Add new log entry
    const updatedLog = [
      ...initialLog,
      { text: 'Goblin dealt 8 damage to Player', type: 'damage' },
    ];

    // Re-render with updated log - should not throw
    expect(() => {
      rerender({ log: updatedLog });
    }).not.toThrow();
  });

  it('should handle rerender with updated entities', () => {
    const combatLog = [
      { text: 'Player dealt 25 damage to Goblin', type: 'damage' },
    ];

    const initialEntities = [{ id: 'goblin1', x: 5, y: 5 }];

    const { rerender } = renderHook(
      ({ entities }) =>
        useCombatIndicators(
          entities,
          combatLog,
          { x: 10, y: 10 },
        ),
      { initialProps: { entities: initialEntities } },
    );

    // Update entities
    const newEntities = [{ id: 'goblin2', x: 6, y: 6 }];

    // Re-render with updated entities - should not throw
    expect(() => {
      rerender({ entities: newEntities });
    }).not.toThrow();
  });

  it('should handle rerender with updated player position', () => {
    const combatLog = [
      { text: 'Goblin dealt 8 damage to Player', type: 'damage' },
    ];

    const { rerender } = renderHook(
      ({ playerPos }) =>
        useCombatIndicators(
          [{ id: 'goblin', x: 5, y: 5 }],
          combatLog,
          playerPos,
        ),
      { initialProps: { playerPos: { x: 10, y: 10 } } },
    );

    // Update player position
    expect(() => {
      rerender({ playerPos: { x: 15, y: 15 } });
    }).not.toThrow();
  });

  it('should handle unrecognized combat log entries gracefully', () => {
    const combatLog = [
      { text: 'Some random event that does not match any pattern', type: 'other' },
    ];

    expect(() => {
      renderHook(() =>
        useCombatIndicators(
          [{ id: 'goblin', x: 5, y: 5 }],
          combatLog,
          { x: 10, y: 10 },
        ),
      );
    }).not.toThrow();
  });

  it('should handle various damage value formats', () => {
    const testCases = [
      'Player dealt 1 damage to Goblin',
      'Player dealt 10 damage to Goblin',
      'Player dealt 100 damage to Goblin',
      'Player dealt 999 damage to Goblin',
      'Enemy dealt 5 damage to Player',
      'Boss dealt 50 damage to Player',
    ];

    for (const text of testCases) {
      const combatLog = [{ text, type: 'damage' }];

      expect(() => {
        renderHook(() =>
          useCombatIndicators(
            [{ id: 'goblin', x: 5, y: 5 }],
            combatLog,
            { x: 10, y: 10 },
          ),
        );
      }).not.toThrow();
    }
  });

  it('should handle various status effect types', () => {
    const statuses = [
      'Player was Stunned!',
      'Player was Slowed!',
      'Player was Regenerating!',
      'Player was Weakened!',
      'Player was Bleeding!',
      'Player was Protected!',
      'Enemy was Poisoned!',
    ];

    for (const text of statuses) {
      const combatLog = [{ text, type: 'status' }];

      expect(() => {
        renderHook(() =>
          useCombatIndicators(
            [{ id: 'goblin', x: 5, y: 5 }],
            combatLog,
            { x: 10, y: 10 },
          ),
        );
      }).not.toThrow();
    }
  });

  it('should handle heal patterns', () => {
    const healPatterns = [
      'Healing potion used: healed for 10',
      'Healing potion used: healed for 50',
      'Spell cast: healed for 20',
      'Item used: healed for 30',
    ];

    for (const text of healPatterns) {
      const combatLog = [{ text, type: 'item' }];

      expect(() => {
        renderHook(() =>
          useCombatIndicators(
            [{ id: 'goblin', x: 5, y: 5 }],
            combatLog,
            { x: 10, y: 10 },
          ),
        );
      }).not.toThrow();
    }
  });
});
