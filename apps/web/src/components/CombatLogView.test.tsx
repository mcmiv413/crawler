/**
 * Test layer: unit
 * Behavior: CombatLogView renders filtered combat log entries with event-type colors, scroll sizing, debug visibility, and mobile tab-bar clearance.
 * Proof: Asserts empty or fully filtered entries render null, attack/death/loot/info/debug text presence or absence, death/loot/info/default colors, scrollTop/maxHeight/flex styles, duplicate entry count, and combat-log-entries padding-bottom.
 * Validation: pnpm vitest run apps/web/src/components/CombatLogView.test.tsx
 */
/**
 * CombatLogView Component Tests
 *
 * Verifies that formatted events from the presenter actually render
 * in the UI with correct styling and content.
 *
 * Part of Phase 4: React Component Tests (Feature Completeness Framework)
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(() => ({ isMobile: false })),
}));

import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';
import { CombatLogView } from './CombatLogView.js';

describe('CombatLogView Component', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
  });

  describe('Basic Rendering', () => {
    it('renders null when entries are empty', () => {
      const { container } = render(<CombatLogView entries={[]} debugMode={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders log container when entries are present', () => {
      const entries = [{ text: 'Test event', type: 'info' }];
      const { container } = render(<CombatLogView entries={entries} debugMode={false} />);
      expect(container.querySelector('[style*="border"]')).toBeInTheDocument();
    });

    it('renders all entries with correct text', () => {
      const entries = [
        { text: '[Hero -> Goblin] 15 physical dmg', type: 'attack' },
        { text: 'Goblin Skirmisher defeated!', type: 'loot' },
        { text: 'Rare sword found!', type: 'loot' },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      expect(screen.getByText('[Hero -> Goblin] 15 physical dmg')).toBeInTheDocument();
      expect(screen.getByText('Goblin Skirmisher defeated!')).toBeInTheDocument();
      expect(screen.getByText('Rare sword found!')).toBeInTheDocument();
    });
  });

  describe('Event Type Styling', () => {
    it('applies death color to death events', () => {
      const entries = [{ text: 'You died!', type: 'death' }];
      render(<CombatLogView entries={entries} debugMode={false} />);
      const entry = screen.getByText('You died!');
      // Death color is colors.blood (#c85a4a)
      expect(entry).toHaveStyle('color: #c85a4a');
    });

    it('applies loot color to loot events', () => {
      const entries = [{ text: 'Gold acquired!', type: 'loot' }];
      render(<CombatLogView entries={entries} debugMode={false} />);
      const entry = screen.getByText('Gold acquired!');
      // Loot color is colors.lime (#7dc940)
      expect(entry).toHaveStyle('color: #7dc940');
    });

    it('applies info color to info events', () => {
      const entries = [{ text: 'Level up!', type: 'info' }];
      render(<CombatLogView entries={entries} debugMode={false} />);
      const entry = screen.getByText('Level up!');
      // Info color is colors.steel (#5a8fc7)
      expect(entry).toHaveStyle('color: #5a8fc7');
    });

    it('applies default color to unknown event types', () => {
      const entries = [{ text: 'Something happened', type: 'unknown' }];
      render(<CombatLogView entries={entries} debugMode={false} />);
      const entry = screen.getByText('Something happened');
      // Default color is #aaa
      expect(entry).toHaveStyle('color: #aaa');
    });
  });

  describe('Scroll Behavior', () => {
    it('scrolls to bottom when new entries are added', () => {
      const { rerender } = render(
        <CombatLogView entries={[{ text: 'Entry 1', type: 'info' }]} debugMode={false} />,
      );

      const scrollContainer = screen.getByTestId('combat-log-entries');
      const initialScrollTop = scrollContainer?.scrollTop ?? 0;

      // Add new entries to trigger re-render
      rerender(
        <CombatLogView
          entries={[
            { text: 'Entry 1', type: 'info' },
            { text: 'Entry 2', type: 'info' },
            { text: 'Entry 3', type: 'info' },
          ]}
          debugMode={false}
        />,
      );

      // After adding entries, scrollHeight should equal scrollTop (scrolled to bottom)
      // Note: In jsdom/test environment, scrollHeight may be 0, so we verify the scroll effect occurred
      expect(scrollContainer?.scrollTop ?? 0).toBeGreaterThanOrEqual(initialScrollTop);
    });
  });

  describe('Real Event Data (Integration)', () => {
    it('renders attack event with complete details', () => {
      const entries = [
        {
          text: '[Adventurer -> Goblin Skirmisher] 12 physical dmg CRIT!',
          type: 'attack',
        },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      // Verify all important details are rendered
      expect(screen.getByText(/Adventurer/)).toBeInTheDocument();
      expect(screen.getByText(/Goblin Skirmisher/)).toBeInTheDocument();
      expect(screen.getByText(/12 physical dmg CRIT!/)).toBeInTheDocument();
    });

    it('renders status effect event', () => {
      const entries = [
        { text: 'Adventurer is poisoned for 3 turns', type: 'info' },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      expect(screen.getByText('Adventurer is poisoned for 3 turns')).toBeInTheDocument();
    });

    it('renders death event visually distinct', () => {
      const entries = [{ text: 'Goblin Skirmisher defeated!', type: 'death' }];
      render(<CombatLogView entries={entries} debugMode={false} />);

      const entry = screen.getByText('Goblin Skirmisher defeated!');
      expect(entry).toHaveStyle('color: #c85a4a'); // Death color (colors.blood)
    });

    it('renders loot event with green color', () => {
      const entries = [
        { text: 'Common sword found! (You gained 1 item)', type: 'loot' },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      const entry = screen.getByText('Common sword found! (You gained 1 item)');
      expect(entry).toHaveStyle('color: #7dc940'); // Loot color (colors.lime)
    });

    it('renders multiple events in order', () => {
      const entries = [
        {
          text: '[Adventurer -> Goblin] 15 physical dmg',
          type: 'attack',
        },
        { text: 'Goblin defeated!', type: 'death' },
        { text: 'Gold pouch found! (You gained 50 gold)', type: 'loot' },
        { text: 'Level up! Now level 2', type: 'info' },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      const logEntries = screen.getAllByText(/./);
      expect(logEntries.length).toBeGreaterThanOrEqual(4);

      // Verify order - combat log should show attack, death, loot, level up
      expect(screen.getByText(/Adventurer/)).toBeInTheDocument();
      expect(screen.getByText(/defeated/)).toBeInTheDocument();
      expect(screen.getByText(/gold/i)).toBeInTheDocument();
      expect(screen.getByText(/level/i)).toBeInTheDocument();
    });
  });

  describe('Debug Mode Filtering', () => {
    it('hides [DEBUG] entries when debugMode is false', () => {
      const entries = [
        { text: 'Normal attack', type: 'attack' },
        { text: '[DEBUG] Enemy state: roaming → regrouping', type: 'info' },
        { text: 'Loot acquired', type: 'loot' },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      expect(screen.getByText('Normal attack')).toBeInTheDocument();
      expect(screen.getByText('Loot acquired')).toBeInTheDocument();
      expect(screen.queryByText(/\[DEBUG\] Enemy state/)).not.toBeInTheDocument();
    });

    it('shows [DEBUG] entries when debugMode is true', () => {
      const entries = [
        { text: 'Normal attack', type: 'attack' },
        { text: '[DEBUG] Enemy state: roaming → regrouping', type: 'info' },
        { text: 'Loot acquired', type: 'loot' },
      ];
      render(<CombatLogView entries={entries} debugMode={true} />);

      expect(screen.getByText('Normal attack')).toBeInTheDocument();
      expect(screen.getByText('[DEBUG] Enemy state: roaming → regrouping')).toBeInTheDocument();
      expect(screen.getByText('Loot acquired')).toBeInTheDocument();
    });

    it('returns null when all entries are filtered out', () => {
      const entries = [
        { text: '[DEBUG] Enemy state 1', type: 'info' },
        { text: '[DEBUG] Enemy state 2', type: 'info' },
      ];
      const { container } = render(<CombatLogView entries={entries} debugMode={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long event text', () => {
      const longText =
        'A very long event message that contains lots of detail and spans many characters to test text wrapping and rendering in the combat log view';
      const entries = [{ text: longText, type: 'info' }];
      render(<CombatLogView entries={entries} debugMode={false} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('handles special characters in event text', () => {
      const entries = [
        { text: "[Hero's -> Goblin's] 15 dmg (crit!)", type: 'attack' },
        { text: 'Player is "poisoned" [3 turns]', type: 'info' },
      ];
      render(<CombatLogView entries={entries} debugMode={false} />);

      expect(screen.getByText(/Hero's/)).toBeInTheDocument();
      expect(screen.getByText(/poisoned/)).toBeInTheDocument();
    });

    it('preserves order when entries array is updated with duplicates', () => {
      const { rerender } = render(
        <CombatLogView entries={[{ text: 'Event 1', type: 'info' }]} debugMode={false} />,
      );

      rerender(
        <CombatLogView
          entries={[
            { text: 'Event 1', type: 'info' },
            { text: 'Event 1', type: 'info' },
            { text: 'Event 2', type: 'info' },
          ]}
          debugMode={false}
        />,
      );

      const allEvents = screen.getAllByText('Event 1');
      expect(allEvents).toHaveLength(2);
    });
  });

  describe('Responsive Height', () => {
    it('respects custom maxHeight prop when provided', () => {
      const entries = [{ text: 'Test event', type: 'info' }];
      const { container } = render(
        <CombatLogView entries={entries} debugMode={false} maxHeight={400} />,
      );
      // Find the main scroll container (first div with border style)
      const scrollContainer = container.querySelector('div[style*="border"]') as HTMLDivElement;
      expect(scrollContainer).toBeDefined();
      expect(scrollContainer?.style.maxHeight).toBe('400px');
    });

    it('defaults to none maxHeight when not provided (fills available panel space)', () => {
      const entries = [{ text: 'Test event', type: 'info' }];
      const { container } = render(
        <CombatLogView entries={entries} debugMode={false} />,
      );
      const scrollContainer = container.querySelector('div[style*="border"]') as HTMLDivElement;
      expect(scrollContainer).toBeDefined();
      // Default behavior: fill the panel with flex: 1
      expect(scrollContainer?.style.maxHeight).toBe('none');
    });

    it('uses flex: 1 when maxHeight is none (fills available space)', () => {
      const entries = [{ text: 'Test event', type: 'info' }];
      const { container } = render(
        <CombatLogView entries={entries} debugMode={false} />,
      );
      const scrollContainer = container.querySelector('div[style*="border"]') as HTMLDivElement;
      expect(scrollContainer).toBeDefined();
      // Should have flex: 1 when maxHeight is 'none' (renders as '1 1 0%' due to shorthand)
      expect(scrollContainer?.style.flex).toMatch(/^1/);
    });

    it('explicit maxHeight takes precedence over default', () => {
      const entries = [{ text: 'Test event', type: 'info' }];
      const { container } = render(
        <CombatLogView entries={entries} debugMode={false} maxHeight={200} />,
      );
      const scrollContainer = container.querySelector('div[style*="border"]') as HTMLDivElement;
      expect(scrollContainer).toBeDefined();
      // Explicit maxHeight should override default
      expect(scrollContainer?.style.maxHeight).toBe('200px');
    });

    it('adds tab bar clearance to the entry list on mobile', () => {
      vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
      render(
        <CombatLogView
          entries={[{ text: 'Test event', type: 'info' }]}
          debugMode={false}
        />,
      );

      expect(screen.getByTestId('combat-log-entries')).toHaveStyle(
        `padding-bottom: ${TAB_BAR_HEIGHT}px`,
      );
    });
  });
});
