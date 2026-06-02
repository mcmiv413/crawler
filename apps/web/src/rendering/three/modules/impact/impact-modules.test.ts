/**
 * Lifecycle contract tests for all impact Three animation modules.
 * Uses runThreeAnimationContract to verify id, category, create/setPosition/update/dispose.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { radialImpactBurst } from './radial-impact-burst.js';
import { forwardSlash } from './forward-slash.js';
import { cleaveArc } from './cleave-arc.js';
import { executionStrike } from './execution-strike.js';
import { staggerShockwave } from './stagger-shockwave.js';
import { shatterBurst } from './shatter-burst.js';
import { riposteGlint } from './riposte-glint.js';
import { bleedingStrike } from './bleeding-strike.js';
import { disarmStrike } from './disarm-strike.js';
import { lightningStrike } from './lightning-strike.js';

describe('radialImpactBurst', () => { runThreeAnimationContract(radialImpactBurst); });
describe('forwardSlash', () => { runThreeAnimationContract(forwardSlash); });
describe('cleaveArc (impact)', () => { runThreeAnimationContract(cleaveArc); });
describe('executionStrike', () => { runThreeAnimationContract(executionStrike); });
describe('staggerShockwave', () => { runThreeAnimationContract(staggerShockwave); });
describe('shatterBurst (impact)', () => { runThreeAnimationContract(shatterBurst); });
describe('riposteGlint', () => { runThreeAnimationContract(riposteGlint); });
describe('bleedingStrike', () => { runThreeAnimationContract(bleedingStrike); });
describe('disarmStrike', () => { runThreeAnimationContract(disarmStrike); });
describe('lightningStrike', () => { runThreeAnimationContract(lightningStrike); });
