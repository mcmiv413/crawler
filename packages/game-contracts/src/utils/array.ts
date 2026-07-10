/**
 * Returns a sorted copy without mutating the input.
 */
export function sortedCopy<T>(
  items: Iterable<T>,
  compare: (a: T, b: T) => number,
): T[] {
  const merge = (
    left: readonly T[],
    right: readonly T[],
    leftIndex = 0,
    rightIndex = 0,
  ): T[] => {
    if (leftIndex >= left.length) return right.slice(rightIndex);
    if (rightIndex >= right.length) return left.slice(leftIndex);

    const leftItem = left[leftIndex]!;
    const rightItem = right[rightIndex]!;
    return compare(leftItem, rightItem) <= 0
      ? [leftItem, ...merge(left, right, leftIndex + 1, rightIndex)]
      : [rightItem, ...merge(left, right, leftIndex, rightIndex + 1)];
  };

  const sort = (values: readonly T[]): T[] => {
    if (values.length <= 1) return [...values];

    const midpoint = Math.floor(values.length / 2);
    return merge(
      sort(values.slice(0, midpoint)),
      sort(values.slice(midpoint)),
    );
  };

  return sort([...items]);
}
