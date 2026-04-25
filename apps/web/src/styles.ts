import type React from 'react';
import { BTN_MIN_HEIGHT, NAV_BTN_MIN_HEIGHT } from './config/ui-config.js';

// ─── Font ──────────────────────────────────────────────────────────────────
export const FONT_STACK = `'IBM Plex Mono', 'Courier New', monospace`;

// ─── Color tokens ──────────────────────────────────────────────────────────
// See DESIGN.md § Colour System for rationale behind each token.
export const colors = {
  // Backgrounds (darkest → lightest)
  bg:      '#0d0d10',
  panel:   '#111318',
  inset:   '#0a0b0e',
  card:    '#181c23',
  border:  '#252830',
  border2: '#1e2228',
  // Text
  text:    '#cdd0d6',
  label:   '#7b8090',
  // Raised from #5a5e6b → #686c7a for ~4.6:1 contrast against --panel.
  // Affects section labels, slot names, metadata, placeholders.
  muted:   '#686c7a',
  // Accents — same perceptual weight, vary hue only
  lime:    '#7dc940',  // HP full, loot, primary CTA
  gold:    '#c8963c',  // economy — gold, ATK
  steel:   '#5a8fc7',  // info — XP bar, info log, ACC/EVA
  blood:   '#c85a4a',  // danger — death, Nemesis, low HP
  purple:  '#8a78c8',  // magic — XP gain, enchants, SPD
  teal:    '#4aabb0',  // utility — evasion, enchantment labels
} as const;

// ─── HP bar colour (shifts lime → orange → red) ────────────────────────────
export function hpBarColor(health: number, maxHealth: number): string {
  const pct = (health / maxHealth) * 100;
  if (pct > 60) return colors.lime;
  if (pct > 30) return '#e07030';
  return colors.blood;
}

// ─── HP bar pulse animation (injected once into <head>) ────────────────────
// Call injectHpPulse() from PlayerHud on first mount. Safe to call multiple
// times — it checks for the style tag before inserting.
export function injectHpPulse(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('hp-pulse-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'hp-pulse-keyframes';
  style.textContent = `
    @keyframes hpPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.55; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Log entry colour ──────────────────────────────────────────────────────
// Matches CombatLogView type field — add new types here as the game grows.
export function logEntryColor(type: string): string {
  switch (type) {
    case 'death':  return colors.blood;
    case 'loot':   return colors.lime;
    case 'info':   return colors.steel;
    case 'xp':     return colors.purple;
    case 'gold':   return colors.gold;
    case 'warn':   return '#e07030';
    default:       return '#aaa';
  }
}

// ─── Base button ───────────────────────────────────────────────────────────
export const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  margin: '3px 4px',
  background: colors.card,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
  fontFamily: FONT_STACK,
  fontSize: 15,
  minHeight: `${BTN_MIN_HEIGHT}px`,
  borderRadius: '2px',
};

// ─── Primary CTA (Enter Dungeon, confirm purchase) ─────────────────────────
// Only one primary button per panel. See DESIGN.md § Action Button Hierarchy.
export const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  background: '#1a3a0a',
  color: colors.lime,
  border: `1px solid #2e5c14`,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.03em',
  margin: '3px 0',
};

// ─── Contextual buttons ────────────────────────────────────────────────────
export const btnContinueStyle: React.CSSProperties = {
  ...btnStyle,
  background: '#0e2a1a',
  color: '#5aaa70',
  border: `1px solid #1e4a2a`,
  fontSize: 11,
  padding: '6px 10px',
  margin: '3px 4px',
};

export const btnStashStyle: React.CSSProperties = {
  ...btnStyle,
  background: '#2a0e0e',
  color: '#c07060',
  border: `1px solid #5a1e1e`,
  fontSize: 11,
  padding: '6px 10px',
  margin: '3px 4px',
};

// ─── NPC action buttons (role-tinted) ─────────────────────────────────────
export const npcBtnBase: React.CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: 10,
  padding: '3px 7px',
  cursor: 'pointer',
  border: '1px solid',
  borderRadius: '2px',
  minHeight: `${BTN_MIN_HEIGHT}px`,
};

export const npcBtnTalk: React.CSSProperties    = { ...npcBtnBase, background: '#161c28', color: colors.steel,  borderColor: '#2a3a54' };
export const npcBtnShop: React.CSSProperties    = { ...npcBtnBase, background: '#201a0a', color: colors.gold,   borderColor: '#4a380e' };
export const npcBtnHeal: React.CSSProperties    = { ...npcBtnBase, background: '#0e1e10', color: '#6ac870',     borderColor: '#1e4a22' };
export const npcBtnTavern: React.CSSProperties  = { ...npcBtnBase, background: '#1a1020', color: colors.purple, borderColor: '#3a2a50' };
export const npcBtnEnchant: React.CSSProperties = { ...npcBtnBase, background: '#0e1e1a', color: colors.teal,   borderColor: '#1a3e3a' };

// ─── Nav bar button ────────────────────────────────────────────────────────
export const navBtnStyle: React.CSSProperties = {
  ...btnStyle,
  flex: 1,
  textAlign: 'center',
  minHeight: `${NAV_BTN_MIN_HEIGHT}px`,
  borderRadius: 0,
};

// ─── Compact filter/sort buttons (inventory, shop) ─────────────────────────
export const compactBtnStyle: React.CSSProperties = {
  padding: '2px 7px',
  margin: '2px 2px',
  background: colors.inset,
  color: colors.muted,
  border: `1px solid ${colors.border2}`,
  cursor: 'pointer',
  fontFamily: FONT_STACK,
  fontSize: 10,
  borderRadius: '2px',
};

export const compactBtnActiveStyle: React.CSSProperties = {
  ...compactBtnStyle,
  background: '#161c28',
  color: colors.steel,
  borderColor: '#2a3a54',
};

/** Ultra-compact mobile button style */
export const compactBtnStyleMobile: React.CSSProperties = {
  ...compactBtnStyle,
  padding: '2px 4px',
  margin: '2px 0px',
  fontSize: 10,
  borderRadius: '2px',
};

// ─── Equip button (inventory item rows) ────────────────────────────────────
export const btnEquipStyle: React.CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: 10,
  padding: '2px 7px',
  background: '#0e1e10',
  color: '#5aaa60',
  border: `1px solid #1e4a22`,
  cursor: 'pointer',
  flexShrink: 0,
  borderRadius: '2px',
};


// ─── Modal & Screen primitives ─────────────────────────────────────────────
// These style objects encode DESIGN.md anatomy for modals and full-screen
// overlays so individual components don't reinvent (and drift from) the system.
// Use them via the components in `components/ui/` rather than inline.

/** Fixed backdrop behind modal cards. Consumers pass zIndex via the component. */
export const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Panel-styled modal card. Consumers override maxWidth/zIndex via props. */
export const modalCardStyle: React.CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: '2px',
  maxWidth: 500,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  color: colors.text,
  fontFamily: FONT_STACK,
  overflow: 'hidden',
};

/** Full-screen overlay used by narrative screens (death, nemesis, quest). */
export const screenOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: colors.bg,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONT_STACK,
  color: colors.text,
  padding: 24,
};
