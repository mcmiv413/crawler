export function screenToGrid(
  offsetX: number,
  offsetY: number,
  vpLeft: number,
  vpTop: number,
  cellSize: number,
): { x: number; y: number } {
  return {
    x: Math.floor(offsetX / cellSize) + vpLeft,
    y: Math.floor(offsetY / cellSize) + vpTop,
  };
}
