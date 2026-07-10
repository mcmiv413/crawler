/**
 * Auto-generated animation module registry.
 * DO NOT EDIT — run pnpm generate:indexes to regenerate.
 *
 * Registers all animation modules at runtime.
 * The renderer uses resolveModule(animationId) to look up implementations.
 */

import { registerModule } from '../registry.js';
import { axeCleavModule } from '../modules/axe-cleave.js';
import { axeExecuteModule } from '../modules/axe-execute.js';
import { bladeBleedModule } from '../modules/blade-bleed.js';
import { bladeRiposteModule } from '../modules/blade-riposte.js';
import { bludgeonShatterModule } from '../modules/bludgeon-shatter.js';
import { bludgeonStaggerModule } from '../modules/bludgeon-stagger.js';
import { bombBlastModule } from '../modules/bomb-blast.js';
import { cinderWakeModule } from '../modules/cinder-wake.js';
import { cureSparkleModule } from '../modules/cure-sparkle.js';
import { daggerDisarmModule } from '../modules/dagger-disarm.js';
import { daggerSetTrapModule } from '../modules/dagger-set-trap.js';
import { emberBoltModule } from '../modules/ember-bolt.js';
import { healingPulseModule } from '../modules/healing-pulse.js';
import { heatSurgeAuraModule } from '../modules/heat-surge-aura.js';
import { lightningBoltModule } from '../modules/lightning-bolt.js';
import { lightningStrikeModule } from '../modules/lightning-strike.js';
import { powerStrikeModule } from '../modules/power-strike.js';
import { rangedPinModule } from '../modules/ranged-pin.js';
import { rangedVolleyModule } from '../modules/ranged-volley.js';
import { secondWindModule } from '../modules/second-wind.js';
import { staminaSurgeModule } from '../modules/stamina-surge.js';
import { trapSparkModule } from '../modules/trap-spark.js';
import { goldRingPulseModule } from '../status-overlays/gold-ring-pulse.js';

// Register all modules
export function initializeAnimationModules(): void {
  registerModule(axeCleavModule);
  registerModule(axeExecuteModule);
  registerModule(bladeBleedModule);
  registerModule(bladeRiposteModule);
  registerModule(bludgeonShatterModule);
  registerModule(bludgeonStaggerModule);
  registerModule(bombBlastModule);
  registerModule(cinderWakeModule);
  registerModule(cureSparkleModule);
  registerModule(daggerDisarmModule);
  registerModule(daggerSetTrapModule);
  registerModule(emberBoltModule);
  registerModule(healingPulseModule);
  registerModule(heatSurgeAuraModule);
  registerModule(lightningBoltModule);
  registerModule(lightningStrikeModule);
  registerModule(powerStrikeModule);
  registerModule(rangedPinModule);
  registerModule(rangedVolleyModule);
  registerModule(secondWindModule);
  registerModule(staminaSurgeModule);
  registerModule(trapSparkModule);
  registerModule(goldRingPulseModule);
}
