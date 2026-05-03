# Responsive Design Guide

This guide documents the constraints and rules that guarantee all screens, panels, and interactive elements are fully visible and reachable on all supported devices (minimum 360px Android / 375px iOS).

## Supported Device Matrix

CSS pixels, portrait orientation. Source: real device specs.

| Tier | Width | Height | Representative Devices |
|------|-------|--------|------------------------|
| **T1 — Android minimum** | 360px | 640px | Common mid-range Android |
| **T2 — iOS minimum** | 375px | 667px | iPhone 6/7/8, SE 2/3 |
| **T2b — iOS small tall** | 375px | 812px | iPhone X, 11, 12 mini |
| **T3 — Primary iOS** | 390px | 844px | iPhone 12, 13, 14 ← primary test target |
| **T4 — Wide phones** | 393px | 851px | Pixel 6/7 |
| **T4b — Large phones** | 412px | 869–915px | Samsung Galaxy S21, Galaxy A series |
| **T5 — Tablet/Desktop** | 768px+ | — | Tablets, desktop browsers |

**Hard minimums:**
- Android: **360×640** — all layouts must be functional and unclipped at this size
- iOS: **375×667** — the practical iOS floor (iPhone SE 1st gen 320px is not supported)
- **Primary test size: 390×844** (iPhone 12/13/14 standard)

Landscape orientation is not supported (game is portrait-first).

## Design Rules

These are hard constraints that apply to all new code and components.

### 1. No Overflow
Content must never be clipped off the bottom or right of the viewport. If content does not fit, it must scroll inside an approved container.

### 2. Tab Bar Clearance
On mobile, scroll-approved containers add `paddingBottom: TAB_BAR_HEIGHT` (56px) so the last item is reachable above the tab bar edge. The tab bar is a flex child, so the content area already stops above it; the extra padding preserves comfortable last-item reachability.

### 3. Approved Scroll Containers (Allowlist)
Only these containers may scroll internally; everything else must fit without scrolling:

- `InventoryScreen` item list
- `CharacterScreen` main stat/ability body
- `CombatLogView` log entry list
- `DungeonPhase` mini combat log
- `TownPhase` main messages pane
- `TownPhase.SubPanel` shop/tavern/enchanter bodies
- Quest tracker (`max-height: 200px`)

### 4. Breakpoint Authority
`apps/web/src/config/ui-config.ts` is the source of truth for JS/TS breakpoint values. CSS modules should avoid ad hoc px media-query thresholds; prefer fluid sizing with `clamp()`, `min()`, and `minmax()` so components adapt without scattering breakpoint branches.

**Breakpoint constants:**

| Constant | Value | Purpose |
|----------|-------|---------|
| `BREAKPOINT_XS` | 360px | Android minimum; "very small" CSS override threshold |
| `BREAKPOINT_SM` | 375px | iOS minimum (iPhone 6/7/8, SE 2/3, mini) |
| `BREAKPOINT_MD` | 768px | Mobile/desktop layout boundary |
| `BREAKPOINT_LG` | 1024px | Desktop layout width threshold |
| `BREAKPOINT_NAV_LABEL` | 450px | MobileNav icon+label vs icon-only threshold |

**Preferred CSS strategy:** use fluid sizing instead of hard breakpoint forks whenever the layout can scale naturally.

```css
.grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr));
  gap: clamp(0.375rem, 1.5vw, 0.75rem);
}

.button {
  padding: clamp(0.625rem, 2vw, 0.75rem);
  font-size: clamp(0.625rem, 2.3vw, 0.75rem);
}
```

### 5. Touch Targets
All interactive elements must meet WCAG accessibility standards:
- Standard buttons: minimum 44px tall
- Navigation buttons: minimum 48px tall

### 6. Desktop/Mobile Parity
The only permitted behavioral difference is panel layout (side-by-side vs. single panel switching). All features must work identically on both form factors.

### 7. Canvas Policy
The dungeon canvas fills available space dynamically via `MapDisplay`'s `ResizeObserver`. Cell size is sourced from `CELL_SIZE` in `ui-config.ts`. Tile count adapts to fill space; tile size never changes.

## Phase 4 Audit Notes

- **Compact HUD density:** the shared compact `PlayerHud` now uses a denser mobile layout. HP and XP bars render side by side on mobile so dungeon and town reclaim vertical space without dropping key information.
- **Danger signal:** dungeon danger is still shown, but as a header badge instead of a dedicated row above the map.
- **Dungeon mini log:** the mini combat log keeps its bounded height but now scrolls internally, so older entries remain reachable without opening the full log panel.
- **Inspect modal:** the entity sidebar now uses a clamped width between 140px and 220px so the details pane remains usable at 375px.
- **Action surfaces:** action buttons, overlays, and dropdowns now use fluid sizing (`clamp`/`minmax`) instead of hardcoded CSS media breakpoints.

## Tab Bar Structure

The mobile tab bar (`MobileNav`) is structured as a flex child in `App.tsx`, not a fixed overlay:

```tsx
<div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
  {/* content row grows to fill available space */}
  <div style={{ flex: 1, overflow: 'hidden' }}>
    {/* panels */}
  </div>

  {/* tab bar only on mobile, physically below content */}
  {isMobile && <MobileNav />}
</div>
```

This structural approach eliminates the need for `position: fixed` and automatic occlusion issues.

## Manual Testing Checklist

Test at **360×640** (Android minimum), **375×667** (iOS minimum), and **390×844** (primary iOS):

### Dungeon Phase
- [ ] All action buttons fully visible and reachable
- [ ] Compact HP/XP bars remain readable side by side
- [ ] Danger badge remains visible without costing a full row
- [ ] No horizontal overflow when resizing viewport
- [ ] Mini combat log scrolls while staying within its bounded height

### Inventory Screen
- [ ] Item list scrolls smoothly
- [ ] Last item in list fully visible above tab bar
- [ ] No text truncation beyond ellipsis
- [ ] Item grid adapts to narrow width

### Character Screen
- [ ] Stat display rows don't overflow horizontally
- [ ] Ability buttons are properly sized
- [ ] Last stat/ability fully visible above tab bar
- [ ] Weapon mastery modal (`position: fixed`) doesn't break at narrow widths

### Town Phase
- [ ] Shop item rows don't overflow horizontally
- [ ] Price display readable at narrow widths
- [ ] Last shop item fully visible above tab bar when scrolled to bottom
- [ ] NPC message section scrolls if constrained

### Combat Log
- [ ] Log entries fully visible (timestamp, action, result)
- [ ] Last entry fully visible above tab bar when scrolled to bottom
- [ ] Dungeon mini log scrolls to older entries without pushing actions off-screen

### Inspect Modal
- [ ] Sidebar and content both visible at 375px
- [ ] No horizontal overflow
- [ ] All stats/abilities readable

### Mobile Navigation
- [ ] 5 tabs fit without overflow at 360px (5 × 72px = 360px exactly)
- [ ] Icon-only mode activates below `BREAKPOINT_NAV_LABEL` (450px)
- [ ] Tab labels don't wrap or overflow

### Desktop (1280px+)
- [ ] Panels stack side-by-side correctly
- [ ] MobileNav is not visible
- [ ] No unintended layout changes

## Common Pitfalls

### Hardcoded Breakpoints
❌ **Don't:**
```css
@media (max-width: 640px) { /* hardcoded breakpoint branch */ }
```

✅ **Do:**
```css
.button {
  padding: clamp(0.625rem, 2vw, 0.75rem);
}
```

### Missing Tab Bar Padding
❌ **Don't:**
```tsx
<div style={{ overflow: 'auto' }}>
  {/* last item may be clipped by tab bar */}
</div>
```

✅ **Do:**
```tsx
const { isMobile } = useBreakpoint();
<div style={{ overflow: 'auto', paddingBottom: isMobile ? TAB_BAR_HEIGHT : 0 }}>
  {/* last item fully visible */}
</div>
```

### Position: Fixed Outside Modals
Position: fixed elements (except modals and the tab bar) are fragile at small viewports. Prefer flex/grid layouts.

❌ **Don't:**
```tsx
<div style={{ position: 'fixed', top: 0, right: 0, width: '220px' }}>
  {/* only 155px left at 375px width */}
</div>
```

✅ **Do:**
```tsx
<div style={{ display: 'flex', gap: 16 }}>
  <div style={{ flex: 1 }}>Content</div>
  <aside style={{ width: isMobile ? 140 : 220 }}>Sidebar</aside>
</div>
```

## Validation Commands

Run these before declaring the responsive work complete:

```bash
# Check for hardcoded px media-query breakpoints in CSS modules
rg '@media\s*\([^\)]*(max|min)-width:\s*[0-9]+px' apps/web/src/components --glob '*.module.css'

# Check that CELL_SIZE is used for dungeon canvas sizing
rg 'const cellSize\s*=\s*24' apps/web/src/components/DungeonCanvas.tsx apps/web/src/components/DungeonPhase.tsx

# Check that MobileNav position: fixed is removed
grep -n 'position.*fixed' apps/web/src/components/MobileNav.tsx
```

All three should return 0 hits.

## Related Files

- **Config:** `apps/web/src/config/ui-config.ts` (breakpoint constants)
- **Layout:** `apps/web/src/App.tsx` (tab bar structure)
- **Component:** `apps/web/src/components/MobileNav.tsx` (mobile navigation)
- **HUD:** `apps/web/src/components/PlayerHud.tsx` (shared compact dungeon/town HUD)
