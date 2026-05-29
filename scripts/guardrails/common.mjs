import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
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

export function toRelativePath(rootDir, filePath) {
  return normalizePath(relative(rootDir, filePath));
}

export function readText(rootDir, relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

export function pathExists(rootDir, relativePath) {
  return existsSync(join(rootDir, relativePath));
}

export function isFile(rootDir, relativePath) {
  const absolutePath = join(rootDir, relativePath);
  return existsSync(absolutePath) && statSync(absolutePath).isFile();
}

export function isDirectory(rootDir, relativePath) {
  const absolutePath = join(rootDir, relativePath);
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
  const startRelativePath = normalizePath(options.startRelativePath ?? '.');
  const files = [];

  function walk(relativeDir) {
    const absoluteDir = relativeDir === '.' ? rootDir : join(rootDir, relativeDir);
    if (!existsSync(absoluteDir)) return;

    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const childRelativePath = normalizePath(
        relativeDir === '.' ? entry.name : join(relativeDir, entry.name),
      );

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue;
        walk(childRelativePath);
      } else if (entry.isFile()) {
        files.push(childRelativePath);
      }
    }
  }

  walk(startRelativePath);
  return files.sort();
}

export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
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
  const candidates = [];

  if (extname(absoluteBase) !== '') {
    candidates.push(absoluteBase);
    if (absoluteBase.endsWith('.js')) {
      candidates.push(`${absoluteBase.slice(0, -3)}.ts`);
      candidates.push(`${absoluteBase.slice(0, -3)}.tsx`);
    }
    if (absoluteBase.endsWith('.jsx')) {
      candidates.push(`${absoluteBase.slice(0, -4)}.tsx`);
    }
  } else {
    candidates.push(absoluteBase);
    candidates.push(`${absoluteBase}.ts`);
    candidates.push(`${absoluteBase}.tsx`);
    candidates.push(`${absoluteBase}.js`);
    candidates.push(join(absoluteBase, 'index.ts'));
    candidates.push(join(absoluteBase, 'index.tsx'));
    candidates.push(join(absoluteBase, 'index.js'));
  }

  const match = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!match) return null;

  const relativePath = normalizePath(relative(rootDir, match));
  return relativePath.startsWith(`..${sep}`) ? null : relativePath;
}

export function extractStringLiterals(source) {
  const stripped = stripComments(source);
  const literals = [];
  const regex = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = regex.exec(stripped)) !== null) {
    const quote = match[1];
    const value = match[2];
    if (quote === '`' && value.includes('${')) continue;
    literals.push({ value, index: match.index });
  }
  return literals;
}

export function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}
