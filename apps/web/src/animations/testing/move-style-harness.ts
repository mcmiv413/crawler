import type { MoveAnimStyle } from '@dungeon/presenter';
import {
  getMoveRenderedOffsetPx,
  getSquashStretchScale,
} from '../move-style-profiles.js';
import { CELL_SIZE } from '../../config/ui-config.js';

const STYLES: readonly MoveAnimStyle[] = ['step', 'slide', 'dart', 'drift', 'stomp', 'lurch'];
const LOOP_MS = 1200;
const TILE_GAP = 8;
const PANEL_WIDTH = (CELL_SIZE * 2) + TILE_GAP + 54;
const CANVAS_WIDTH = (PANEL_WIDTH * STYLES.length) + 32;
const CANVAS_HEIGHT = 150;
const TRACK_Y = 54;

const canvas = getHarnessCanvas();
const ctx = getHarnessContext(canvas);

function configureCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_WIDTH * dpr;
  canvas.height = CANVAS_HEIGHT * dpr;
  canvas.style.aspectRatio = `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function drawTile(x: number, y: number, active: boolean): void {
  ctx.fillStyle = active ? '#26382d' : '#1c2820';
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  ctx.strokeStyle = active ? '#7ea68a' : '#3d5445';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
}

function drawSprite(x: number, y: number, scaleX: number, scaleY: number, style: MoveAnimStyle): void {
  const width = CELL_SIZE * scaleX;
  const height = CELL_SIZE * scaleY;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = style === 'step' ? '#f4f1d8' : '#d86852';
  ctx.fillRect(-(width / 2), -(height / 2), width, height);
  ctx.fillStyle = '#101510';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style === 'step' ? '@' : 'e', 0, 1);
  ctx.restore();
}

function drawLabel(style: MoveAnimStyle, x: number): void {
  ctx.fillStyle = '#c9d7cc';
  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(style, x, TRACK_Y + CELL_SIZE + 18);
}

function drawFrame(now: number): void {
  const progress = (now % LOOP_MS) / LOOP_MS;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#172019';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  STYLES.forEach((style, index) => {
    const originX = 18 + (index * PANEL_WIDTH);
    const fromX = originX;
    const toX = originX + CELL_SIZE + TILE_GAP;
    const y = TRACK_Y;
    const move = {
      fromPos: { x: 0, y: 0 },
      toPos: { x: 1, y: 0 },
      style,
      progress,
    };
    const offset = getMoveRenderedOffsetPx(move, CELL_SIZE + TILE_GAP, style);
    const scale = getSquashStretchScale(style, progress);

    drawTile(fromX, y, progress < 0.5);
    drawTile(toX, y, progress >= 0.5);
    drawSprite(
      toX + (CELL_SIZE / 2) + offset.x,
      y + (CELL_SIZE / 2) + offset.y,
      scale.scaleX,
      scale.scaleY,
      style,
    );
    drawLabel(style, originX + CELL_SIZE + (TILE_GAP / 2));
  });

  requestAnimationFrame(drawFrame);
}

configureCanvas();
window.addEventListener('resize', configureCanvas);
requestAnimationFrame(drawFrame);

function getHarnessCanvas(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>('#move-style-harness');
  if (element === null) {
    throw new Error('Move style harness canvas is missing');
  }
  return element;
}

function getHarnessContext(element: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = element.getContext('2d');
  if (context === null) {
    throw new Error('Move style harness requires a 2D canvas context');
  }
  return context;
}
