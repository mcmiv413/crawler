import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const IGNORED_DIRECTORIES = new Set([
  'dist',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
  'balance-results',
]);

function readJson(absolutePath) {
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function listWorkspacePackageDirs(rootDir, parentDirName) {
  const parentDir = path.join(rootDir, parentDirName);
  if (existsSync(parentDir) === false) {
    return [];
  }

  return readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDirName, entry.name));
}

function getWorkspacePackages(rootDir) {
  const candidateDirs = [
    ...listWorkspacePackageDirs(rootDir, 'apps'),
    ...listWorkspacePackageDirs(rootDir, 'packages'),
  ];

  return candidateDirs
    .map((relativeDir) => {
      const packageJsonRelativePath = path.join(relativeDir, 'package.json');
      const packageJsonAbsolutePath = path.join(rootDir, packageJsonRelativePath);
      if (existsSync(packageJsonAbsolutePath) === false) {
        return null;
      }

      const manifest = readJson(packageJsonAbsolutePath);
      if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
        return null;
      }

      return {
        name: manifest.name,
        dirRelativePath: relativeDir,
        dirAbsolutePath: path.join(rootDir, relativeDir),
        packageJsonRelativePath,
        manifest,
        exportedKeys: getExportedKeys(manifest),
      };
    })
    .filter((workspacePackage) => workspacePackage !== null);
}

function getExportedKeys(manifest) {
  if (manifest.exports === undefined) {
    return new Set();
  }

  if (typeof manifest.exports === 'string') {
    return new Set(['.']);
  }

  return new Set(Object.keys(manifest.exports));
}

function walkCodeFiles(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files = [...files, ...walkCodeFiles(rootDir, path.join(relativeDir, entry.name))];
      continue;
    }

    if (CODE_FILE_EXTENSIONS.has(path.extname(entry.name)) === false) {
      continue;
    }

    files.push(path.join(relativeDir, entry.name));
  }

  return files;
}

function collectImportUsages(source) {
  const patterns = [
    /\bimport\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ];

  const usages = [];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (typeof specifier !== 'string' || specifier.length === 0) {
        continue;
      }

      const index = match.index ?? 0;
      const line = source.slice(0, index).split('\n').length;
      usages.push({ specifier, line });
    }
  }

  return usages;
}

function resolveWorkspaceImport(specifier, workspacePackageNames) {
  for (const workspacePackageName of workspacePackageNames) {
    if (specifier === workspacePackageName) {
      return { packageName: workspacePackageName, subpath: null };
    }

    const prefix = `${workspacePackageName}/`;
    if (specifier.startsWith(prefix)) {
      return { packageName: workspacePackageName, subpath: specifier.slice(prefix.length) };
    }
  }

  return null;
}

function hasDeclaredWorkspaceDependency(manifest, packageName) {
  const dependencyFields = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
  ];

  return dependencyFields.some(
    (field) => field !== undefined && Object.prototype.hasOwnProperty.call(field, packageName),
  );
}

function formatFailure(filePath, line, message) {
  return `${filePath}:${line} ${message}`;
}

export function checkWorkspaceWiring(rootDir = process.cwd()) {
  const workspacePackages = getWorkspacePackages(rootDir);
  const workspacePackagesByName = new Map(
    workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
  );
  const workspacePackageNames = [...workspacePackagesByName.keys()].sort(
    (left, right) => right.length - left.length,
  );
  const failures = [];

  for (const consumerPackage of workspacePackages) {
    const codeFiles = walkCodeFiles(rootDir, consumerPackage.dirRelativePath);
    for (const relativePath of codeFiles) {
      const source = readFileSync(path.join(rootDir, relativePath), 'utf8');
      for (const usage of collectImportUsages(source)) {
        const resolvedImport = resolveWorkspaceImport(usage.specifier, workspacePackageNames);
        if (resolvedImport === null || resolvedImport.packageName === consumerPackage.name) {
          continue;
        }

        const targetPackage = workspacePackagesByName.get(resolvedImport.packageName);
        if (targetPackage === undefined) {
          continue;
        }

        if (resolvedImport.subpath !== null && resolvedImport.subpath.startsWith('src/')) {
          failures.push(
            formatFailure(
              relativePath,
              usage.line,
              `imports workspace src internals via "${usage.specifier}"; import from a public export instead`,
            ),
          );
          continue;
        }

        if (hasDeclaredWorkspaceDependency(consumerPackage.manifest, targetPackage.name) === false) {
          failures.push(
            formatFailure(
              relativePath,
              usage.line,
              `imports "${usage.specifier}" but ${consumerPackage.packageJsonRelativePath} does not declare ${targetPackage.name} in dependencies, devDependencies, or peerDependencies`,
            ),
          );
        }

        if (resolvedImport.subpath === null) {
          if (targetPackage.manifest.exports !== undefined && targetPackage.exportedKeys.has('.') === false) {
            failures.push(
              formatFailure(
                relativePath,
                usage.line,
                `imports "${usage.specifier}" but ${targetPackage.packageJsonRelativePath} does not export "."`,
              ),
            );
          }
          continue;
        }

        const expectedExportKey = `./${resolvedImport.subpath}`;
        if (targetPackage.exportedKeys.has(expectedExportKey) === false) {
          failures.push(
            formatFailure(
              relativePath,
              usage.line,
              `imports "${usage.specifier}" but ${targetPackage.packageJsonRelativePath} does not export "${expectedExportKey}"`,
            ),
          );
        }
      }
    }
  }

  return failures.sort((left, right) => left.localeCompare(right));
}

function runCli() {
  const failures = checkWorkspaceWiring(process.cwd());

  if (failures.length > 0) {
    console.error('Workspace wiring check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Workspace wiring check passed.');
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli();
}
