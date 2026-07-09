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
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import defaultConfig from './file-size-hotspots.config.mjs';

const DEFAULT_BASE_REF = process.env.FILE_SIZE_BASE ?? 'main';
const DEFAULT_CONFIG_RELATIVE_PATH = 'scripts/guardrails/file-size-hotspots.config.mjs';

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

function runGit(repoRoot, args, options = {}) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    if (options.allowFailure === true) {
      return null;
    }
    throw new Error((result.stderr || result.stdout || '').trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function resolveBaseRef(repoRoot, baseRef) {
  const fallbackRef = `origin/${baseRef}`;
  return [baseRef, fallbackRef].find((candidateRef) => {
    const resolved = runGit(repoRoot, ['rev-parse', '--verify', '--quiet', candidateRef], {
      allowFailure: true,
    })?.trim();
    return resolved !== undefined && resolved.length > 0;
  }) ?? null;
}

function resolveConfigRelativePath(rootDir, configPath = DEFAULT_CONFIG_RELATIVE_PATH) {
  if (typeof configPath !== 'string' || configPath.length === 0) {
    return DEFAULT_CONFIG_RELATIVE_PATH;
  }

  return normalizePath(
    isAbsolute(configPath)
      ? relative(rootDir, configPath)
      : configPath,
  );
}

function readBaseConfigSource(rootDir, baseRef, configRelativePath) {
  const resolvedBaseRef = resolveBaseRef(rootDir, baseRef);
  if (resolvedBaseRef === null) {
    return null;
  }

  return runGit(rootDir, ['show', `${resolvedBaseRef}:${configRelativePath}`], {
    allowFailure: true,
  });
}

function importAllowlistedFilesFromSource(source) {
  const tempDir = mkdtempSync(join(tmpdir(), 'file-size-hotspots-config-'));
  const tempPath = join(tempDir, 'base-config.mjs');

  try {
    writeFileSync(tempPath, source, 'utf8');
    const importer = [
      `const module = await import(${JSON.stringify(pathToFileURL(tempPath).href)});`,
      'const config = module.default ?? module.config ?? {};',
      'process.stdout.write(JSON.stringify(config.allowlistedFiles ?? []));',
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', importer], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || '').trim() || 'failed to import base file-size config');
    }

    const parsed = JSON.parse(result.stdout || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function loadBaseAllowlistedFiles(rootDir, baseRef, configRelativePath) {
  const source = readBaseConfigSource(rootDir, baseRef, configRelativePath);
  return source === null ? null : importAllowlistedFilesFromSource(source);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function findRatchetViolations(currentEntries, baseEntries, maxLinesPerFile) {
  const baseEntriesByPath = new Map(
    baseEntries.flatMap((entry) =>
      typeof entry.path === 'string'
        ? [[normalizePath(entry.path), entry]]
        : [],
    ),
  );

  return currentEntries.flatMap((currentEntry) => {
    const currentPath = typeof currentEntry.path === 'string'
      ? normalizePath(currentEntry.path)
      : null;
    const baseEntry = currentPath === null ? undefined : baseEntriesByPath.get(currentPath);
    if (
      baseEntry === undefined
      || isFiniteNumber(currentEntry.lines) === false
      || isFiniteNumber(baseEntry.lines) === false
      || currentEntry.lines <= baseEntry.lines
    ) {
      return [];
    }

    return [
      `Ratchet violation: pinned line budget for '${currentEntry.path}' increased from ${baseEntry.lines} to ${currentEntry.lines}. ` +
      `The file-size allowlist only ratchets DOWN — split the file to get under the ${maxLinesPerFile}-line budget instead of raising the pin.`,
    ];
  });
}

function findCurrentRatchetViolations(rootDir, config, options) {
  const baseEntries = loadBaseAllowlistedFiles(
    rootDir,
    options.baseRef ?? DEFAULT_BASE_REF,
    options.configRelativePath ?? DEFAULT_CONFIG_RELATIVE_PATH,
  );

  return baseEntries === null
    ? []
    : findRatchetViolations(config.allowlistedFiles, baseEntries, config.maxLinesPerFile);
}

function calculateAllowedDrift(lines, rawTolerance) {
  const tolerancePercent =
    typeof rawTolerance === 'number' && Number.isFinite(rawTolerance) && rawTolerance > 0
      ? rawTolerance
      : 0;
  return {
    allowedDrift: Math.ceil((lines * tolerancePercent) / 100),
    tolerancePercent,
  };
}

function validateAllowlistEntries(rootDir, config) {
  return config.allowlistedFiles.flatMap((entry) => {
    const { path, reason, lines } = entry;
    const absolutePath = join(rootDir, path);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      return [
        `Allowlist entry '${path}' does not exist in the repository`,
      ];
    }

    // Check if it's a source file
    if (!isSourceFile(path)) {
      return [
        `Allowlist entry '${path}' is not a source file (.js, .ts, .jsx, .tsx)`,
      ];
    }

    // Check if it's excluded by excludePatterns (dead entry)
    if (isExcluded(path, config.excludePatterns)) {
      return [
        `Allowlist entry '${path}' is excluded by excludePatterns (pattern: ${config.excludePatterns.find((p) => p.test(path))}) — remove from allowlist`,
      ];
    }

    // Get current line count
    const source = readText(rootDir, path);
    const lineCount = source.split('\n').length;

    // Check if it actually exceeds the budget
    if (lineCount <= config.maxLinesPerFile) {
      return [
        `Allowlist entry '${path}' is ${lineCount} lines, below the ${config.maxLinesPerFile}-line budget — remove from allowlist`,
      ];
    }

    // Check if lines field is present and within tolerance of the actual count (prevent stale metadata).
    // A percentage tolerance lets an allowlisted file drift a little before the number must be re-pinned,
    // so small edits don't force a metadata bump on every change.
    if (typeof lines === 'number') {
      const { allowedDrift, tolerancePercent } = calculateAllowedDrift(lines, config.linesTolerancePercent);
      if (Math.abs(lineCount - lines) > allowedDrift) {
        return [
          `Allowlist entry '${path}' has stale lines metadata: declared ${lines}, actual ${lineCount} ` +
          `(allowed drift ±${allowedDrift} at ${tolerancePercent}%) — update to match`,
        ];
      }
    }

    // Check if reason is non-empty
    if (!reason || reason.trim() === '') {
      return [
        `Allowlist entry '${path}' has an empty reason — provide justification or remove`,
      ];
    }

    return [];
  });
}

function discoverSourceRoots(rootDir) {
  const readDirectory = (relativePath) => {
    try {
      return readdirSync(join(rootDir, relativePath));
    } catch {
      return [];
    }
  };

  return [
    ...readDirectory('apps').map((app) => join('apps', app, 'src')),
    ...readDirectory('packages').map((pkg) => join('packages', pkg, 'src')),
    'scripts',
  ];
}

export function checkFileSizeHotspots(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const configRelativePath = resolveConfigRelativePath(
    rootDir,
    options.configRelativePath ?? DEFAULT_CONFIG_RELATIVE_PATH,
  );

  // Validate that allowlist entries are current and correct
  const allowlistFailures = validateAllowlistEntries(rootDir, config);
  const ratchetFailures = findCurrentRatchetViolations(rootDir, config, {
    ...options,
    configRelativePath,
  });

  // Use explicit includedRoots if provided; otherwise auto-discover
  const includedRoots = config.includedRoots ?? discoverSourceRoots(rootDir);

  // Collect all files in included roots
  const allFiles = includedRoots.flatMap((root) =>
    walkFiles(rootDir, { startRelativePath: root }),
  );

  // Filter to source files, exclude tests/generated/etc, and check size
  const filesToCheck = allFiles.filter(
    (relativePath) =>
      isSourceFile(relativePath) &&
      !isExcluded(relativePath, config.excludePatterns) &&
      !isAllowlisted(relativePath, config.allowlistedFiles),
  );

  const oversizedFileFailures = filesToCheck.flatMap((relativePath) => {
    const source = readText(rootDir, relativePath);
    const lineCount = source.split('\n').length;

    return lineCount > config.maxLinesPerFile
      ? [
        `${relativePath} exceeds ${config.maxLinesPerFile}-line budget (${lineCount} lines); ` +
        `add allowlist entry to file-size-hotspots.config.mjs with audit rationale or split the file`,
      ]
      : [];
  });

  return [
    ...allowlistFailures,
    ...ratchetFailures,
    ...oversizedFileFailures,
  ];
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolveRoot(args.root);
  const config = await loadConfig(args.config, defaultConfig);
  const configRelativePath = resolveConfigRelativePath(
    rootDir,
    typeof args.config === 'string' ? args.config : DEFAULT_CONFIG_RELATIVE_PATH,
  );
  const failures = checkFileSizeHotspots({
    rootDir,
    config,
    configRelativePath,
    baseRef: typeof args.base === 'string' ? args.base : DEFAULT_BASE_REF,
  });
  if (failures.length > 0) {
    console.error(formatFailures('File-size hotspot guardrail', failures));
    process.exit(1);
  }
  console.log('File-size hotspot guardrail passed.');
}
