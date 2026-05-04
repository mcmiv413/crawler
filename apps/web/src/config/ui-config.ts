/** UI sizing constants — centralized configuration for all pixel values */

// ── Tile & Canvas ───────────────────────────────────────────────
/** Pixel size of each dungeon tile. Changing this scales the entire dungeon renderer. */
export const CELL_SIZE = 24

/** Dungeon viewport width in tiles. Increase for a wider visible area. */
export const VP_WIDTH = 30;

/** Dungeon viewport height in tiles. Increase for a taller visible area. */
export const VP_HEIGHT = 22;

/** Computed pixel width of the dungeon canvas. */
export const VIEWPORT_PX_WIDTH = VP_WIDTH * CELL_SIZE;  // 780

/** Computed pixel height of the dungeon canvas. */
export const VIEWPORT_PX_HEIGHT = VP_HEIGHT * CELL_SIZE; // 572

// ── Map Zoom ────────────────────────────────────────────────────
/** Maximum zoom level for the dungeon map on desktop. */
export const MAP_SCALE_MAX = 2.0;

/** Minimum zoom level for the dungeon map on desktop. */
export const MAP_SCALE_MIN = 0.5;

/** Padding (px) subtracted from window width when computing mobile map scale. */
export const MAP_MOBILE_PADDING = 16;

// ── Responsive ──────────────────────────────────────────────────
/** Screen width (px) below which mobile layout activates. Alias of BREAKPOINT_MD. */
export const MOBILE_BREAKPOINT = 768;

/** Android minimum supported width (px); also "very small" CSS override threshold. */
export const BREAKPOINT_XS = 360;

/** iOS minimum supported width (px) — iPhone 6/7/8, SE 2/3, mini. */
export const BREAKPOINT_SM = 375;

/** Mobile/desktop layout boundary (px). Alias of MOBILE_BREAKPOINT. */
export const BREAKPOINT_MD = 768;

/** Desktop layout width threshold (px). */
export const BREAKPOINT_LG = 1024;

/** MobileNav icon+label vs icon-only threshold (px). */
export const BREAKPOINT_NAV_LABEL = 450;

// ── Navigation ──────────────────────────────────────────────────
/** Height (px) of the mobile bottom tab bar. Used to offset content above it. */
export const TAB_BAR_HEIGHT = 56;

// ── Panels & Modals ─────────────────────────────────────────────
/** Width (px) of the main content column in sidebar layouts (dungeon, town). */
export const SIDEBAR_CENTER_WIDTH = 380;

/** Width (px) of side panels: inventory, character sheet, combat log. */
export const SIDE_PANEL_WIDTH = 320;

/** Minimum width (px) of the desktop actions/abilities column. */
export const ACTIONS_COLUMN_MIN_WIDTH = 250;

/** Max-width (px) of full-screen modal cards (quest, notice, game over). */
export const MODAL_CARD_MAX_WIDTH = 500;

/** Max-height (vh) of the item inspect overlay modal. */
export const ITEM_MODAL_MAX_HEIGHT = '80vh';

// ── Combat Log ──────────────────────────────────────────────────
/** Maximum height (px) of the expanded combat log panel. */
export const COMBAT_LOG_MAX_HEIGHT = 250;

/** Number of combat log entries shown in the dungeon mini-log. */
export const COMBAT_LOG_MINI_ENTRIES = 4;

/** Font size (px) for mini combat log entries on dungeon screen. */
export const COMBAT_LOG_MINI_FONT_SIZE = 13;

/** Line height (multiplier) for mini combat log entries on dungeon screen. */
export const COMBAT_LOG_MINI_LINE_HEIGHT = 1.3;

/** Duration (ms) a combat indicator floats and is visible before fading out. */
export const COMBAT_INDICATOR_FADEOUT_MS = 1500;

/** Duration (ms) of bump attack animation (attacker lunges toward target). */
export const BUMP_ANIMATION_DURATION_MS = 300;

// ── Movement Animation Durations ────────────────────────────────
// Each style has its own duration so heavier/slower styles feel distinct.
// The canvas renderer reads durationMs from the MoveAnimationEntry itself;
// these constants are the source of truth used in animation-sequence.ts.

/** Step animation — player only. Snappy, responsive. */
export const MOVE_ANIM_DURATION_STEP  = 140;

/** Slide animation — default enemy. Neutral glide. */
export const MOVE_ANIM_DURATION_SLIDE = 180;

/** Dart animation — wall_stalker. Explosive, fast. */
export const MOVE_ANIM_DURATION_DART  = 150;

/** Drift animation — rearline_anchor. Slow, deliberate. */
export const MOVE_ANIM_DURATION_DRIFT = 240;

/** Stomp animation — chokepoint_holder. Heavy, overshoots. */
export const MOVE_ANIM_DURATION_STOMP = 200;

/** Lurch animation — ambush_idle. Frozen then sudden. */
export const MOVE_ANIM_DURATION_LURCH = 220;

/** Stagger between successive entity move animations (ms). */
export const MOVE_ANIM_STAGGER_MS = 120;

// ── Buttons & Touch Targets ─────────────────────────────────────
/** Minimum height (px) of standard buttons — meets WCAG touch target guidelines. */
export const BTN_MIN_HEIGHT = 44;

/** Minimum height (px) of navigation buttons — slightly larger touch target. */
export const NAV_BTN_MIN_HEIGHT = 48;

/** Size (px) of each DPad directional button. */
export const DPAD_BTN_SIZE = 48;

// ── HUD ─────────────────────────────────────────────────────────
/** Height (px) of HP / XP stat bars. */
export const STAT_BAR_HEIGHT = 8;

/** Font size (px) for stat bar value labels (e.g. "42 / 80"). */
export const HUD_VALUE_FONT_SIZE = 14;

// ── Scrollable Areas ────────────────────────────────────────────
/** Max height (px) of the consumables bar scroll container. */
export const CONSUMABLES_BAR_MAX_HEIGHT = 160;

/** Max height (px) of the quest tracker scroll container. */
export const QUEST_TRACKER_MAX_HEIGHT = 200;

// ── Town Layout ─────────────────────────────────────────────────
/** Top section height (px) with player HUD and main action buttons in town. */
export const TOWN_TOP_SECTION_HEIGHT = 120;

/** NPC cards section height — defaults to content size, scrolls if constrained. */
export const TOWN_NPC_SECTION_MIN_HEIGHT = 100;

/** Messages/dialogue section — scrolls internally when content exceeds viewport. */
export const TOWN_MESSAGES_SECTION_MIN_HEIGHT = 200;

// ── Z-Index Layers ──────────────────────────────────────────────
// All modals, overlays, and floating UI use these constants so stacking order
// is coherent and no one invents their own z-index (bug prevention).
/** Mobile tab bar z-index — above main content but below modals. */
export const Z_TAB_BAR = 100;

/** Modal backdrop layer — behind modal cards, above app chrome. */
export const Z_MODAL_BACKDROP = 900;
/** Standard modal card / full-screen overlay layer. */
export const Z_MODAL = 1000;
/** Inspect-style modals that must float above other modals (item inspect over shop). */
export const Z_INSPECT = 1100;
