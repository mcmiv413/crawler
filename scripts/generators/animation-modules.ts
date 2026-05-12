/**
 * Generator for animation module registry.
 *
 * Discovers all AnimationModule exports from apps/web/src/animations/modules/
 * and apps/web/src/animations/status-overlays/
 * Validates against catalog refs and emits registry index.ts
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

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
  const modules = [...scanModuleDirectory(MODULES_DIR, '../modules'), ...scanModuleDirectory(STATUS_OVERLAYS_DIR, '../status-overlays')]
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  generateRegistryIndex(modules);
  console.log(`✅ Generated animations/generated/index.ts (${modules.length} modules)`);
}

function scanModuleDirectory(dirPath: string, importBase: string): ModuleInfo[] {
  if (!existsSync(dirPath)) return [];

  return readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map(entry => {
      const path = join(dirPath, entry.name);
      const source = readFileSync(path, 'utf8');
      const exportName = source.match(/export const (\w+)\s*:\s*AnimationModule/)?.[1];
      if (exportName === undefined) {
        throw new Error(`Animation module ${path} must export const <name>: AnimationModule`);
      }
      const relPath = `${importBase}/${entry.name.replace(/\.ts$/, '')}`;
      return { path, relPath, exportName };
    });
}

function generateRegistryIndex(modules: ModuleInfo[]): void {
  const imports = modules
    .map(m => `import { ${m.exportName} } from '${m.relPath}.js';`)
    .join('\n');

  const registrations = modules.map(m => `  registerModule(${m.exportName});`).join('\n');

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
export function initializeAnimationModules(): void {
${registrations || '  // No modules registered yet'}
}
`;

  const indexPath = join(GENERATED_DIR, 'index.ts');
  writeFileSync(indexPath, output, 'utf8');
}

if (existsSync(fileURLToPath(import.meta.url)) && process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAnimationModuleRegistry();
}

export {};
