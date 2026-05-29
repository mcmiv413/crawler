import {
  formatFailures,
  isCliMain,
  lineNumberAt,
  loadConfig,
  matchesAnyPrefix,
  matchesAnyRegex,
  normalizePath,
  parseArgs,
  readText,
  resolveRoot,
  stripComments,
  walkFiles,
} from './common.mjs';
import defaultConfig from './centralized-literals.config.mjs';

function isAllowedFile(relativePath, configEntry) {
  const normalized = normalizePath(relativePath);
  return (configEntry.allowedFiles ?? []).map(normalizePath).includes(normalized) ||
    matchesAnyRegex(normalized, configEntry.allowedFilePatterns ?? []);
}

export function checkCentralizedLiterals(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const failures = [];
  const allFiles = walkFiles(rootDir).filter((relativePath) => /\.[jt]sx?$/.test(relativePath));

  for (const configEntry of config) {
    const files = allFiles
      .filter((relativePath) => matchesAnyPrefix(relativePath, configEntry.protectedSurfaces))
      .filter((relativePath) => isAllowedFile(relativePath, configEntry) === false);

    for (const relativePath of files) {
      const source = readText(rootDir, relativePath);
      const stripped = stripComments(source);

      for (const literal of configEntry.literals) {
        for (const pattern of literal.patterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(stripped);
          if (!match) continue;
          failures.push(
            `${relativePath}:${lineNumberAt(stripped, match.index)} duplicates ${configEntry.name}; import ${literal.exportName} from ${configEntry.ownerModule}`,
          );
        }
      }
    }
  }

  return failures;
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config, defaultConfig);
  const failures = checkCentralizedLiterals({ rootDir: args.root, config });
  if (failures.length > 0) {
    console.error(formatFailures('Centralized literal guardrail', failures));
    process.exit(1);
  }
  console.log('Centralized literal guardrail passed.');
}
