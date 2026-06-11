import { describe, it, expect } from 'vitest';
import {
  SIDE_PANEL_WIDTH,
  SIDEBAR_CENTER_WIDTH,
  ACTIONS_COLUMN_MIN_WIDTH,
  CELL_SIZE,
  VP_WIDTH,
  VP_HEIGHT,
  VIEWPORT_PX_WIDTH,
  VIEWPORT_PX_HEIGHT,
  TAB_BAR_HEIGHT,
  MOBILE_BREAKPOINT,
  COMBAT_LOG_MAX_HEIGHT,
  QUEST_TRACKER_MAX_HEIGHT,
  CONSUMABLES_BAR_MAX_HEIGHT,
  BTN_MIN_HEIGHT,
  NAV_BTN_MIN_HEIGHT,
} from './config/ui-config.js';

/**
 * Governance test: UI sizing constants are properly exported and accessible.
 * Assertions validate existence, type, and structural invariants — not tuned values.
 * If a constant is retuned, these tests should still pass.
 */

describe('Config Governance: UI Sizing', () => {
  it('all UI sizing constants are defined and positive numbers', () => {
    // Panel widths
    expect(SIDE_PANEL_WIDTH).toBeGreaterThan(0);
    expect(SIDEBAR_CENTER_WIDTH).toBeGreaterThan(0);
    expect(ACTIONS_COLUMN_MIN_WIDTH).toBeGreaterThan(0);

    // Viewport tile counts and cell size
    expect(CELL_SIZE).toBeGreaterThan(0);
    expect(VP_WIDTH).toBeGreaterThan(0);
    expect(VP_HEIGHT).toBeGreaterThan(0);

    // Navigation and responsive
    expect(TAB_BAR_HEIGHT).toBeGreaterThan(0);
    expect(MOBILE_BREAKPOINT).toBeGreaterThan(0);

    // Heights and touch targets
    expect(COMBAT_LOG_MAX_HEIGHT).toBeGreaterThan(0);
    expect(QUEST_TRACKER_MAX_HEIGHT).toBeGreaterThan(0);
    expect(CONSUMABLES_BAR_MAX_HEIGHT).toBeGreaterThan(0);
    expect(BTN_MIN_HEIGHT).toBeGreaterThan(0);
    expect(NAV_BTN_MIN_HEIGHT).toBeGreaterThan(0);
  });

  it('computed viewport pixel dimensions equal tiles × cell size', () => {
    // These are derived values — the invariant is the formula, not the pixel total.
    expect(VIEWPORT_PX_WIDTH).toBe(VP_WIDTH * CELL_SIZE);
    expect(VIEWPORT_PX_HEIGHT).toBe(VP_HEIGHT * CELL_SIZE);
  });

  it('nav button touch target meets or exceeds standard button height', () => {
    // NAV_BTN_MIN_HEIGHT should be at least as large as BTN_MIN_HEIGHT.
    expect(NAV_BTN_MIN_HEIGHT).toBeGreaterThanOrEqual(BTN_MIN_HEIGHT);
  });
});
