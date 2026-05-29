/**
 * Lifecycle contract tests for all projectile Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { singleArrow } from './single-arrow.js';
import { arrowVolley } from './arrow-volley.js';
import { emberBolt } from './ember-bolt.js';

describe('singleArrow', () => { runThreeAnimationContract(singleArrow); });
describe('arrowVolley', () => { runThreeAnimationContract(arrowVolley); });
describe('emberBolt', () => { runThreeAnimationContract(emberBolt); });
