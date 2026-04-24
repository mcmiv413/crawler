import type { WeaponType } from '@dungeon/contracts';
import { powerStrike } from './power-strike.js';
import { secondWind } from './second-wind.js';
import { bladeBleed } from './blade-bleed.js';
import { bladeRiposte } from './blade-riposte.js';
import { bludgeonStagger } from './bludgeon-stagger.js';
import { bludgeonShatter } from './bludgeon-shatter.js';
import { axeCleave } from './axe-cleave.js';
import { axeExecute } from './axe-execute.js';
import { rangedPin } from './ranged-pin.js';
import { rangedVolley } from './ranged-volley.js';
import { daggerDisarm } from './dagger-disarm.js';
import { daggerSetTrap } from './dagger-set-trap.js';

/** Ordered list of abilities granted at each level (index = level) */
export const ABILITY_UNLOCK_BY_LEVEL: Readonly<Record<number, string>> = {
  2: powerStrike.id,
  4: secondWind.id,
} as const;

/** Hit thresholds for weapon mastery tier unlocks (run-scoped) */
export const MASTERY_THRESHOLDS: Record<1 | 2, number> = { 1: 10, 2: 25 };

/** Maps weapon type + tier → ability ID */
export const MASTERY_ABILITIES: Record<WeaponType, Record<1 | 2, string>> = {
  blade:    { 1: bladeBleed.id,      2: bladeRiposte.id    },
  bludgeon: { 1: bludgeonStagger.id, 2: bludgeonShatter.id },
  axe:      { 1: axeCleave.id,       2: axeExecute.id      },
  ranged:   { 1: rangedPin.id,       2: rangedVolley.id    },
  dagger:   { 1: daggerDisarm.id,    2: daggerSetTrap.id   },
};
