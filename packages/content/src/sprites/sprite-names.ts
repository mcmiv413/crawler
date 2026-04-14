/**
 * Type-safe sprite name constants extracted from DAWNLIKE_ATLAS
 * Use these instead of string literals to prevent typos
 */

import { DAWNLIKE_ATLAS } from './dawnlike-atlas-raw.js';

// Export the type of valid sprite names
export type DawnLikeSpriteId = keyof typeof DAWNLIKE_ATLAS;

/**
 * Helper to create a type-safe sprite name.
 * This will cause a TypeScript error if the sprite doesn't exist in the atlas.
 */
export function spriteName<T extends DawnLikeSpriteId>(name: T): T {
  return name;
}

// Re-export DAWNLIKE_ATLAS type for reference
export type { DAWNLIKE_ATLAS };

// Common sprite names for easy reference (type-safe)
// These match the actual sprites used in enemies, items, objects, and biomes
export const SPRITE_NAMES = {
  // Enemies
  skeleton: spriteName('skeleton'),
  enormousRat: spriteName('enormous rat'),
  goblin: spriteName('goblin'),
  imp: spriteName('imp'),
  babyBat: spriteName('baby bat'),
  shamanKarnov: spriteName('shaman karnov'),
  phaseSpider: spriteName('phase spider'),
  ogre: spriteName('ogre'),
  giantBeetle: spriteName('giant beetle'),
  killerBeetle: spriteName('killer beetle'),
  crystalGolem: spriteName('crystal golem'),
  wraith: spriteName('wraith'),
  frog: spriteName('frog'),
  clayGolem: spriteName('clay golem'),
  caveSpider: spriteName('cave spider'),
  shadowSkeleton: spriteName('shadow skeleton'),
  highPriest: spriteName('high priest'),

  // Weapons
  rustySword: spriteName('rusty sword'),
  dwarvishShortSword: spriteName('dwarvish short sword'),
  mace: spriteName('mace'),
  compositeBow: spriteName('composite bow'),
  elvenDagger: spriteName('elven dagger'),
  dagger: spriteName('dagger'),
  battleAxe: spriteName('battle axe'),
  axe: spriteName('axe'),
  crossbow: spriteName('crossbow'),
  elvenShortSword: spriteName('elven short sword'),
  warHammer: spriteName('war hammer'),

  // Armor
  scaleArmor: spriteName('scale armor'),
  chainShirt: spriteName('chain shirt'),

  // Objects
  closedChest: spriteName('closed chest'),
  fountain: spriteName('fountain'),
  altar: spriteName('altar'),
  brassLantern: spriteName('brass lantern'),
  spikedPitTile: spriteName('spiked pit tile'),

  // Tiles
  dayStoneFloorC: spriteName('day stone floor c'),
  darkBrickWallCenter: spriteName('dark brick wall center'),
  closedStoneDoorFront: spriteName('closed stone door front'),
  closedWoodenDoorFront: spriteName('closed wooden door front'),
} as const;
