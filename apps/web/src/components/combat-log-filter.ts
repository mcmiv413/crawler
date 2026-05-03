export interface CombatLogEntry {
  readonly text: string;
  readonly type: string;
}

export function filterCombatLogForDisplay(
  entries: readonly CombatLogEntry[],
  debugMode: boolean
): CombatLogEntry[] {
  return entries.filter((e) => debugMode || !e.text.startsWith('[DEBUG]'));
}
