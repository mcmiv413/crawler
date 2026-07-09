import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePath } from './common.mjs';

export const DEFAULT_FEATURE_PROOF_REGISTRY_PATH = 'docs/feature-proofs.yml';

const OWNER_SECTIONS = [
  'entry',
  'state',
  'event',
  'presenter',
  'ui',
  'content',
  'persistence',
];

const GENERATED_MIRROR_ROOTS = [
  '.agents/skills/',
  '.claude/skills/',
  '.github/skills/',
];

function stripInlineComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char;
      continue;
    }
    if (char === '#' && quote === null && (index === 0 || /\s/.test(line[index - 1] ?? ''))) {
      return line.slice(0, index);
    }
  }
  return line;
}

function tokenizeYaml(source) {
  return source
    .split('\n')
    .map((rawLine, index) => {
      if (rawLine.includes('\t')) {
        throw new Error(`YAML tab indentation is not supported at line ${index + 1}`);
      }
      const line = stripInlineComment(rawLine).replace(/\s+$/u, '');
      if (line.trim().length === 0) {
        return null;
      }
      return {
        line: index + 1,
        indent: line.match(/^ */u)?.[0].length ?? 0,
        text: line.trim(),
      };
    })
    .filter(Boolean);
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === '[]') return [];
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function splitKeyValue(text, line) {
  const separatorIndex = text.indexOf(':');
  if (separatorIndex <= 0) {
    throw new Error(`Expected "key: value" at line ${line}`);
  }
  return {
    key: text.slice(0, separatorIndex).trim(),
    value: text.slice(separatorIndex + 1).trim(),
  };
}

function parseNode(tokens, index, indent) {
  const token = tokens[index];
  if (token === undefined || token.indent < indent) {
    return { value: null, index };
  }
  if (token.indent > indent) {
    throw new Error(`Unexpected indentation at line ${token.line}`);
  }
  return token.text.startsWith('- ')
    ? parseArray(tokens, index, indent)
    : parseObject(tokens, index, indent);
}

function parseObject(tokens, index, indent) {
  const parseNextEntry = (cursor, object) => {
    if (cursor >= tokens.length) {
      return { value: object, index: cursor };
    }

    const token = tokens[cursor];
    if (token.indent < indent || token.text.startsWith('- ')) {
      return { value: object, index: cursor };
    }
    if (token.indent > indent) {
      throw new Error(`Unexpected indentation at line ${token.line}`);
    }

    const { key, value } = splitKeyValue(token.text, token.line);
    if (value.length === 0) {
      const child = parseNode(tokens, cursor + 1, indent + 2);
      return parseNextEntry(child.index, { ...object, [key]: child.value ?? {} });
    }

    return parseNextEntry(cursor + 1, { ...object, [key]: parseScalar(value) });
  };

  return parseNextEntry(index, {});
}

function parseArray(tokens, index, indent) {
  const parseNextItem = (cursor, array) => {
    if (cursor >= tokens.length) {
      return { value: array, index: cursor };
    }

    const token = tokens[cursor];
    if (token.indent < indent) {
      return { value: array, index: cursor };
    }
    if (token.indent > indent) {
      throw new Error(`Unexpected indentation at line ${token.line}`);
    }
    if (!token.text.startsWith('- ')) {
      return { value: array, index: cursor };
    }

    const itemText = token.text.slice(2).trim();
    if (itemText.length === 0) {
      const child = parseNode(tokens, cursor + 1, indent + 2);
      return parseNextItem(child.index, [...array, child.value]);
    }

    if (/^[A-Za-z0-9_-]+:\s*/u.test(itemText)) {
      const { key, value } = splitKeyValue(itemText, token.line);
      const item = { [key]: value.length === 0 ? {} : parseScalar(value) };
      const nextCursor = cursor + 1;

      if (nextCursor < tokens.length && tokens[nextCursor].indent === indent + 2) {
        const child = parseObject(tokens, nextCursor, indent + 2);
        return parseNextItem(child.index, [...array, { ...item, ...child.value }]);
      }

      return parseNextItem(nextCursor, [...array, item]);
    }

    return parseNextItem(cursor + 1, [...array, parseScalar(itemText)]);
  };

  return parseNextItem(index, []);
}

export function parseFeatureProofRegistry(source) {
  const tokens = tokenizeYaml(source);
  if (tokens.length === 0) {
    throw new Error('registry is empty');
  }
  const parsed = parseNode(tokens, 0, tokens[0].indent);
  if (parsed.index !== tokens.length) {
    throw new Error(`Unexpected YAML content at line ${tokens[parsed.index].line}`);
  }
  return normalizeFeatureProofRegistry(parsed.value);
}

export function normalizeFeatureProofRegistry(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('registry root must be an object');
  }
  if (!Array.isArray(value.features)) {
    throw new Error('registry must contain a features array');
  }

  return {
    features: value.features.map((feature, index) => {
      if (feature === null || typeof feature !== 'object' || Array.isArray(feature)) {
        throw new Error(`features[${index}] must be an object`);
      }
      if (typeof feature.feature !== 'string' || feature.feature.trim().length === 0) {
        throw new Error(`features[${index}] must have a non-empty feature id`);
      }
      if (typeof feature.name !== 'string' || feature.name.trim().length === 0) {
        throw new Error(`features[${index}] must have a non-empty name`);
      }
      return feature;
    }),
  };
}

function asStringArray(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function sectionFiles(feature, sectionName) {
  const section = feature[sectionName];
  if (section === undefined || section === null || typeof section !== 'object' || Array.isArray(section)) {
    return [];
  }
  return asStringArray(section.files);
}

export function collectOwnerPatterns(feature) {
  return OWNER_SECTIONS.flatMap((sectionName) => sectionFiles(feature, sectionName));
}

export function collectRequiredProofPatterns(feature) {
  const proofs = feature.proofs;
  if (proofs === undefined || proofs === null || typeof proofs !== 'object' || Array.isArray(proofs)) {
    return [];
  }
  return asStringArray(proofs.required);
}

export function collectOptionalProofPatterns(feature) {
  const proofs = feature.proofs;
  if (proofs === undefined || proofs === null || typeof proofs !== 'object' || Array.isArray(proofs)) {
    return [];
  }
  return asStringArray(proofs.optional);
}

export function collectProofPatterns(feature) {
  return [
    ...collectRequiredProofPatterns(feature),
    ...collectOptionalProofPatterns(feature),
  ];
}

export function collectAllRegistryPaths(feature) {
  return [
    ...collectOwnerPatterns(feature),
    ...collectProofPatterns(feature),
  ];
}

export function isExplicitGlob(pattern) {
  return /[*?[\]{}]/u.test(pattern);
}

function escapeRegex(char) {
  return /[\\^$+?.()|[\]{}]/u.test(char) ? `\\${char}` : char;
}

function escapeCharacterClassContent(content) {
  return [...content]
    .map((char, index) => {
      if (char === '\\' || char === '[' || char === ']') {
        return `\\${char}`;
      }
      if (char === '^' && index === 0) {
        return '\\^';
      }
      return char;
    })
    .join('');
}

function parseCharacterClass(pattern, index) {
  const closingIndex = pattern.indexOf(']', index + 1);
  const content = closingIndex === -1 ? null : pattern.slice(index + 1, closingIndex);
  if (content === null || content.length === 0 || content === '!') {
    return { source: escapeRegex(pattern[index]), nextIndex: index + 1 };
  }

  const negated = content.startsWith('!');
  const classContent = negated ? content.slice(1) : content;
  return {
    source: `[${negated ? '^' : ''}${escapeCharacterClassContent(classContent)}]`,
    nextIndex: closingIndex + 1,
  };
}

function parseBraceAlternation(pattern, index) {
  const closingIndex = pattern.indexOf('}', index + 1);
  const content = closingIndex === -1 ? null : pattern.slice(index + 1, closingIndex);
  if (content === null || !content.includes(',')) {
    return { source: escapeRegex(pattern[index]), nextIndex: index + 1 };
  }

  return {
    source: `(?:${content.split(',').map(globSource).join('|')})`,
    nextIndex: closingIndex + 1,
  };
}

function parseGlobToken(pattern, index) {
  const char = pattern[index];
  if (char === '*') {
    return pattern[index + 1] === '*'
      ? { source: '.*', nextIndex: index + 2 }
      : { source: '[^/]*', nextIndex: index + 1 };
  }
  if (char === '?') {
    return { source: '[^/]', nextIndex: index + 1 };
  }
  if (char === '[') {
    return parseCharacterClass(pattern, index);
  }
  if (char === '{') {
    return parseBraceAlternation(pattern, index);
  }
  return { source: escapeRegex(char), nextIndex: index + 1 };
}

function* globSourceTokens(pattern, index = 0) {
  if (index >= pattern.length) {
    return;
  }
  const token = parseGlobToken(pattern, index);
  yield token.source;
  yield* globSourceTokens(pattern, token.nextIndex);
}

function globSource(pattern) {
  return [...globSourceTokens(pattern)].join('');
}

export function globToRegExp(pattern) {
  return new RegExp(`^${globSource(pattern)}$`, 'u');
}

export function matchesPathPattern(pattern, relativePath) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(relativePath);
  if (!isExplicitGlob(normalizedPattern)) {
    return normalizedPath === normalizedPattern;
  }
  return globToRegExp(normalizedPattern).test(normalizedPath);
}

export function findFeaturesForPath(registry, relativePath) {
  return registry.features.filter((feature) =>
    collectOwnerPatterns(feature).some((pattern) => matchesPathPattern(pattern, relativePath)),
  );
}

export function findFeatureProofMatches(registry, relativePath) {
  return registry.features.filter((feature) =>
    collectProofPatterns(feature).some((pattern) => matchesPathPattern(pattern, relativePath)),
  );
}

export function getValidationCommands(feature) {
  const validation = feature.validation;
  if (validation === undefined || validation === null || typeof validation !== 'object' || Array.isArray(validation)) {
    return [];
  }
  return [
    ...asStringArray(validation.focused),
    ...asStringArray(validation.final),
  ];
}

export function getScenarioFixtureNames(feature) {
  return [
    ...asStringArray(feature.scenarioFixtures),
    ...asStringArray(feature.scenarioFixtureNames),
    ...(feature.scenarios && typeof feature.scenarios === 'object' && !Array.isArray(feature.scenarios)
      ? asStringArray(feature.scenarios.fixtures)
      : []),
  ];
}

function isGeneratedMirrorPath(relativePath) {
  const normalized = normalizePath(relativePath);
  return GENERATED_MIRROR_ROOTS.some((root) => normalized.startsWith(root));
}

function validateExistingPath(rootDir, relativePath, context) {
  const normalized = normalizePath(relativePath);
  return [
    ...(isGeneratedMirrorPath(normalized)
      ? [`${context}: generated skill mirror path "${normalized}" must not be canonical proof ownership`]
      : []),
    ...(!isExplicitGlob(normalized) && existsSync(join(rootDir, normalized)) === false
      ? [`${context}: listed path does not exist: ${normalized}`]
      : []),
  ];
}

export function validateFeatureProofRegistry({ rootDir, registry }) {
  return registry.features.flatMap((feature, index) => [
    ...(registry.features
      .slice(0, index)
      .some((previousFeature) => previousFeature.feature === feature.feature)
      ? [`feature id "${feature.feature}" is duplicated`]
      : []),
    ...collectAllRegistryPaths(feature).flatMap((relativePath) =>
      validateExistingPath(rootDir, relativePath, `${feature.feature}`),
    ),
    ...collectRequiredProofPatterns(feature).flatMap((relativePath) => {
      const normalized = normalizePath(relativePath);
      return !isExplicitGlob(normalized) && existsSync(join(rootDir, normalized)) === false
        ? [`${feature.feature}: required proof file does not exist: ${normalized}`]
        : [];
    }),
    ...getValidationCommands(feature).flatMap((command) =>
      command.startsWith('pnpm ')
        ? []
        : [`${feature.feature}: validation command must start with pnpm: ${command}`],
    ),
    ...getScenarioFixtureNames(feature).flatMap((fixtureName) => {
      const fixturePath = join(rootDir, 'fixtures/scenarios', `${fixtureName}.json`);
      return existsSync(fixturePath) === false
        ? [`${feature.feature}: scenario fixture does not exist: ${fixtureName}`]
        : [];
    }),
  ]);
}
