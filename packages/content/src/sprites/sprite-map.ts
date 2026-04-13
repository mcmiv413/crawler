/**
 * Kenney Tiny Dungeon sprite sheet map.
 * Sheet: apps/web/public/sprites/kenney-tiny-dungeon.png
 * Grid: 16×16px tiles, no padding. Tile at col c, row r = { x: c*16, y: r*16, w: 16, h: 16 }
 *
 * Key conventions:
 *   'player'              — player character
 *   'tile:<tileType>'     — generic tile (all biomes)
 *   'tile:<type>:<biome>' — biome-specific override (checked first)
 *   'enemy:<templateId>'  — enemy sprite
 *   'item:<itemId>'       — item sprite
 */

export type { SpriteRect } from '@dungeon/contracts';

export const SPRITE_MAP: Readonly<Record<string, import('@dungeon/contracts').SpriteRect>> = {
  // ── Player ─────────────────────────────────────────────────────────────────
  'player':                         { x: 16,  y: 128, w: 16, h: 16 }, // col 1,  row 8  — knight hero

  // ── Environment tiles (generic) ────────────────────────────────────────────
  'tile:floor':                     { x: 0,   y: 0,   w: 16, h: 16 }, // col 0,  row 0  — stone floor
  'tile:wall':                      { x: 64,  y: 48,  w: 16, h: 16 }, // col 4,  row 3  — brick wall
  'tile:stairs_down':               { x: 0,   y: 48,  w: 16, h: 16 }, // col 0,  row 3  — wide stair (descend)
  'tile:stairs_up':                 { x: 48,  y: 48,  w: 16, h: 16 }, // col 3,  row 3  — narrow stair (ascend)
  'tile:chest':                     { x: 80,  y: 112, w: 16, h: 16 }, // col 5,  row 7  — chest
  'tile:door':                      { x: 144, y: 16,  w: 16, h: 16 }, // col 9,  row 1  — door
  'tile:obstacle':                  { x: 96,  y: 80,  w: 16, h: 16 }, // col 6,  row 5  — pillar
  'tile:hazard':                    { x: 80,  y: 48,  w: 16, h: 16 }, // col 5,  row 3  — spikes
  'tile:interactable':              { x: 128, y: 16,  w: 16, h: 16 }, // col 8,  row 1  — shrine
  'tile:event':                     { x: 128, y: 32,  w: 16, h: 16 }, // col 8,  row 2  — magic circle

  // ── Biome-specific floor overrides ─────────────────────────────────────────
  'tile:floor:goblin_warrens':      { x: 0,   y: 64,  w: 16, h: 16 }, // col 0,  row 4  — sand floor
  'tile:interactable:goblin_warrens': { x: 160, y: 96, w: 16, h: 16 }, // col 10, row 6  — barrel

  // ── Items (floor drops) ────────────────────────────────────────────────────
  'item:health_potion':             { x: 112, y: 160, w: 16, h: 16 }, // col 7,  row 10 — small red potion
  'item:health_potion_large':       { x: 112, y: 144, w: 16, h: 16 }, // col 7,  row 9  — large red potion
  'item:mana_potion':               { x: 128, y: 160, w: 16, h: 16 }, // col 8,  row 10 — small blue potion
  'item:mana_potion_large':         { x: 128, y: 144, w: 16, h: 16 }, // col 8,  row 9  — large blue potion
  'item:iron_sword':                { x: 128, y: 128, w: 16, h: 16 }, // col 8,  row 8  — sword

  // ── Enemies ────────────────────────────────────────────────────────────────
  'enemy:skeleton_warrior':         { x: 32,  y: 128, w: 16, h: 16 }, // col 2,  row 8  — skeleton
  'enemy:cave_rat':                 { x: 48,  y: 160, w: 16, h: 16 }, // col 3,  row 10 — rat
  'enemy:goblin_archer':            { x: 64,  y: 128, w: 16, h: 16 }, // col 4,  row 8  — lighter figure
  'enemy:pit_spider':               { x: 32,  y: 160, w: 16, h: 16 }, // col 2,  row 10 — spider
  'enemy:frost_wraith':             { x: 16,  y: 160, w: 16, h: 16 }, // col 1,  row 10 — ghost
  'enemy:moss_golem':               { x: 64,  y: 160, w: 16, h: 16 }, // col 4,  row 10 — slime/blob
  'enemy:shadow_lurker':            { x: 0,   y: 144, w: 16, h: 16 }, // col 0,  row 9  — ghost spirit
  'enemy:fire_imp':                 { x: 32,  y: 144, w: 16, h: 16 }, // col 2,  row 9  — demon creature
  'enemy:dungeon_ogre':             { x: 0,   y: 128, w: 16, h: 16 }, // col 0,  row 8  — heavy fighter
  'enemy:briar_needler':            { x: 48,  y: 144, w: 16, h: 16 }, // col 3,  row 9  — plant creature
  'enemy:mire_toad':                { x: 80,  y: 160, w: 16, h: 16 }, // col 5,  row 10 — toad creature
  'enemy:shard_priest':             { x: 96,  y: 128, w: 16, h: 16 }, // col 6,  row 8  — crystal/arcane figure
  'enemy:ember_bat':                { x: 80,  y: 128, w: 16, h: 16 }, // col 5,  row 8  — fiery creature
  'enemy:ash_beetle':               { x: 112, y: 128, w: 16, h: 16 }, // col 7,  row 8  — armored insect
  'enemy:crystal_golem':            { x: 144, y: 128, w: 16, h: 16 }, // col 9,  row 8  — crystalline construct
  'enemy:bone_shaman':              { x: 160, y: 128, w: 16, h: 16 }, // col 10, row 8  — undead mage
  'enemy:chain_specter':            { x: 16,  y: 144, w: 16, h: 16 }, // col 1,  row 9  — spectral creature

  // ── Objects ────────────────────────────────────────────────────────────────
  'object:chest':                   { x: 80,  y: 112, w: 16, h: 16 }, // col 5,  row 7  — chest
  'object:fire_pit':                { x: 80,  y: 48,  w: 16, h: 16 }, // col 5,  row 3  — spikes/hazard
  'object:healing_fountain':        { x: 128, y: 16,  w: 16, h: 16 }, // col 8,  row 1  — shrine
  'object:arcane_altar':            { x: 128, y: 32,  w: 16, h: 16 }, // col 8,  row 2  — magic circle
  'object:trap_spikes':             { x: 96,  y: 80,  w: 16, h: 16 }, // col 6,  row 5  — pillar/trap
} as const;
