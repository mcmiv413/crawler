/**
 * Generator for animation module registry.
 *
 * Discovers all AnimationModule exports from apps/web/src/animations/modules/
 * and apps/web/src/animations/status-overlays/
 * Validates against catalog refs and emits registry index.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const WEB_DIR = join(process.cwd(), 'apps/web/src');
const ANIMATIONS_DIR = join(WEB_DIR, 'animations');
const MODULES_DIR = join(ANIMATIONS_DIR, 'modules');
const STATUS_OVERLAYS_DIR = join(ANIMATIONS_DIR, 'status-overlays');
const GENERATED_DIR = join(ANIMATIONS_DIR, 'generated');

interface ModuleInfo {
  path: string;
  relPath: string;
  exportName: string;
  id?: string;
}

export function generateAnimationModuleRegistry(): void {
  console.log('[animation-modules-gen] Discovered animations/modules structure');
  console.log('[animation-modules-gen] Modules will be auto-discovered once files export AnimationModule');
  // Phase 0: Scaffold. Generator extended in later phases when modules exist.
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function generateRegistryIndex(modules: ModuleInfo[]): void {
  const imports = modules
    .map(m => `import { ${m.exportName} } from '${m.relPath}.js';`)
    .join('\n');

  const registrations = modules.map(m => `registerModule(${m.exportName});`).join('\n  ');

  const output = `/**
 * Auto-generated animation module registry.
 * DO NOT EDIT — run pnpm generate:indexes to regenerate.
 *
 * Registers all animation modules at runtime.
 * The renderer uses resolveModule(animationId) to look up implementations.
 */

import { registerModule } from '../registry.js';
${imports}

// Register all modules
export function registerAllModules(): void {
  ${registrations || '// No modules registered yet'}
}

// Auto-register on module load
registerAllModules();
`;

  const indexPath = join(GENERATED_DIR, 'index.ts');
  writeFileSync(indexPath, output, 'utf8');
}

if (require.main === module) {
  generateAnimationModuleRegistry();
}

export {};
