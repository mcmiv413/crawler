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
Tab bar 56px always visible. One panel at a time. All touch targets ≥44px. Tab buttons ≥48px.

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

## Dungeon Overlay Rules (WebGL Layer)

The dungeon renderer has two layers:

1. **DungeonCanvas** (primary) — 2D HTML5 canvas with tileset and game state visualization
2. **ThreeEffectsOverlay** (optional) — Transparent WebGL layer above the canvas for advanced visual effects

### Layer Composition

```
┌─────────────────────────────┐
│ UI Panels (DOM)             │  ← Always interactive
│ Stats, Inventory, Log, etc. │
├─────────────────────────────┤
│ Three.js WebGL Overlay      │  ← Transparent, pointer-events: none
│ (particle effects, auras)   │
├─────────────────────────────┤
│ DungeonCanvas (2D)          │  ← Primary map renderer
│ (tiles, actors, items)      │
└─────────────────────────────┘
```

### Overlay Styling Rules

**The Three.js overlay must never block user interaction:**

```tsx
/* apps/web/src/components/ThreeEffectsOverlay.tsx */
<ThreeEffectsOverlay style={{ pointerEvents: 'none' }} />
```

**Why `pointer-events: none`:**
- Canvas interactions (clicking tiles, moving, targeting) happen on the underlying `DungeonCanvas`
- The overlay is pure presentation — it should never capture clicks or hover states
- If it did, players would miss tiles and abilities would misfire

### Tile Sizing (Centralized)

Both renderers share the same tile size:

```typescript
import { CELL_SIZE } from '../config/ui-config.ts';

// CELL_SIZE = 24px (default)
// Use this constant everywhere — never hardcode 24, 32, 48, etc.
```

DawnLike sprites (16×16) are scaled by the renderer to fit `CELL_SIZE`. When you adjust `CELL_SIZE` in the config, both canvas and WebGL automatically rescale.

### UI Panels Must Never Depend on WebGL

- **Inventory panel** — DOM only, uses sprite system, zero WebGL dependency
- **Combat log** — DOM only, text-based, CSS colors
- **Character stats** — DOM only, color tokens and text
- **Ability UI** — DOM only, sprite icons and labels

If your UI feature **needs WebGL to work**, it's not a feature — it's a bug. UI panels must be fully functional on canvas-only setups (when `VITE_THREE_EFFECTS=false` or WebGL init fails).

### Feature Flag: VITE_THREE_EFFECTS

The overlay is controlled by an environment variable:

```bash
# Build with overlay enabled (disabled by default)
VITE_THREE_EFFECTS=true pnpm dev:web

# Build with overlay disabled (the default if unset)
VITE_THREE_EFFECTS=false pnpm dev:web
```

**What happens when disabled:**
- The lazy Three overlay chunk is never requested
- All game features still work (canvas rendering is complete)
- Animation refs still exist; registered Three effects are simply never instantiated
- No performance penalty — the overlay doesn't initialize

When enabled, the lazy chunk is still only loaded once a handled animation is actually active.

**What happens if WebGL setup fails at runtime:**
- Effect modules stay registered, but renderer creation fails and the parent keeps canvas fallback active
- Canvas continues rendering normally
- Game is fully playable
- Check browser console for WebGL context errors (usually GPU driver issues)

### Why Three.js is Optional

Three.js effects are **visual enhancement**, not **game mechanic**:

- **Canvas animations** handle all required visual feedback (damage numbers, hit flashes, status effects)
- **Three.js effects** add polish (particle trails, glow effects, advanced shaders)
- **The game never depends on them** — if Three.js breaks, the game still works

This design choice enables:
- **Shipping to low-end devices** — customers can disable the overlay
- **Faster CI builds** — testing doesn't require WebGL context
- **Cleaner architecture** — rendering concerns don't leak into game logic

### Adding Overlay Content

If you're adding a visual effect:

1. **Decide the renderer:**
   - **Canvas:** Simple, foundational, always visible (damage numbers, hit flash, actor bumps)
   - **Three.js:** Advanced, polished, optional (particle systems, complex shaders, 3D geometry)

2. **Declare the animation ref** in `packages/content/src/animation-refs/`

3. **Implement the renderer module** in your chosen directory:
   - Canvas: `apps/web/src/animations/modules/`
   - Three.js: `apps/web/src/rendering/three/effects/`

4. **Register with the same AnimationId** — both implementations use the presenter's emitted `animationId`

See [docs/guides/adding-animation.md](adding-animation.md) for complete workflow and examples.

### Layout Impact

The overlay does **not** affect layout:

- Panels are positioned relative to the viewport, not the canvas
- The overlay is absolutely positioned above the canvas
- Resizing the canvas doesn't move panels or tabs
- Touch targets and clickable areas remain unchanged

In CSS terms: the overlay is `position: absolute` with `pointer-events: none`. It's a visual layer with zero layout involvement.
