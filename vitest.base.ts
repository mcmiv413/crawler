/**
 * Shared Vitest base configuration for packages.
 * Re-exported by individual vitest.config.ts files to maintain consistency.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createJsToTsResolvePlugin } from './vite-helpers.js';

interface BaseVitestConfigOptions {
  include?: string[];
  exclude?: string[];
  environment?: string;
  setupFiles?: string[];
  resolve?: Record<string, any>;
}

export function createBaseVitestConfig(options?: BaseVitestConfigOptions): ReturnType<typeof defineConfig> {
  const baseTsconfig = fileURLToPath(new URL('./tsconfig.base.json', import.meta.url));
  const config: any = {
    test: {
      globals: true,
      include: options?.include ?? ['src/**/*.test.ts'],
    },
    plugins: [tsconfigPaths({ projects: [baseTsconfig] }), createJsToTsResolvePlugin()],
  };

  if (options?.exclude) {
    config.test.exclude = options.exclude;
  }

  if (options?.environment) {
    config.test.environment = options.environment;
  }

  if (options?.setupFiles) {
    config.test.setupFiles = options.setupFiles;
  }

  if (options?.resolve) {
    config.resolve = options.resolve;
  }

  return defineConfig(config);
}
