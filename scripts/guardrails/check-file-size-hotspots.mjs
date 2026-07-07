import {
  formatFailures,
  isCliMain,
  loadConfig,
  normalizePath,
  parseArgs,
  readText,
  resolveRoot,
  walkFiles,
} from './common.mjs';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import defaultConfig from './file-size-hotspots.config.mjs';

function isSourceFile(relativePath) {
  return /\.([jt]sx?|m[jt]s|c[jt]s)$/.test(relativePath);
}

function isExcluded(relativePath, excludePatterns) {
  return excludePatterns.some((pattern) => pattern.test(relativePath));
}

function isAllowlisted(relativePath, allowlistedFiles) {
  const normalized = normalizePath(relativePath);
  return allowlistedFiles.some((entry) => normalizePath(entry.path) === normalized);
}

function validateAllowlistEntries(rootDir, config) {
  const failures = [];

  for (const entry of config.allowlistedFiles) {
    const { path, reason, lines } = entry;
    const absolutePath = join(rootDir, path);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      failures.push(
        `Allowlist entry '${path}' does not exist in the repository`,
      );
      continue;
    }

    // Check if it's a source file
    if (!isSourceFile(path)) {
      failures.push(
        `Allowlist entry '${path}' is not a source file (.js, .ts, .jsx, .tsx)`,
      );
      continue;
    }

    // Check if it's excluded by excludePatterns (dead entry)
    if (isExcluded(path, config.excludePatterns)) {
      failures.push(
        `Allowlist entry '${path}' is excluded by excludePatterns (pattern: ${config.excludePatterns.find((p) => p.test(path))}) — remove from allowlist`,
      );
      continue;
    }

    // Get current line count
    const source = readText(rootDir, path);
    const lineCount = source.split('\n').length;

    // Check if it actually exceeds the budget
    if (lineCount <= config.maxLinesPerFile) {
      failures.push(
        `Allowlist entry '${path}' is ${lineCount} lines, below the ${config.maxLinesPerFile}-line budget — remove from allowlist`,
      );
      continue;
    }

    // Check if lines field is present and within tolerance of the actual count (prevent stale metadata).
    // A percentage tolerance lets an allowlisted file drift a little before the number must be re-pinned,
    // so small edits don't force a metadata bump on every change.
    if (typeof lines === 'number') {
      const rawTolerance = config.linesTolerancePercent;
      const tolerancePercent =
        typeof rawTolerance === 'number' && Number.isFinite(rawTolerance) && rawTolerance > 0
          ? rawTolerance
          : 0;
      const allowedDrift = Math.ceil((lines * tolerancePercent) / 100);
      if (Math.abs(lineCount - lines) > allowedDrift) {
        failures.push(
          `Allowlist entry '${path}' has stale lines metadata: declared ${lines}, actual ${lineCount} ` +
          `(allowed drift ±${allowedDrift} at ${tolerancePercent}%) — update to match`,
        );
        continue;
      }
    }

    // Check if reason is non-empty
    if (!reason || reason.trim() === '') {
      failures.push(
        `Allowlist entry '${path}' has an empty reason — provide justification or remove`,
      );
      continue;
    }
  }

  return failures;
}

function discoverSourceRoots(rootDir) {
  const roots = [];

  // Discover all apps/*/src directories
  try {
    const appsDir = join(rootDir, 'apps');
    const apps = readdirSync(appsDir);
    for (const app of apps) {
      roots.push(join('apps', app, 'src'));
    }
  } catch {
    // apps directory may not exist in all contexts
  }

  // Discover all packages/*/src directories
  try {
    const packagesDir = join(rootDir, 'packages');
    const packages = readdirSync(packagesDir);
    for (const pkg of packages) {
      roots.push(join('packages', pkg, 'src'));
    }
  } catch {
    // packages directory may not exist in all contexts
  }

  // Always include scripts root
  roots.push('scripts');

  return roots;
}

export function checkFileSizeHotspots(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const failures = [];

  // Validate that allowlist entries are current and correct
  failures.push(...validateAllowlistEntries(rootDir, config));

  // Use explicit includedRoots if provided; otherwise auto-discover
  const includedRoots = config.includedRoots ?? discoverSourceRoots(rootDir);

  // Collect all files in included roots
  const allFiles = [];
  for (const root of includedRoots) {
    allFiles.push(...walkFiles(rootDir, { startRelativePath: root }));
  }

  // Filter to source files, exclude tests/generated/etc, and check size
  const filesToCheck = allFiles.filter(
    (relativePath) =>
      isSourceFile(relativePath) &&
      !isExcluded(relativePath, config.excludePatterns) &&
      !isAllowlisted(relativePath, config.allowlistedFiles),
  );

  for (const relativePath of filesToCheck) {
    const source = readText(rootDir, relativePath);
    const lineCount = source.split('\n').length;

    if (lineCount > config.maxLinesPerFile) {
      failures.push(
        `${relativePath} exceeds ${config.maxLinesPerFile}-line budget (${lineCount} lines); ` +
        `add allowlist entry to file-size-hotspots.config.mjs with audit rationale or split the file`,
      );
    }
  }

  return failures;
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config, defaultConfig);
  const failures = checkFileSizeHotspots({ rootDir: args.root, config });
  if (failures.length > 0) {
    console.error(formatFailures('File-size hotspot guardrail', failures));
    process.exit(1);
  }
  console.log('File-size hotspot guardrail passed.');
}
