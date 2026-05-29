/**
 * Lifecycle contract tests for all aoe Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { bombBlast } from './bomb-blast.js';
import { cleaveArc } from './cleave-arc.js';
import { shatterBurst } from './shatter-burst.js';
import { cinderWake } from './cinder-wake.js';

describe('bombBlast', () => { runThreeAnimationContract(bombBlast); });
describe('cleaveArc (aoe)', () => { runThreeAnimationContract(cleaveArc); });
describe('shatterBurst (aoe)', () => { runThreeAnimationContract(shatterBurst); });
describe('cinderWake', () => { runThreeAnimationContract(cinderWake); });
