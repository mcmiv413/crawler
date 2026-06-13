/**
 * Pure canvas drawing helpers for animation modules.
 * Used by all animation modules to draw common shapes, patterns, and effects.
 */

/**
 * Draw a ring (circle outline) at the given position and radius.
 */
export function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  thickness: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(${color}, ${alpha})`;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a stream of particles flowing from start to end.
 */
export function drawParticleStream(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  count: number,
  progress: number
): void {
  ctx.save();
  ctx.fillStyle = `rgba(100, 200, 255, ${0.6 * (1 - progress)})`;

  const deltaX = endX - startX;
  const deltaY = endY - startY;

  for (let i = 0; i < count; i++) {
    const t = (progress + i / count) % 1;
    const x = startX + deltaX * t;
    const y = startY + deltaY * t;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw an arrow sprite moving along a line from source to destination.
 * Rotates to face the direction of travel.
 */
export function drawArrowAlong(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  progress: number
): void {
  const x = fromX + (toX - fromX) * progress;
  const y = fromY + (toY - fromY) * progress;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(150, 100, 50, 0.8)';
  ctx.fillRect(-3, -2, 8, 4);

  ctx.restore();
}

/**
 * Easing: cubic ease-out.
 * Starts fast, ends slow.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Easing: cubic ease-in.
 * Starts slow, ends fast.
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Oscillating function that decays over time.
 * Useful for pulsing effects, vibrations, rings expanding then fading.
 */
export function decayingSine(t: number, frequency: number): number {
  return Math.sin(t * Math.PI * 2 * frequency) * (1 - t);
}
