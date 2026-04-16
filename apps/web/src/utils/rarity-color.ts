/**
 * Utility to get color code for item rarity.
 */

export function getRarityColor(rarity: string): string {
  const rarityMap: Record<string, string> = {
    common: '#a0a0a0',
    uncommon: '#00ff00',
    rare: '#0080ff',
    epic: '#ff00ff',
    legendary: '#ffaa00',
  };
  return rarityMap[rarity.toLowerCase()] || '#a0a0a0';
}
