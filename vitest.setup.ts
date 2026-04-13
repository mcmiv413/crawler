import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite resolve configuration for monorepo workspace packages.
 * This allows vitest to resolve @dungeon/* packages from their source
 * TypeScript files rather than requiring pre-compiled dist/ folders.
 */
export function getWorkspaceResolveConfig() {
  const packages = [
    'game-contracts',
    'game-core', 
    'content',
    'presenter',
  ];

  const alias: Record<string, string> = {};
  
  for (const pkg of packages) {
    const pkgPath = path.resolve(__dirname, 'packages', pkg, 'src', 'index.ts');
    alias[`@dungeon/${pkg}`] = pkgPath;
    
    // Also handle subpath exports like @dungeon/core/ai/prompt-builders
    alias[`@dungeon/${pkg}/`] = path.resolve(__dirname, 'packages', pkg, 'src') + '/';
  }

  return { alias };
}
