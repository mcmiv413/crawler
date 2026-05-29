import { dirname, normalize, relative, resolve } from 'node:path';
import {
  formatFailures,
  isCliMain,
  isDirectory,
  isFile,
  loadConfig,
  normalizePath,
  parseArgs,
  pathExists,
  readText,
  resolveRoot,
  walkFiles,
} from './common.mjs';
import defaultConfig from './doc-paths.config.mjs';

function markdownFiles(rootDir, roots) {
  const files = [];
  for (const root of roots) {
    if (isFile(rootDir, root) && root.endsWith('.md')) {
      files.push(normalizePath(root));
    } else if (isDirectory(rootDir, root)) {
      files.push(...walkFiles(rootDir, { startRelativePath: root }).filter((file) => file.endsWith('.md')));
    }
  }
  return [...new Set(files)].sort();
}

function stripFencedCode(source) {
  return source.replace(/```[\s\S]*?```/g, '');
}

function cleanMarkdownTarget(target) {
  const withoutAnchor = target.split('#')[0] ?? '';
  const withoutQuery = withoutAnchor.split('?')[0] ?? '';
  return withoutQuery.trim();
}

function isExternalTarget(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('mailto:');
}

function isPathLike(value) {
  if (value.length === 0) return false;
  if (value.includes(' ') || value.includes('\n') || value.includes('=')) return false;
  if (value.startsWith('@')) return false;
  if (value.startsWith('~') || value.startsWith('/home/')) return false;
  if (value.includes('*') || value.includes('{') || value.includes('}') || value.includes('<') || value.includes('>')) return false;
  if (value.startsWith('./') || value.startsWith('../')) return true;
  return /^(?:apps|packages|tests|scripts|docs|\.github|\.claude|\.agents)\//.test(value) ||
    /^(?:AGENTS|CLAUDE|CONTRIBUTING|README)\.md$/.test(value);
}

function isAllowedInline(value, config) {
  return (config.allowedInlinePrefixes ?? []).some((prefix) => value.startsWith(prefix)) ||
    (config.allowedInlinePatterns ?? []).some((pattern) => pattern.test(value));
}

function resolveDocPath(rootDir, docRelativePath, rawPath) {
  const cleaned = cleanMarkdownTarget(rawPath);
  if (!cleaned || isExternalTarget(cleaned)) return null;
  const isRepoRootPath = /^(?:apps|packages|tests|scripts|docs|\.github|\.claude|\.agents)\//.test(cleaned) ||
    /^(?:AGENTS|CLAUDE|CONTRIBUTING|README)\.md$/.test(cleaned);
  const absolute = cleaned.startsWith('/')
    ? resolve(rootDir, `.${cleaned}`)
    : isRepoRootPath
      ? resolve(rootDir, cleaned)
    : resolve(rootDir, dirname(docRelativePath), cleaned);
  const relativePath = normalizePath(relative(rootDir, normalize(absolute)));
  if (relativePath.startsWith('..')) return { cleaned, relativePath: null };
  return { cleaned, relativePath };
}

function isDeclaredNewPath(source, rawPath) {
  const escaped = rawPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`(?:new|create|add|deliverable|file)\\s+[^\\n]*${escaped}`, 'i');
  return declaration.test(source);
}

export function checkDocPaths(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const config = options.config ?? defaultConfig;
  const failures = [];
  const files = markdownFiles(rootDir, config.roots);

  for (const docRelativePath of files) {
    const source = readText(rootDir, docRelativePath);
    const scanSource = stripFencedCode(source);
    const linkRegex = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    const inlineCodeRegex = /`([^`\n]+)`/g;

    let match;
    while ((match = linkRegex.exec(scanSource)) !== null) {
      const target = match[1];
      const resolved = resolveDocPath(rootDir, docRelativePath, target);
      if (!resolved?.relativePath) continue;
      if (pathExists(rootDir, resolved.relativePath) === false) {
        failures.push(
          `${docRelativePath}: link target "${target}" resolves to missing path ${resolved.relativePath}`,
        );
      }
    }

    while ((match = inlineCodeRegex.exec(scanSource)) !== null) {
      const raw = match[1].trim().replace(/[.,;:]$/, '');
      if (isPathLike(raw) === false || isAllowedInline(raw, config)) continue;
      const resolved = resolveDocPath(rootDir, docRelativePath, raw);
      if (!resolved?.relativePath) continue;
      if (pathExists(rootDir, resolved.relativePath) === false && isDeclaredNewPath(scanSource, raw) === false) {
        failures.push(
          `${docRelativePath}: inline path "${raw}" resolves to missing path ${resolved.relativePath}`,
        );
      }
    }
  }

  return failures;
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config, defaultConfig);
  const failures = checkDocPaths({ rootDir: args.root, config });
  if (failures.length > 0) {
    console.error(formatFailures('Docs path guardrail', failures));
    process.exit(1);
  }
  console.log('Docs path guardrail passed.');
}
