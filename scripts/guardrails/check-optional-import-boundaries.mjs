import { extname } from 'node:path';
import {
  formatFailures,
  isCliMain,
  loadConfig,
  matchesAnyPrefix,
  normalizePath,
  parseArgs,
  readText,
  resolveImportPath,
  resolveRoot,
  stripComments,
} from './common.mjs';
import defaultConfig from './optional-import-boundaries.config.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function extractStaticImports(source) {
  const stripped = stripComments(source);
  const imports = [];
  const importRegex = /\bimport\s+(?!type\b)(?!\s*\()(?:(?:[\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g;
  const exportRegex = /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(stripped)) !== null) {
    imports.push(match[1]);
  }
  while ((match = exportRegex.exec(stripped)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function specifierMatchesForbiddenPackage(specifier, forbiddenPackage) {
  return specifier === forbiddenPackage || specifier.startsWith(`${forbiddenPackage}/`);
}

function checkEntry(rootDir, entryModule, configEntry) {
  const failures = [];
  const visited = new Set();
  const stack = [{ relativePath: normalizePath(entryModule), chain: [normalizePath(entryModule)] }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current.relativePath)) continue;
    visited.add(current.relativePath);

    if (SOURCE_EXTENSIONS.has(extname(current.relativePath)) === false) continue;

    const source = readText(rootDir, current.relativePath);
    const staticImports = extractStaticImports(source);

    for (const specifier of staticImports) {
      const forbiddenPackage = configEntry.forbiddenPackages.find((pkg) =>
        specifierMatchesForbiddenPackage(specifier, pkg),
      );
      if (forbiddenPackage) {
        failures.push(
          `${current.relativePath}: static import of optional package "${specifier}" from ${configEntry.name}; chain ${current.chain.join(' -> ')}`,
        );
        continue;
      }

      const resolved = resolveImportPath(rootDir, current.relativePath, specifier);
      if (!resolved) continue;

      const crossesIntoOptionalRoot =
        matchesAnyPrefix(current.relativePath, configEntry.optionalRoots) === false &&
        matchesAnyPrefix(resolved, configEntry.optionalRoots);

      if (crossesIntoOptionalRoot) {
        failures.push(
          `${current.relativePath}: static import reaches optional root "${resolved}" from ${configEntry.name}; use a gated dynamic import`,
        );
        continue;
      }

      if (matchesAnyPrefix(resolved, configEntry.optionalRoots) === false) {
        stack.push({ relativePath: resolved, chain: [...current.chain, resolved] });
      }
    }
  }

  return failures;
}

export function checkOptionalImportBoundaries(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const failures = [];

  for (const configEntry of config) {
    for (const entryModule of configEntry.entryModules) {
      failures.push(...checkEntry(rootDir, entryModule, configEntry));
    }
  }

  return failures;
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config, defaultConfig);
  const failures = checkOptionalImportBoundaries({ rootDir: args.root, config });
  if (failures.length > 0) {
    console.error(formatFailures('Optional import boundary guardrail', failures));
    process.exit(1);
  }
  console.log('Optional import boundary guardrail passed.');
}
