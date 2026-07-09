import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  '.agents',
  '.claude',
  '.codex',
  '.github',
  '.plan',
  '.fossil',
  '.turbo',
  '.serena',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'balance-results',
]);

export function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function hasWindowsDrivePrefix(filePath) {
  return /^[A-Za-z]:/u.test(filePath);
}

export function isRepoRelativePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }
  if (isAbsolute(filePath) || hasWindowsDrivePrefix(filePath) || filePath.startsWith('\\\\')) {
    return false;
  }

  const normalized = normalizePath(filePath);
  if (
    normalized.length === 0
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || hasWindowsDrivePrefix(normalized)
  ) {
    return false;
  }

  return normalized.split('/').every((segment) => segment !== '..');
}

export function formatRepoRelativePathFailure(filePath, context) {
  return `${context} must be a repo-relative path without absolute roots or ".." segments: ${String(filePath)}`;
}

export function assertRepoRelativePath(filePath, context) {
  if (!isRepoRelativePath(filePath)) {
    throw new Error(formatRepoRelativePathFailure(filePath, context));
  }
  return normalizePath(filePath);
}

export function toRelativePath(rootDir, filePath) {
  return normalizePath(relative(rootDir, filePath));
}

export function readText(rootDir, relativePath) {
  return readFileSync(join(rootDir, assertRepoRelativePath(relativePath, 'read path')), 'utf8');
}

export function pathExists(rootDir, relativePath) {
  return existsSync(join(rootDir, assertRepoRelativePath(relativePath, 'path probe')));
}

export function isFile(rootDir, relativePath) {
  const absolutePath = join(rootDir, assertRepoRelativePath(relativePath, 'file probe'));
  return existsSync(absolutePath) && statSync(absolutePath).isFile();
}

export function isDirectory(rootDir, relativePath) {
  const absolutePath = join(rootDir, assertRepoRelativePath(relativePath, 'directory probe'));
  return existsSync(absolutePath) && statSync(absolutePath).isDirectory();
}

export function matchesAnyPrefix(relativePath, roots = []) {
  const normalized = normalizePath(relativePath);
  return roots.some((root) => {
    const normalizedRoot = normalizePath(root).replace(/\/$/, '');
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
  });
}

export function matchesAnyRegex(relativePath, patterns = []) {
  return patterns.some((pattern) => pattern.test(relativePath));
}

export function walkFiles(rootDir, options = {}) {
  const ignoredDirs = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;
  const startRelativePath = assertRepoRelativePath(
    normalizePath(options.startRelativePath ?? '.'),
    'walk start path',
  );

  function walk(relativeDir) {
    const absoluteDir = relativeDir === '.'
      ? rootDir
      : join(rootDir, assertRepoRelativePath(relativeDir, 'walk path'));
    if (!existsSync(absoluteDir)) return [];

    return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
      const childRelativePath = normalizePath(
        relativeDir === '.' ? entry.name : join(relativeDir, entry.name),
      );

      if (entry.isDirectory()) {
        return ignoredDirs.has(entry.name) ? [] : walk(childRelativePath);
      }
      return entry.isFile() ? [childRelativePath] : [];
    });
  }

  return walk(startRelativePath).sort();
}

export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function parseArgs(argv) {
  function* entries(index = 0) {
    if (index >= argv.length) {
      return;
    }

    const arg = argv[index];
    if (!arg.startsWith('--')) {
      yield* entries(index + 1);
      return;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      yield [key, true];
      yield* entries(index + 1);
    } else {
      yield [key, next];
      yield* entries(index + 2);
    }
  }

  return Object.fromEntries(entries());
}

export function resolveRoot(argRoot) {
  return resolve(argRoot ?? process.cwd());
}

export async function loadConfig(configPath, defaultConfig) {
  if (!configPath) return defaultConfig;
  const absolutePath = isAbsolute(configPath) ? configPath : resolve(process.cwd(), configPath);
  const module = await import(`${pathToFileURL(absolutePath).href}?t=${Date.now()}`);
  return module.default ?? module.config ?? defaultConfig;
}

export function formatFailures(title, failures) {
  if (failures.length === 0) {
    return `${title} passed.`;
  }
  return [
    `${title} failed:`,
    ...failures.map((failure) => `- ${failure}`),
  ].join('\n');
}

export function isCliMain(metaUrl, argvPath = process.argv[1]) {
  if (!argvPath) return false;
  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}

export function resolveImportPath(rootDir, importerRelativePath, specifier) {
  if (!specifier.startsWith('.')) return null;

  const importerDir = dirname(join(rootDir, importerRelativePath));
  const absoluteBase = resolve(importerDir, specifier);
  const candidates = extname(absoluteBase) !== ''
    ? [
      absoluteBase,
      ...(absoluteBase.endsWith('.js')
        ? [`${absoluteBase.slice(0, -3)}.ts`, `${absoluteBase.slice(0, -3)}.tsx`]
        : []),
      ...(absoluteBase.endsWith('.jsx')
        ? [`${absoluteBase.slice(0, -4)}.tsx`]
        : []),
    ]
    : [
      absoluteBase,
      `${absoluteBase}.ts`,
      `${absoluteBase}.tsx`,
      `${absoluteBase}.js`,
      join(absoluteBase, 'index.ts'),
      join(absoluteBase, 'index.tsx'),
      join(absoluteBase, 'index.js'),
    ];

  const match = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!match) return null;

  const relativePath = normalizePath(relative(rootDir, match));
  return isRepoRelativePath(relativePath) ? relativePath : null;
}

function* stringLiteralEntries(source) {
  const stripped = stripComments(source);
  const regex = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = regex.exec(stripped)) !== null) {
    const quote = match[1];
    const value = match[2];
    if (quote === '`' && value.includes('${')) continue;
    yield { value, index: match.index };
  }
}

export function extractStringLiterals(source) {
  return [...stringLiteralEntries(source)];
}

export function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}
