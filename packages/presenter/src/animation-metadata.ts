import { animationRefs, STATUS_DEFINITIONS } from '@dungeon/content';
import type {
  ConsumableAnimationPresentationView,
  MoveAnimStyle,
  StatusPresentationView,
} from './game-view.js';

export type ConsumableAnimationEffect = 'heal' | 'buff' | 'cure' | 'damage';

export const ANIMATION_TIMING = {
  moveStaggerMs: 120,
} as const;

export const MOVE_ANIMATION_DURATIONS: Readonly<Record<MoveAnimStyle, number>> = {
  step: 140,
  slide: 180,
  dart: 150,
  drift: 240,
  stomp: 200,
  lurch: 220,
} as const;

export const BUMP_ANIMATION_DURATION_MS = 300;
export const BUMP_IMPACT_FRACTION = 0.5;

/** Default fraction of an animation's duration at which the impact frame lands. */
export const IMPACT_FRAME_FRACTION = 0.6;
/** Default fraction of an animation's duration spent recovering after impact. */
export const RECOVERY_FRACTION = 0.4;
/** Progress fraction at which the bomb-blast damage animation detonates. */
export const BOMB_DETONATE_AT_PROGRESS = 0.35;

const MOVEMENT_BEHAVIOR_STYLES: Readonly<Record<string, MoveAnimStyle>> = {
  wall_stalker: 'dart',
  rearline_anchor: 'drift',
  chokepoint_holder: 'stomp',
  ambush_idle: 'lurch',
} as const;

const ARCHETYPE_STYLE_RULES: readonly {
  readonly style: MoveAnimStyle;
  readonly matches: readonly string[];
}[] = [
  { style: 'dart', matches: ['rogue', 'shadow', 'assassin'] },
  { style: 'drift', matches: ['mage', 'ranged', 'archer'] },
  { style: 'stomp', matches: ['brute', 'guardian', 'tank'] },
  { style: 'lurch', matches: ['horror', 'beast', 'lurker'] },
] as const;

const ENABLE_ENEMY_MOVE_STYLE_OVERRIDES = false;

export const CONSUMABLE_ANIMATION_METADATA: Readonly<Record<ConsumableAnimationEffect, ConsumableAnimationPresentationView>> = {
  heal: {
    kind: 'heal_hearts',
    durationMs: 700,
  },
  buff: {
    kind: 'buff_rings',
    durationMs: 600,
  },
  cure: {
    kind: 'cure_sparkles',
    durationMs: 500,
  },
  damage: {
    kind: 'bomb_blast',
    durationMs: 900,
    detonateAtProgress: BOMB_DETONATE_AT_PROGRESS,
    armSpriteName: 'fire bomb',
    blastOffsets: [
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ],
    blastSpriteNames: [
      'fire burst c',
      'fire burst n',
      'fire burst ne',
      'fire burst e',
      'fire burst se',
      'fire burst s',
      'fire burst sw',
      'fire burst w',
      'fire burst nw',
    ],
  },
} as const;

export const PLAYER_STATUS_PRESENTATION: Readonly<Record<string, StatusPresentationView>> = {
  strength: {
    animationId: animationRefs.status.goldRingPulse.id,
    entityScale: 1.35,
    ring: {
      colorRgb: '255, 200, 0',
      alphaBase: 0.35,
      alphaAmplitude: 0.45,
      pulsePeriodMs: 180,
      lineWidth: 1.5,
      paddingPx: 2,
    },
  },
  heat_surge: {
    animationId: animationRefs.status.heatSurgeRing.id,
    entityScale: 1.25,
    ring: {
      colorRgb: '255, 96, 32',
      alphaBase: 0.28,
      alphaAmplitude: 0.42,
      pulsePeriodMs: 160,
      lineWidth: 1.5,
      paddingPx: 2,
    },
  },
  arcane_charge: {
    animationId: animationRefs.status.arcaneChargeRing.id,
    entityScale: 1.18,
    ring: {
      colorRgb: '74, 163, 255',
      alphaBase: 0.24,
      alphaAmplitude: 0.36,
      pulsePeriodMs: 220,
      lineWidth: 1.5,
      paddingPx: 2,
    },
  },
} as const;

export function getBeatSettleMs(timing: {
  readonly durationMs: number;
  readonly impactFrameMs?: number;
  readonly recoveryMs?: number;
  readonly hitStopMs?: number;
}): number {
  const impactFrameMs = timing.impactFrameMs ?? Math.floor(timing.durationMs * IMPACT_FRAME_FRACTION);
  const recoveryMs = timing.recoveryMs ?? Math.floor(timing.durationMs * RECOVERY_FRACTION);
  return Math.max(timing.durationMs, impactFrameMs + recoveryMs) + (timing.hitStopMs ?? 0);
}

export function getMoveDurationMs(style: MoveAnimStyle): number {
  return MOVE_ANIMATION_DURATIONS[style];
}

export function getMoveAnimationStyle(args: {
  readonly isPlayer: boolean;
  readonly movementBehaviorId?: string;
  readonly archetype?: string;
}): MoveAnimStyle {
  if (args.isPlayer) return 'step';

  return resolveEnemyMoveAnimationStyleOverride(args) ?? 'step';
}

function resolveEnemyMoveAnimationStyleOverride(args: {
  readonly movementBehaviorId?: string;
  readonly archetype?: string;
}): MoveAnimStyle | undefined {
  if (!ENABLE_ENEMY_MOVE_STYLE_OVERRIDES) {
    return undefined;
  }

  const behaviorStyle = args.movementBehaviorId === undefined
    ? undefined
    : MOVEMENT_BEHAVIOR_STYLES[args.movementBehaviorId];
  if (behaviorStyle !== undefined) return behaviorStyle;

  const archetype = args.archetype?.toLowerCase() ?? '';
  for (const rule of ARCHETYPE_STYLE_RULES) {
    if (rule.matches.some((candidate) => archetype.includes(candidate))) {
      return rule.style;
    }
  }

  return undefined;
}

export function isConsumableAnimationEffect(effect: string): effect is ConsumableAnimationEffect {
  return effect === 'heal' || effect === 'buff' || effect === 'cure' || effect === 'damage';
}

export function getConsumableAnimationMetadata(effect: string): {
  readonly effect: ConsumableAnimationEffect;
  readonly presentation: ConsumableAnimationPresentationView;
} {
  const resolvedEffect = isConsumableAnimationEffect(effect) ? effect : 'buff';
  return {
    effect: resolvedEffect,
    presentation: CONSUMABLE_ANIMATION_METADATA[resolvedEffect],
  };
}

export function getConsumableBlastPositions(
  playerPos: { readonly x: number; readonly y: number },
  presentation: ConsumableAnimationPresentationView,
): readonly { readonly x: number; readonly y: number }[] {
  return (presentation.blastOffsets ?? []).map((offset) => ({
    x: playerPos.x + offset.x,
    y: playerPos.y + offset.y,
  }));
}

export function getStatusPresentation(statusId: string): StatusPresentationView | undefined {
  const presentation = PLAYER_STATUS_PRESENTATION[statusId];
  if (presentation === undefined) {
    return undefined;
  }

  const overlayId = STATUS_DEFINITIONS.get(statusId)?.overlay?.id;
  if (overlayId === undefined) {
    return presentation;
  }

  if (presentation.animationId === overlayId) {
    return presentation;
  }

  return {
    ...presentation,
    animationId: overlayId,
  };
}
