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
  walkFiles,
} from './common.mjs';
import defaultConfig from './reference-literals.config.mjs';

function collectDeclaredLiterals(rootDir, configEntry) {
  const declared = new Set();
  const sourceFiles = walkFiles(rootDir)
    .filter((relativePath) => matchesAnyPrefix(relativePath, configEntry.sourceRoots))
    .filter((relativePath) => /\.[jt]sx?$/.test(relativePath));

  for (const relativePath of sourceFiles) {
    const source = readText(rootDir, relativePath);
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
