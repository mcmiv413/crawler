/**
 * DawnLike sprite sheet map.
 * Sheet: apps/web/public/sprites/dawnlike.png (2048×1024)
 *
 * Key conventions:
 *   'player'              — player character
 *   'tile:<tileType>'     — generic tile (all biomes)
 *   'tile:<type>:<biome>' — biome-specific override (checked first)
 *   'enemy:<templateId>'  — enemy sprite
 *   'item:<itemId>'       — item sprite
 *   'object:<objectId>'   — object sprite
 */

export type { SpriteRect } from '@dungeon/contracts';
export { DAWNLIKE_SPRITE_MAP as SPRITE_MAP } from './dawnlike-sprite-map.js';
