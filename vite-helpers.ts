import fs from 'fs';
import type { Plugin } from 'vite';

const existsCache = new Map<string, boolean>();

function cachedExists(path: string): boolean {
  let result = existsCache.get(path);
  if (result === undefined) {
    result = fs.existsSync(path);
    existsCache.set(path, result);
  }
  return result;
}

/**
 * Vite plugin to handle .js → .ts extension conversion for workspace packages.
 * Operates after path alias resolution to find actual TypeScript files.
 */
export function createJsToTsResolvePlugin(): Plugin {
  return {
    name: 'vite-js-to-ts-resolve',
    enforce: 'post' as const,
    resolveId(id: string) {
      // Only handle resolved file paths that end in .js
      if (!id.endsWith('.js') || !cachedExists(id)) {
        return null;
      }

      // Try replacing .js with .ts
      const tsPath = id.slice(0, -3) + '.ts';
      if (cachedExists(tsPath)) {
        return tsPath;
      }

      return null;
    },
  };
}



