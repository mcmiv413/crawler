/**
 * Returns a sorted copy without mutating the input. Centralizes the one
 * sanctioned Array.prototype.sort call so call sites stay mutation-free
 * (dungeon/no-array-mutation forbids in-place sort on unprefixed variables).
 */
export function sortedCopy<T>(
  items: Iterable<T>,
  compare: (a: T, b: T) => number,
): T[] {
  const mutableItems = [...items];
  mutableItems.sort(compare);
  return mutableItems;
}
