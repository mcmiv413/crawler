# How to Add a New Biome

## Overview

Biomes define dungeon floor aesthetics, generation parameters, and which enemies spawn. Each biome has a floor range determining when it appears.

---

## Quick Start

1. Create `packages/content/src/biomes/my-biome.ts`
2. Run `pnpm generate:indexes` — the index is auto-generated
3. Assign enemies to the biome
4. Test and commit

**That's it!** No manual index registration needed.

---

## Files to Touch

| Step | File | What to do |
|------|------|-----------|
| 1. Define | `packages/content/src/biomes/my-biome.ts` | Create `BiomeDefinition` |
| 2. Index | Run `pnpm generate:indexes` | Auto-registers in `packages/content/src/biomes/index.ts` |
| 3. Assign enemies | `packages/content/src/enemies/*.ts` | Set `biomes: [{ biomeId: 'my_biome' }]` on enemy templates |
| 4. (Optional) Wall sprites | `packages/presenter/src/builders/map-view-builder.ts` | Add wall variation case |

---

## Step 1: Create the Definition

Create `packages/content/src/biomes/my-biome.ts`:

```typescript
import type { BiomeDefinition } from './types.js';

export const myBiome: BiomeDefinition = {
  biomeId: 'my_biome',
  name: 'Haunted Marsh',
  description: 'A fetid swamp where the dead refuse to rest.',
  floorRange: { min: 3, max: 5 },  // Appears on floors 3-5
  tileWeights: {
    floor: 0.6,
    wall: 0.3,
    door: 0.1,
  },
  ambientColor: '#2a4a2a',         // HUD background tint
  floorAscii: '~',                 // ASCII fallback for floors
  wallAscii: '#',                  // ASCII fallback for walls
  tileSprites: {                   // DawnLike atlas sprite names
    floor: 'swamp floor',
    wall: 'swamp wall',
    interactable: 'closed wooden door front',
  },
  mapGen: {                        // Generation parameters
    roomWidth: [4, 8],
    roomHeight: [4, 6],
    corridorLength: [2, 6],
    dugPercentage: 0.45,
    algorithm: 'cellular',         // 'digger' = rooms, 'cellular' = organic caves
    fillProbability: 0.48,         // For cellular: initial wall density
    iterations: 4,                 // For cellular: smoothing passes
  },
};
```

---

## Step 2: Register in Index

Add to `packages/content/src/biomes/index.ts`:

```typescript
import { myBiome } from './my-biome.js';

// Add to BIOMES map
BIOMES.set('my_biome', myBiome);
```

The `BIOME_BY_FLOOR()` function automatically includes it when floor depth falls within `floorRange`.

---

## Step 3: Assign Enemies

Create or update enemy templates with your biome:

```typescript
// In packages/content/src/enemies/marsh-zombie.ts
biomes: [{ biomeId: 'my_biome' }],
```

The `ENEMIES_BY_BIOME` map is built automatically from enemy template biome arrays.

---

## Generation Algorithms

| Algorithm | Style | Best for |
|-----------|-------|----------|
| `digger` (default) | Rooms connected by corridors | Structured dungeons |
| `cellular` | Organic caves via cellular automata | Natural environments |

The `fillProbability` and `iterations` parameters control cellular automata output:
- Higher fill probability → more walls → tighter caves
- More iterations → smoother, more connected caves

---

## Biome Visuals

### Automatic
- **Floor/wall sprites** — Set via `tileSprites` field, rendered by `map-view-builder.ts`
- **Ambient color** — Applied to HUD via `player-hud-builder.ts`
- **ASCII fallback** — Used when sprites unavailable

### Wall Variations (Optional)
For custom wall variation logic, add a case in `packages/presenter/src/builders/map-view-builder.ts`:

```typescript
case 'my_biome': spriteName = 'alternate wall sprite'; break;
```

---

## What Happens Automatically

- **Selection** — `BIOME_BY_FLOOR(depth, rng)` picks from all biomes whose floor range includes the current depth
- **Map generation** — `map-generator.ts` uses biome's `mapGen` params for room/corridor dimensions
- **Enemy spawning** — `floor-populator.ts` pulls from `ENEMIES_BY_BIOME.get(biomeId)` pool
- **Tile rendering** — `map-view-builder.ts` resolves sprites from `tileSprites`
- **HUD theming** — `player-hud-builder.ts` applies `ambientColor`

---

## Key Type

```typescript
interface BiomeDefinition {
  readonly biomeId: string;
  readonly name: string;
  readonly description: string;
  readonly floorRange: { min: number; max: number };
  readonly tileWeights: { floor: number; wall: number; door: number };
  readonly ambientColor: string;
  readonly floorAscii: string;
  readonly wallAscii: string;
  readonly tileSprites?: { floor?: string; wall?: string; interactable?: string };
  readonly mapGen?: {
    roomWidth: [number, number];
    roomHeight: [number, number];
    corridorLength: [number, number];
    dugPercentage: number;
    algorithm?: 'digger' | 'cellular';
    fillProbability?: number;
    iterations?: number;
  };
}
```
