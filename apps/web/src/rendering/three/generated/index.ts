/**
 * Auto-generated Three.js animation module registry.
 * DO NOT EDIT — run pnpm generate:indexes to regenerate.
 *
 * Registers all Three animation modules at runtime.
 * The overlay uses getAnimationModule(animationId) to look up implementations.
 */

import { registerAnimationModule } from '../three-animation-registry.js';
import { bombBlast } from '../modules/aoe/bomb-blast.js';
import { cinderWake } from '../modules/aoe/cinder-wake.js';
import { cleaveArc as aoeCleaveArc } from '../modules/aoe/cleave-arc.js';
import { shatterBurst as aoeShatterBurst } from '../modules/aoe/shatter-burst.js';
import { bleedingStrike } from '../modules/impact/bleeding-strike.js';
import { cleaveArc as impactCleaveArc } from '../modules/impact/cleave-arc.js';
import { disarmStrike } from '../modules/impact/disarm-strike.js';
import { executionStrike } from '../modules/impact/execution-strike.js';
import { forwardSlash } from '../modules/impact/forward-slash.js';
import { radialImpactBurst } from '../modules/impact/radial-impact-burst.js';
import { riposteGlint } from '../modules/impact/riposte-glint.js';
import { shatterBurst as impactShatterBurst } from '../modules/impact/shatter-burst.js';
import { staggerShockwave } from '../modules/impact/stagger-shockwave.js';
import { arrowVolley } from '../modules/projectile/arrow-volley.js';
import { emberBolt } from '../modules/projectile/ember-bolt.js';
import { singleArrow } from '../modules/projectile/single-arrow.js';
import { cureSparkle } from '../modules/self/cure-sparkle.js';
import { healingPulse } from '../modules/self/healing-pulse.js';
import { heatSurgeAura } from '../modules/self/heat-surge-aura.js';
import { secondWindBuff } from '../modules/self/second-wind-buff.js';
import { staminaSurge } from '../modules/self/stamina-surge.js';
import { goldRingPulse } from '../modules/status/gold-ring-pulse.js';
import { trapPlacement } from '../modules/utility/trap-placement.js';
import { trapSpark } from '../modules/utility/trap-spark.js';

// Register all modules
export function initializeThreeAnimationModules(): void {
  registerAnimationModule(bombBlast);
  registerAnimationModule(cinderWake);
  registerAnimationModule(aoeCleaveArc);
  registerAnimationModule(aoeShatterBurst);
  registerAnimationModule(bleedingStrike);
  registerAnimationModule(impactCleaveArc);
  registerAnimationModule(disarmStrike);
  registerAnimationModule(executionStrike);
  registerAnimationModule(forwardSlash);
  registerAnimationModule(radialImpactBurst);
  registerAnimationModule(riposteGlint);
  registerAnimationModule(impactShatterBurst);
  registerAnimationModule(staggerShockwave);
  registerAnimationModule(arrowVolley);
  registerAnimationModule(emberBolt);
  registerAnimationModule(singleArrow);
  registerAnimationModule(cureSparkle);
  registerAnimationModule(healingPulse);
  registerAnimationModule(heatSurgeAura);
  registerAnimationModule(secondWindBuff);
  registerAnimationModule(staminaSurge);
  registerAnimationModule(goldRingPulse);
  registerAnimationModule(trapPlacement);
  registerAnimationModule(trapSpark);
}
