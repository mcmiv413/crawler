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
  DPAD_BTN_SIZE,
} from './config/ui-config.js';

/**
 * Governance test: UI sizing constants are properly exported and accessible
 * This ensures the centralization hub is complete and working.
 */

describe('Config Governance: UI Sizing', () => {
  it('all UI sizing constants are defined and accessible', () => {
    // Panel widths
    expect(SIDE_PANEL_WIDTH).toBe(320);
    expect(SIDEBAR_CENTER_WIDTH).toBe(380);
    expect(ACTIONS_COLUMN_MIN_WIDTH).toBe(250);

    // Viewport and tiles
    expect(CELL_SIZE).toBe(24);
    expect(VP_WIDTH).toBe(30);
    expect(VP_HEIGHT).toBe(22);
    expect(VIEWPORT_PX_WIDTH).toBe(VP_WIDTH * CELL_SIZE);
    expect(VIEWPORT_PX_HEIGHT).toBe(VP_HEIGHT * CELL_SIZE);

    // Navigation and responsive
    expect(TAB_BAR_HEIGHT).toBe(56);
    expect(MOBILE_BREAKPOINT).toBe(768);

    // Heights and touch targets
    expect(COMBAT_LOG_MAX_HEIGHT).toBe(250);
    expect(QUEST_TRACKER_MAX_HEIGHT).toBe(200);
    expect(CONSUMABLES_BAR_MAX_HEIGHT).toBe(160);
    expect(BTN_MIN_HEIGHT).toBe(44);
    expect(NAV_BTN_MIN_HEIGHT).toBe(48);
    expect(DPAD_BTN_SIZE).toBe(48);
  });

  it('computed viewport pixel dimensions match formula', () => {
    expect(VIEWPORT_PX_WIDTH).toBe(720);
    expect(VIEWPORT_PX_HEIGHT).toBe(528);
  });
});
