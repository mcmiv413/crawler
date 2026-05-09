/**
 * Auto-generated animation module registry.
 * Imports and registers all animation modules for runtime resolution.
 */

import { registerModule } from '../registry.js';

// Consumables
import { healingPulseModule } from '../modules/healing-pulse.js';
import { staminaSurgeModule } from '../modules/stamina-surge.js';
import { cureSparkleModule } from '../modules/cure-sparkle.js';
import { bombBlastModule } from '../modules/bomb-blast.js';

// Abilities - Impact
import { powerStrikeModule } from '../modules/power-strike.js';
import { bladeBleedModule } from '../modules/blade-bleed.js';
import { bladeRiposteModule } from '../modules/blade-riposte.js';
import { bludgeonShatterModule } from '../modules/bludgeon-shatter.js';
import { bludgeonStaggerModule } from '../modules/bludgeon-stagger.js';
import { daggerDisarmModule } from '../modules/dagger-disarm.js';
import { axeExecuteModule } from '../modules/axe-execute.js';

// Abilities - Projectile
import { rangedPinModule } from '../modules/ranged-pin.js';
import { rangedVolleyModule } from '../modules/ranged-volley.js';

// Abilities - Self
import { secondWindModule } from '../modules/second-wind.js';

// Abilities - AOE
import { axeCleavModule } from '../modules/axe-cleave.js';

// Abilities - Utility
import { daggerSetTrapModule } from '../modules/dagger-set-trap.js';

// Status overlays
import { goldRingPulseModule } from '../status-overlays/gold-ring-pulse.js';

// Register all modules
export function initializeAnimationModules(): void {
  // Consumables
  registerModule(healingPulseModule);
  registerModule(staminaSurgeModule);
  registerModule(cureSparkleModule);
  registerModule(bombBlastModule);

  // Abilities
  registerModule(powerStrikeModule);
  registerModule(bladeBleedModule);
  registerModule(bladeRiposteModule);
  registerModule(bludgeonShatterModule);
  registerModule(bludgeonStaggerModule);
  registerModule(daggerDisarmModule);
  registerModule(axeExecuteModule);
  registerModule(rangedPinModule);
  registerModule(rangedVolleyModule);
  registerModule(secondWindModule);
  registerModule(axeCleavModule);
  registerModule(daggerSetTrapModule);

  // Status
  registerModule(goldRingPulseModule);
}
