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
import defaultConfig from './event-literals.config.mjs';

function isAllowedFile(relativePath, configEntry) {
  const normalized = normalizePath(relativePath);
  return (configEntry.allowedFiles ?? []).map(normalizePath).includes(normalized) ||
    matchesAnyRegex(normalized, configEntry.allowedFilePatterns ?? []);
}

/**
 * Domain events with a central factory must not be constructed as inline object
 * literals (`type: 'STATUS_APPLIED'`, ...) outside the factory module. Inline
 * literals are how the weapon on-hit burn path drifted from the ability path.
 */
export function checkEventLiterals(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const failures = [];
  const allFiles = walkFiles(rootDir).filter((relativePath) => /\.[jt]sx?$/.test(relativePath));

  for (const configEntry of config) {
    const files = allFiles
      .filter((relativePath) => matchesAnyPrefix(relativePath, configEntry.protectedSurfaces))
      .filter((relativePath) => isAllowedFile(relativePath, configEntry) === false);

    for (const relativePath of files) {
      const stripped = stripComments(readText(rootDir, relativePath));

      for (const eventType of configEntry.eventTypes) {
        const pattern = new RegExp(`\\btype:\\s*['"]${eventType}['"]`, 'g');
        let match;
        while ((match = pattern.exec(stripped)) !== null) {
          failures.push(
            `${relativePath}:${lineNumberAt(stripped, match.index)} builds ${eventType} inline; use the ${configEntry.name} factory in ${configEntry.factoryModule}`,
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
  const failures = checkEventLiterals({ rootDir: args.root, config });
  if (failures.length > 0) {
    console.error(formatFailures('Event literal guardrail', failures));
    process.exit(1);
  }
  console.log('Event literal guardrail passed.');
}
