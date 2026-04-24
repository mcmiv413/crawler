# UI Design Guide

> Reference for all UI decisions. Consult before adding panels, components, or visual styles.

## Design Principles

1. **Genre-native** — monospace font, dark backgrounds, colour-coded state. Not a web app.
2. **Glanceable** — HP, XP, floor, gold readable without studying numbers.
3. **Sprite-driven** — DawnLike Atlas tileset is the visual language. No emoji substitutes.
4. **Canvas is hero** — UI panels frame the dungeon; they don't compete.
5. **Responsive** — desktop: multi-column panels. Mobile: single panel + tab nav.

---

## Typography

**Font:** `IBM Plex Mono` (weights 400, 500, 600). Fallback: `'Courier New', monospace`.
Always use `FONT_STACK` constant or `var(--font)` — never `fontFamily: 'monospace'` directly.

| Role | Size | Weight |
|------|------|--------|
| Panel heading | 11px | 600 (uppercase, tracked) |
| Body | 13px | 400 |
| Small (items, log) | 11px | 400 |
| Micro (labels, tags) | 10px | 400 |
| Stat value | 15-16px | 600 |

---

## Colour System

All colours as CSS custom properties on `:root` and mirrored in `styles.ts`:

### Backgrounds
- `--bg`: `#0d0d10` (app shell)
- `--panel`: `#111318` (panels)
- `--inset`: `#0a0b0e` (recessed: headers, bar tracks)
- `--card`: `#181c23` (raised: cards, filled slots)
- `--border` / `--border2`: `#252830` / `#1e2228`

### Text
- `--text`: `#cdd0d6` (body), `--label`: `#7b8090` (secondary), `--muted`: `#5a5e6b` (tertiary)

### Accents (same perceptual weight, vary hue)
| Token | Hex | Meaning |
|-------|-----|---------|
| `--lime` | `#7dc940` | Positive: HP, loot, Enter Dungeon |
| `--gold` | `#c8963c` | Economy: gold, ATK, prices |
| `--steel` | `#5a8fc7` | Info: XP, ACC/EVA, navigation |
| `--blood` | `#c85a4a` | Danger: death, Nemesis, low HP |
| `--purple` | `#8a78c8` | Magic: XP gain, enchants, abilities |
| `--teal` | `#4aabb0` | Utility: enchant labels, EVA |

**Rules:** Never use `--lime` + `--blood` together. Never introduce new hex values outside these tokens.

---

## Layout

### Desktop — multi-column
Panels are fixed width except Log (flex). Dungeon canvas expands to fill. Each panel scrolls internally (`overflow-y: auto`).

### Mobile — single panel + tab bar
Tab bar 50px always visible. One panel at a time. All touch targets ≥44px. Tab buttons ≥48px.

### Panel Anatomy
```
┌─────────────────────────┐  ← 1px border-right
│ Header (--inset bg)     │  ← h2 uppercase 11px + right meta
├─────────────────────────┤
│ Body (10px 12px pad)    │  ← overflow-y: auto
└─────────────────────────┘
```

---

## Button Hierarchy

| Tier | When | Style |
|------|------|-------|
| **Primary** | Single most important action | `--lime` text, `#1a3a0a` bg |
| **Secondary** | Supporting actions | `--card` bg, `--text` colour |
| **Contextual** | Consequence-tinted | Green/amber/red bg matching risk |

**Only one primary button per panel.** Never two.

---

## Sprite System (DawnLike Atlas)

**Atlas:** `apps/web/public/sprites/dawnlike.png` (16×16 tiles, from [tommyettinger/DawnLikeAtlas](https://github.com/tommyettinger/DawnLikeAtlas))
**Coordinates:** `packages/content/src/sprites/dawnlike-sprite-map.ts`
**Name mapping:** `packages/content/src/sprites/dawnlike-name-map.ts`
**Renderer:** `apps/web/src/sprites/canvas-renderer.ts`

Sprite names are keys of `DAWNLIKE_ATLAS` (from `dawnlike-atlas-raw.ts`). Type-safe names via `DawnLikeSpriteId`.

Use `ItemSpriteIcon` component for all sprite rendering:
```tsx
<ItemSpriteIcon spriteName="shopkeeper" size={24} />
```

Accepted sizes: 16, 24, 32. Sprites are 16×16 in atlas, scaled with `imageSmoothingEnabled = false`.

**Setup:** Clone or download from `https://github.com/tommyettinger/DawnLikeAtlas`.
Atlas PNG goes in `apps/web/public/sprites/dawnlike.png`. Binary is gitignored.
Without PNG: falls back to ASCII. Force ASCII: `VITE_ASCII_MODE=true pnpm dev:web`.

---

## UI Config Centralization

All numeric UI values centralized in `apps/web/src/config/ui-config.ts`:
tile size, viewport, panel widths, breakpoints, touch targets.

**Never hardcode pixel values in components.** Fitness test `apps/web/src/config.test.ts` enforces this.

---

## Adding New Panels — Checklist

1. Use standard panel header anatomy
2. Divide content with section labels
3. Entity icons use sprite system
4. Identify primary action (max one per panel)
5. Colours from the six accent tokens only
6. Mobile: add to tab nav if needed
7. Body: `overflow-y: auto`, `flex: 1`, `minHeight: 0`
8. Empty state for all lists

---

## What Not To Do

- ❌ Emoji as icons (use sprites)
- ❌ New hex values outside token set
- ❌ `border-radius` > 2px
- ❌ Drop shadows/gradients/glow on UI panels
- ❌ Two primary buttons in one panel
- ❌ Fixed heights on scrollable lists
- ❌ `fontFamily: 'monospace'` directly
