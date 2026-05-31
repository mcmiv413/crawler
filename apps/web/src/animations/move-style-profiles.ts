import type { MoveAnimStyle } from '@dungeon/presenter';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Scale {
  readonly scaleX: number;
  readonly scaleY: number;
}

export interface MoveStyleProfile {
  readonly anticipationFrac: number;
  readonly anticipationPx: number;
  readonly anticipationScaleY?: number;
  readonly recoilFrac: number;
  readonly recoilPx: number;
  readonly recoilScaleY?: number;
  readonly arcAmplitude: number;
  readonly squashTiming: 'mid' | 'landing' | 'none';
  readonly squashAmplitude: number;
  readonly jitterPx: number;
  readonly smearScaleX?: number;
}

export interface MoveTravelInput {
  readonly fromPos: Point;
  readonly toPos: Point;
  readonly style: MoveAnimStyle;
  readonly progress: number;
  readonly fromOffsetPx?: Point;
  readonly walkPhase?: WalkMotionPhase;
}

export type WalkMotionPhase = 'single' | 'start' | 'middle' | 'end';

export const STEP_WALK_BOUNDARY_PROGRESS = 0.5;
export const STEP_WALK_ENTRY_PROGRESS = 0.35;
export const STEP_WALK_EXIT_PROGRESS = 0.7;

const STEP_STRIDE_BOB_FACTOR = 0.06;
const STEP_STRIDE_SCALE = 0.03;

export const MOVE_STYLE_PROFILES: Readonly<Record<MoveAnimStyle, MoveStyleProfile>> = {
  step: {
    anticipationFrac: 0,
    anticipationPx: 0,
    recoilFrac: 0,
    recoilPx: 0,
    arcAmplitude: 0,
    squashTiming: 'none',
    squashAmplitude: 0,
    jitterPx: 0,
  },
  slide: {
    anticipationFrac: 0,
    anticipationPx: 0,
    recoilFrac: 0,
    recoilPx: 0,
    arcAmplitude: 0,
    squashTiming: 'none',
    squashAmplitude: 0,
    jitterPx: 0,
  },
  dart: {
    anticipationFrac: 0,
    anticipationPx: 0,
    recoilFrac: 0,
    recoilPx: 0,
    arcAmplitude: 0,
    squashTiming: 'none',
    squashAmplitude: 0,
    jitterPx: 0,
  },
  drift: {
    anticipationFrac: 0,
    anticipationPx: 0,
    recoilFrac: 0,
    recoilPx: 0,
    arcAmplitude: 0,
    squashTiming: 'none',
    squashAmplitude: 0,
    jitterPx: 0,
  },
  stomp: {
    anticipationFrac: 0,
    anticipationPx: 0,
    recoilFrac: 0,
    recoilPx: 0,
    arcAmplitude: 0,
    squashTiming: 'none',
    squashAmplitude: 0,
    jitterPx: 0,
  },
  lurch: {
    anticipationFrac: 0,
    anticipationPx: 0,
    recoilFrac: 0,
    recoilPx: 0,
    arcAmplitude: 0,
    squashTiming: 'none',
    squashAmplitude: 0,
    jitterPx: 0,
  },
} as const;

export function getMoveStyleProfile(style: MoveAnimStyle): MoveStyleProfile {
  return MOVE_STYLE_PROFILES[style];
}

export function applyMoveStyleEasing(
  style: MoveAnimStyle,
  progress: number,
  walkPhase: WalkMotionPhase = 'single',
): number {
  const p = Math.min(Math.max(progress, 0), 1);

  switch (style) {
    case 'step':
      return applyStepWalkEasing(walkPhase, p);
    case 'slide':
      return 1 - Math.pow(1 - p, 2);
    case 'dart':
      return p * p * p;
    case 'drift':
      return p < 0.5
        ? 16 * p * p * p * p * p
        : 1 - Math.pow(-2 * p + 2, 5) / 2;
    case 'stomp': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
    case 'lurch':
      return p < 0.25 ? 0 : Math.pow((p - 0.25) / 0.75, 2);
    default:
      return p;
  }
}

export function getMoveArcOffsetPx(
  style: MoveAnimStyle,
  progress: number,
  cellSize: number,
  walkPhase: WalkMotionPhase = 'single',
): number {
  const p = Math.min(Math.max(progress, 0), 1);

  switch (style) {
    case 'step':
      return -Math.sin(applyStepWalkEasing(walkPhase, p) * Math.PI) * Math.min(cellSize * STEP_STRIDE_BOB_FACTOR, 2);
    case 'slide':
      return -Math.sin(p * Math.PI) * 3;
    case 'drift':
      return -Math.sin(p * Math.PI) * 2;
    case 'stomp':
      return p > 0.7 ? Math.sin(((p - 0.7) / 0.3) * Math.PI) * 2 : 0;
    case 'dart':
    case 'lurch':
    default:
      return 0;
  }
}

export function getAnticipationOffsetPx(style: MoveAnimStyle, progress: number): number {
  const profile = getMoveStyleProfile(style);
  if (profile.anticipationFrac <= 0 || profile.anticipationPx <= 0) return 0;
  const p = Math.min(Math.max(progress, 0), 1);
  if (p >= profile.anticipationFrac) return 0;
  return profile.anticipationPx * (1 - (p / profile.anticipationFrac));
}

export function getRecoilOffsetPx(style: MoveAnimStyle, progress: number): number {
  const profile = getMoveStyleProfile(style);
  if (profile.recoilFrac <= 0 || profile.recoilPx <= 0) return 0;
  const p = Math.min(Math.max(progress, 0), 1);
  const recoilStart = 1 - profile.recoilFrac;
  if (p <= recoilStart) return 0;
  const recoilProgress = (p - recoilStart) / profile.recoilFrac;
  return profile.recoilPx * Math.sin(recoilProgress * Math.PI);
}

export function getSquashStretchScale(
  style: MoveAnimStyle,
  progress: number,
  walkPhase: WalkMotionPhase = 'single',
): Scale {
  if (style === 'step') {
    return getStepStrideScale(progress, walkPhase);
  }

  const profile = getMoveStyleProfile(style);
  const p = Math.min(Math.max(progress, 0), 1);
  let scaleX = 1;
  let scaleY = 1;

  if (profile.anticipationScaleY !== undefined && p < profile.anticipationFrac) {
    scaleY = Math.min(scaleY, profile.anticipationScaleY);
  }

  if (profile.squashTiming !== 'none' && profile.squashAmplitude > 0) {
    const pulse = profile.squashTiming === 'mid'
      ? Math.sin(p * Math.PI)
      : getLandingPulse(p, profile.recoilFrac);
    scaleX = Math.max(scaleX, 1 + pulse * profile.squashAmplitude);
    scaleY = Math.min(scaleY, 1 - pulse * profile.squashAmplitude);
  }

  if (profile.recoilScaleY !== undefined && profile.recoilFrac > 0) {
    const recoilStart = 1 - profile.recoilFrac;
    if (p > recoilStart) {
      const recoilProgress = (p - recoilStart) / profile.recoilFrac;
      const pulse = Math.sin(recoilProgress * Math.PI);
      scaleY = Math.min(scaleY, 1 - ((1 - profile.recoilScaleY) * pulse));
      scaleX = Math.max(scaleX, 1 + ((1 - profile.recoilScaleY) * pulse));
    }
  }

  if (profile.smearScaleX !== undefined && p >= 0.75) {
    scaleX = Math.max(scaleX, profile.smearScaleX);
  }

  return { scaleX, scaleY };
}

export function getJitterOffsetPx(style: MoveAnimStyle, progress: number, seed: string | number): number {
  const profile = getMoveStyleProfile(style);
  if (profile.jitterPx <= 0 || profile.anticipationFrac <= 0) return 0;
  const p = Math.min(Math.max(progress, 0), 1);
  if (p >= profile.anticipationFrac) return 0;

  const phase = hashSeed(seed) + Math.floor(p * 80);
  return phase % 2 === 0 ? profile.jitterPx : -profile.jitterPx;
}

export function getMoveTravelOffsetPx(
  move: MoveTravelInput,
  cellSize: number,
): Point {
  const t = applyMoveStyleEasing(move.style, move.progress, move.walkPhase);
  const fromOffsetPx = move.fromOffsetPx ?? { x: 0, y: 0 };

  return {
    x: ((move.fromPos.x - move.toPos.x) * cellSize * (1 - t)) + (fromOffsetPx.x * (1 - t)),
    y: ((move.fromPos.y - move.toPos.y) * cellSize * (1 - t)) + (fromOffsetPx.y * (1 - t)),
  };
}

export function getMoveRenderedOffsetPx(
  move: MoveTravelInput,
  cellSize: number,
  seed: string | number = 0,
): Point {
  const offset = getMoveTravelOffsetPx(move, cellSize);
  const p = Math.min(Math.max(move.progress, 0), 1);
  const unit = getTravelUnitVector(move.fromPos, move.toPos);
  const anticipationPx = getAnticipationOffsetPx(move.style, p);
  const recoilPx = getRecoilOffsetPx(move.style, p);

  return {
    x: offset.x - (unit.x * anticipationPx) + (unit.x * recoilPx) + getJitterOffsetPx(move.style, p, seed),
    y: offset.y - (unit.y * anticipationPx) + (unit.y * recoilPx) + getMoveArcOffsetPx(move.style, p, cellSize, move.walkPhase),
  };
}

function getLandingPulse(progress: number, recoilFrac: number): number {
  if (recoilFrac <= 0) return 0;
  const recoilStart = 1 - recoilFrac;
  if (progress <= recoilStart) return 0;
  const recoilProgress = (progress - recoilStart) / recoilFrac;
  return Math.sin(recoilProgress * Math.PI);
}

function applyStepWalkEasing(walkPhase: WalkMotionPhase, progress: number): number {
  switch (walkPhase) {
    case 'start':
      return progress < STEP_WALK_ENTRY_PROGRESS
        ? getStepEntryProgress(progress)
        : progress;
    case 'middle':
      return progress;
    case 'end':
      return progress > STEP_WALK_EXIT_PROGRESS
        ? getStepExitProgress(progress)
        : progress;
    case 'single':
    default:
      if (progress < STEP_WALK_ENTRY_PROGRESS) {
        return getStepEntryProgress(progress);
      }
      if (progress > STEP_WALK_EXIT_PROGRESS) {
        return getStepExitProgress(progress);
      }
      return progress;
  }
}

function getStepEntryProgress(progress: number): number {
  const normalized = progress / STEP_WALK_ENTRY_PROGRESS;
  return STEP_WALK_ENTRY_PROGRESS * (normalized * normalized * (2 - normalized));
}

function getStepExitProgress(progress: number): number {
  const exitWindow = 1 - STEP_WALK_EXIT_PROGRESS;
  const normalized = (progress - STEP_WALK_EXIT_PROGRESS) / exitWindow;
  return STEP_WALK_EXIT_PROGRESS
    + (exitWindow * (normalized + (normalized * normalized) - (normalized * normalized * normalized)));
}

function getStepStrideScale(progress: number, walkPhase: WalkMotionPhase): Scale {
  const easedProgress = applyStepWalkEasing(walkPhase, progress);
  const stridePulse = Math.sin(easedProgress * Math.PI) * STEP_STRIDE_SCALE;
  return {
    scaleX: 1 - stridePulse,
    scaleY: 1 + stridePulse,
  };
}

function getTravelUnitVector(fromPos: Point, toPos: Point): Point {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  return {
    x: dx / length,
    y: dy / length,
  };
}

function hashSeed(seed: string | number): number {
  const value = String(seed);
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
