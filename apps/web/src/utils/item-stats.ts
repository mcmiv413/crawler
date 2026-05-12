import type { InventoryItemView } from '@dungeon/presenter';

export function getItemStats(item: InventoryItemView): string {
  let text = '';
  if (item.weaponStats) {
    const ws = item.weaponStats;
    const dmg = `${ws.damageMin}–${ws.damageMax}`;
    text += `${dmg} ${ws.damageType} dmg`;
    if (ws.weaponRange && ws.weaponRange > 1) {
      text += ` | range: ${ws.weaponRange}`;
    }
  }
  if (item.armorStats) {
    text += `${item.armorStats.defense} def`;
    if (item.armorStats.evasionPenalty) {
      text += ` | eva penalty: -${item.armorStats.evasionPenalty}`;
    }
  }
  return text;
}
