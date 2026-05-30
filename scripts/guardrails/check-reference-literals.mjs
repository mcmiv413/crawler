import {
  extractStringLiterals,
  formatFailures,
  isCliMain,
  lineNumberAt,
  loadConfig,
  matchesAnyPrefix,
  matchesAnyRegex,
  parseArgs,
  readText,
  resolveRoot,
  stripComments,
  walkFiles,
} from './common.mjs';
import defaultConfig from './reference-literals.config.mjs';

function collectPatternMatches(source, pattern) {
  const stripped = stripComments(source);
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const matches = [];
  let match;

  while ((match = matcher.exec(stripped)) !== null) {
    const value = match.groups?.value ?? match[1];
    if (typeof value === 'string' && value.length > 0) {
      matches.push({
        value,
        index: match.index,
        source: stripped,
      });
    }

    if (match[0].length === 0) {
      matcher.lastIndex += 1;
    }
  }

  return matches;
}

function collectDeclaredLiterals(rootDir, configEntry) {
  const declared = new Set();
  const sourceFiles = walkFiles(rootDir)
    .filter((relativePath) => matchesAnyPrefix(relativePath, configEntry.sourceRoots))
    .filter((relativePath) => /\.[jt]sx?$/.test(relativePath));

  for (const relativePath of sourceFiles) {
    const source = readText(rootDir, relativePath);
    if (configEntry.sourcePattern instanceof RegExp) {
      for (const match of collectPatternMatches(source, configEntry.sourcePattern)) {
        declared.add(match.value);
      }
      continue;
    }

    for (const literal of extractStringLiterals(source)) {
      configEntry.literalPattern.lastIndex = 0;
      if (configEntry.literalPattern.test(literal.value)) {
        declared.add(literal.value);
      }
    }
  }

  return declared;
}

function isAllowedPath(relativePath, configEntry) {
  return matchesAnyPrefix(relativePath, [
    ...(configEntry.allowedDeclarationRoots ?? []),
    ...(configEntry.allowedContractRoots ?? []),
    ...(configEntry.allowedFixtureRoots ?? []),
  ]) || matchesAnyRegex(relativePath, configEntry.allowedFilePatterns ?? []);
}

export function checkReferenceLiterals(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const failures = [];

  for (const configEntry of config) {
    const declaredLiterals = collectDeclaredLiterals(rootDir, configEntry);
    const files = walkFiles(rootDir)
      .filter((relativePath) => matchesAnyPrefix(relativePath, configEntry.implementationRoots))
      .filter((relativePath) => /\.[jt]sx?$/.test(relativePath))
      .filter((relativePath) => isAllowedPath(relativePath, configEntry) === false);

    for (const relativePath of files) {
      const source = readText(rootDir, relativePath);
      if (configEntry.implementationPattern instanceof RegExp) {
        for (const match of collectPatternMatches(source, configEntry.implementationPattern)) {
          if (declaredLiterals.has(match.value) === false) continue;
          failures.push(
            `${relativePath}:${lineNumberAt(match.source, match.index)} copies ${configEntry.name} literal "${match.value}"; import ${configEntry.sourceExport} and dot-walk the source-of-truth ref`,
          );
        }
        continue;
      }

      for (const literal of extractStringLiterals(source)) {
        if (declaredLiterals.has(literal.value) === false) continue;
        failures.push(
          `${relativePath}:${lineNumberAt(source, literal.index)} copies ${configEntry.name} literal "${literal.value}"; import ${configEntry.sourceExport} and dot-walk the source-of-truth ref`,
        );
      }
    }
  }

  return failures;
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config, defaultConfig);
  const failures = checkReferenceLiterals({ rootDir: args.root, config });
  if (failures.length > 0) {
    console.error(formatFailures('Reference literal guardrail', failures));
    process.exit(1);
  }
  console.log('Reference literal guardrail passed.');
}
