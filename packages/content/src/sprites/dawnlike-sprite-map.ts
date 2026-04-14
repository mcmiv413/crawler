import { DAWNLIKE_NAME_MAP, resolveSprite } from './dawnlike-name-map.js';
import type { SpriteRect } from '@dungeon/contracts';

export const DAWNLIKE_SPRITE_MAP: Record<string, SpriteRect> = Object.fromEntries(
  Object.keys(DAWNLIKE_NAME_MAP)
    .map(key => [key, resolveSprite(key)])
    .filter((entry): entry is [string, SpriteRect] => entry[1] !== undefined)
);
