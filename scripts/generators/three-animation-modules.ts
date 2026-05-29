/**
 * Generator for Three.js animation module registry.
 *
 * Discovers all ThreeAnimationModule exports from:
 *   apps/web/src/rendering/three/modules/<category>/<name>.ts
 *
 * Validates that every discovered module:
 *   - exports a const named <camelCase> that satisfies ThreeAnimationModule
 *   - has an `id` field matching its location category
 *
 * Emits:
 *   apps/web/src/rendering/three/generated/index.ts
 *
 * The generated file imports each module and registers it via
 * registerAnimationModule() inside initializeThreeAnimationModules().
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const WEB_DIR = join(process.cwd(), 'apps/web/src');
const THREE_DIR = join(WEB_DIR, 'rendering/three');
const MODULES_DIR = join(THREE_DIR, 'modules');
const GENERATED_DIR = join(THREE_DIR, 'generated');

const CATEGORIES = ['impact', 'projectile', 'self', 'aoe', 'status', 'utility'] as const;

interface ModuleInfo {
  /** Full filesystem path */
  readonly path: string;
  /** Import path relative to the generated/index.ts file */
  readonly importPath: string;
  /** Exported const name, e.g. radialImpactBurst */
  readonly exportName: string;
  /** Animation category derived from the directory name */
  readonly category: string;
}

export function generateThreeAnimationModules(): void {
  const modules = discoverModules();
  writeGeneratedIndex(modules);
  console.log(`✅ Generated rendering/three/generated/index.ts (${modules.length} Three modules)`);
}

function discoverModules(): ModuleInfo[] {
  if (!existsSync(MODULES_DIR)) {
    return [];
  }

  const infos: ModuleInfo[] = [];

  for (const category of CATEGORIES) {
    const categoryDir = join(MODULES_DIR, category);
    if (!existsSync(categoryDir)) continue;

    const entries = readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts')) continue;

      const fullPath = join(categoryDir, entry.name);
      const source = readFileSync(fullPath, 'utf8');

      // Look for: export const <name>: ThreeAnimationModule
      const match = source.match(/export const (\w+)\s*:\s*ThreeAnimationModule/);
      if (!match) {
        throw new Error(
          `Three animation module ${fullPath} must export a const satisfying ThreeAnimationModule.\n` +
          `Expected: export const <name>: ThreeAnimationModule<...> = { ... }`,
        );
      }

      const exportName = match[1];
      const baseName = entry.name.replace(/\.ts$/, '');
      // Import path relative to generated/index.ts (one level up, then modules/<category>/<name>)
      const importPath = `../modules/${category}/${baseName}.js`;

      infos.push({ path: fullPath, importPath, exportName, category });
    }
  }

  return infos.sort((a, b) => a.importPath.localeCompare(b.importPath));
}

function writeGeneratedIndex(modules: ModuleInfo[]): void {
  if (!existsSync(GENERATED_DIR)) {
    mkdirSync(GENERATED_DIR, { recursive: true });
  }

  const imports = modules
    .map((m) => `import { ${m.exportName} } from '${m.importPath}';`)
    .join('\n');

  const registrations = modules
    .map((m) => `  registerAnimationModule(${m.exportName});`)
    .join('\n');

  const noModulesComment = modules.length === 0
    ? '  // No modules registered yet — add Three modules under\n  // apps/web/src/rendering/three/modules/ and run pnpm generate:indexes'
    : '';

  const output = `/**
 * Auto-generated Three.js animation module registry.
 * DO NOT EDIT — run pnpm generate:indexes to regenerate.
 *
 * Registers all Three animation modules at runtime.
 * The overlay uses getAnimationModule(animationId) to look up implementations.
 */

import { registerAnimationModule } from '../three-animation-registry.js';
${imports ? imports + '\n' : ''}
// Register all modules
export function initializeThreeAnimationModules(): void {
${registrations || noModulesComment}
}
`;

  const indexPath = join(GENERATED_DIR, 'index.ts');
  writeFileSync(indexPath, output, 'utf8');
}
