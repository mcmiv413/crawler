/**
 * Canonical rarity color definitions.
 * Single source of truth for item rarity visualization across the application.
 */

export const RARITY_COLORS = {
  common: '#a0a0a0',
  uncommon: '#00ff00',
  rare: '#0080ff',
  epic: '#ff00ff',
  legendary: '#ffaa00',
} as const;

export type RarityLevel = keyof typeof RARITY_COLORS;

export function getRarityColor(rarity: string): string {
  const normalizedRarity = rarity.toLowerCase() as RarityLevel;
  return RARITY_COLORS[normalizedRarity] ?? RARITY_COLORS.common;
}
