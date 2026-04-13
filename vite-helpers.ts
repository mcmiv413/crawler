import fs from 'fs';

/**
 * Vite plugin to handle .js → .ts extension conversion for workspace packages.
 * Operates after path alias resolution to find actual TypeScript files.
 */
export function createJsToTsResolvePlugin() {
  return {
    name: 'vite-js-to-ts-resolve',
    enforce: 'post',
    resolveId(id: string) {
      // Only handle resolved file paths that end in .js
      if (!id.endsWith('.js') || !fs.existsSync(id)) {
        return null;
      }

      // Try replacing .js with .ts
      const tsPath = id.slice(0, -3) + '.ts';
      if (fs.existsSync(tsPath)) {
        return tsPath;
      }

      return null;
    },
  };
}



