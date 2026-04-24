import fs from "fs";
import path from "path";
import glob from "glob";

/**
 * Interface defining the structure for file exclusion configuration
 * Used to specify which files should be excluded for specific index types
 */
interface FileExclusions {
  indexName: string;
  files: string[];
  reason: string;
}

/**
 * Determines the appropriate props type based on the source directory path
 * @param {string} sourceDir - The source directory path to analyze
 * @returns {string | null} The props type string or null if no match found
 */
const getPropsType = (sourceDir: string): string | null =>
  Object.entries({
    domains: "DomainProps",
    services: "ServiceProps",
    teams: "TeamProps",
    scorecards: "ScorecardProps",
    vendors: "VendorProps",
  }).find(([key]) => sourceDir.includes(key))?.[1] ?? null;

/**
 * Generates the export statement with appropriate typing based on source directory
 * @param {string} sourceDir - The source directory path
 * @param {string} indexName - The name of the index
 * @param {string[]} filteredFiles - The filtered files array
 * @returns {string} The formatted export statement string
 */
const generateExportStatement = (
  sourceDir: string,
  indexName: string,
  filteredFiles: string[],
): string => {
  const propsType = getPropsType(sourceDir);
  const elements = filteredFiles
    .map((_, index) => `${indexName}${index}`)
    .join(", ");

  return propsType
    ? `export const ${indexName}index: ${propsType}[] = [${elements}] as const;`
    : `export const ${indexName}index = [${elements}] as const;`;
};

/**
 * Configuration objects defining which files should be excluded for each index type
 * Each exclusion configuration specifies the index name, files to exclude, and reason
 */
const teamsFileExclusions: FileExclusions = {
  indexName: "teams",
  files: ["other"],
  reason: "to prevent circular dependency",
};

const templateFileExclusions: FileExclusions = {
  indexName: "*",
  files: ["-template"],
  reason: "template files should not be included in production index",
};

/**
 * Array of all file exclusion configurations
 * Add new exclusion rules here as needed for different entity types
 */
const fileExclusionConfigs: FileExclusions[] = [
  teamsFileExclusions,
  templateFileExclusions,
];

/**
 * Filters out files that should be excluded based on the provided exclusion configuration
 * Generic function that can handle any file exclusion pattern
 * @param {string[]} files - Array of file paths to filter
 * @param {FileExclusions | null} exclusions - FileExclusions object containing the exclusion rules
 * @returns {Object} Object containing filtered files array and list of excluded files
 * @returns {string[]} Object.filteredFiles - Array of file paths that weren't excluded
 * @returns {string[]} Object.excludedFiles - Array of file names that were excluded
 */
const filterExcludedFiles = (
  files: string[],
  exclusions: FileExclusions | null,
): { filteredFiles: string[]; excludedFiles: string[] } => {
  if (!exclusions) {
    return { filteredFiles: files, excludedFiles: [] };
  }

  const excludedFiles: string[] = [];
  const filteredFiles = files.filter((file: string) => {
    const fileName = path.basename(file, ".ts");
    const shouldExclude = exclusions.files.includes(fileName);

    if (shouldExclude) {
      excludedFiles.push(fileName);
    }

    return !shouldExclude;
  });

  return { filteredFiles, excludedFiles };
};

/**
 * Gets the exclusion configuration for a specific index name
 * Searches through the fileExclusionConfigs array to find matching configuration
 * @param {string} indexName - The name of the index to get exclusions for
 * @returns {FileExclusions | null} FileExclusions object if found, null otherwise
 */
const getExclusionConfig = (indexName: string): FileExclusions | null => {
  return (
    fileExclusionConfigs.find(
      (config) => config.indexName === indexName || config.indexName === "*",
    ) || null
  );
};

/**
 * Logs exclusion information if files were filtered for the given exclusion configuration
 * Uses the exclusion configuration to provide detailed logging about what was excluded and why
 * @param {FileExclusions | null} exclusions - FileExclusions object containing the exclusion rules
 * @param {string[]} excludedFiles - Array of file names that were excluded
 * @returns {void} This function does not return a value
 */
const logExclusionInfo = (
  exclusions: FileExclusions | null,
  excludedFiles: string[],
): void => {
  if (excludedFiles.length > 0 && exclusions) {
    const fileList = excludedFiles
      .map((file: string) => `${file}.ts`)
      .join(", ");
    console.log(
      `Excluded ${fileList} from ${exclusions.indexName} index generation ${exclusions.reason}`,
    );
  }
};

/**
 * Generates the unique import statement based on the source directory
 * Uses the props type to determine which entity type to import
 * @param {string} sourceDir - The source directory path to analyze
 * @returns {string} The import statement string or empty string if no match
 */
const generateUniqueImportStatement = (sourceDir: string): string => {
  const propsType = getPropsType(sourceDir);
  return propsType
    ? `import { ${propsType} } from "../../config/types/entityTypes";\n`
    : "";
};

/**
 * Main function that generates index files and constants for a given entity type
 * Processes TypeScript files in a source directory and creates corresponding index and constant files
 * @param {string} indexName - The name of the index being generated (e.g., 'teams', 'services')
 * @param {string} sourceDir - The relative path to the source directory containing entity files
 * @param {string} indexOutputDir - The relative path to the directory where index files will be generated
 * @returns {void} This function does not return a value
 */
const generateIndexAndConstants = (
  indexName: string,
  sourceDir: string,
  indexOutputDir: string,
): void => {
  // Construct absolute paths for source directory, index output, and constants output
  const fullSourceDir = path.join(__dirname, sourceDir);
  const fullIndexOutputDir = path.join(
    __dirname,
    indexOutputDir,
    `${indexName}.ts`,
  );
  const constantOutputDir = path.join(
    __dirname,
    `../lib/generated/config/constants/${indexName}.ts`,
  );

  // Find all TypeScript files in the source directory, excluding test and definition files
  const files = glob.sync(`${fullSourceDir}/**/*.ts`, {
    ignore: [
      "**/*.d.ts",
      "**/*.test.ts",
      "**/__tests__/**",
      "**/members/**", // Exclude team member files (TeamMembersFileProps, not TeamProps)
    ],
    nodir: true,
  });

  // Apply filtering to exclude specific files based on configuration and log exclusions
  const exclusionConfig = getExclusionConfig(indexName);
  const { filteredFiles, excludedFiles } = filterExcludedFiles(
    files,
    exclusionConfig,
  );
  logExclusionInfo(exclusionConfig, excludedFiles);

  // Generate import statement for entity types if needed
  const uniqueImportStatement = generateUniqueImportStatement(sourceDir);

  // Create import statements for each filtered file
  const importStatements = [
    uniqueImportStatement,
    ...filteredFiles.map((file: string, index: number) => {
      // Convert absolute path to relative path for import statement
      const relativePath = path
        .relative(process.cwd(), file)
        .replace(/\.ts$/, "")
        .replace(/\\/g, "/"); // Normalize path separators for cross-platform compatibility
      return `import ${indexName}${index} from "../../../${relativePath}";`;
    }),
  ]
    .filter(Boolean)
    .join("\n");

  const exportStatement = generateExportStatement(
    sourceDir,
    indexName,
    filteredFiles,
  );

  // Combine import and export statements into final file content
  const fileContent = `// This file is autogenerated via npm run init DO NOT EDIT\n${importStatements}\n\n${exportStatement}`;

  // Write the generated index file
  fs.writeFileSync(fullIndexOutputDir, fileContent, "utf8");
  console.log(`Generated ${indexOutputDir}/${indexName}.ts`);

  // Generate constants object mapping file names to their string representations
  const constants = filteredFiles
    .map((file: string) => {
      const fileName = path.basename(file, ".ts");
      const constantName = fileName.replace(/-/g, "_").toLowerCase();

      // Wrap constant key in quotes if it contains special characters like dots
      const key = constantName.includes(".")
        ? `"${constantName}"`
        : constantName;

      return `  ${key}: "${fileName}"`;
    })
    .join(",\n");

  // Write the constants file
  const constantsFileContent = `// This file is autogenerated via npm run init DO NOT EDIT\nexport const ${indexName} = {\n${constants}\n};`;
  fs.writeFileSync(constantOutputDir, constantsFileContent, "utf8");
  console.log(`Generated ../lib/generated/config/constants/${indexName}.ts`);
};

// Generate index and constants files for all entity types
// Each call processes a specific entity type and creates corresponding TypeScript index files

// Generate files for business rules
generateIndexAndConstants(
  "rule",
  "../lib/config/rules",
  "../lib/generated/config",
);

// Generate files for domain entities - business units
generateIndexAndConstants(
  "businessunit",
  "../lib/config/domains/businessunit",
  "../lib/generated/config",
);

// Generate files for domain entities - product groups
generateIndexAndConstants(
  "productgroup",
  "../lib/config/domains/productgroup",
  "../lib/generated/config",
);

// Generate files for domain entities - solutions
generateIndexAndConstants(
  "solution",
  "../lib/config/domains/solution",
  "../lib/generated/config",
);

// Generate files for domain entities - tiers
generateIndexAndConstants(
  "tier",
  "../lib/config/domains/tier",
  "../lib/generated/config",
);

// Generate files for domain entities - top level domains
generateIndexAndConstants(
  "toplevel",
  "../lib/config/domains/toplevel",
  "../lib/generated/config",
);

// Generate files for service entities
generateIndexAndConstants(
  "service",
  "../lib/config/services",
  "../lib/generated/config",
);

// Generate files for domain entities - products
generateIndexAndConstants(
  "product",
  "../lib/config/domains/product",
  "../lib/generated/config",
);

// Generate files for domain entities - applications
generateIndexAndConstants(
  "application",
  "../lib/config/domains/application",
  "../lib/generated/config",
);

// Generate files for team entities (excludes 'other.ts' to prevent circular dependencies)
generateIndexAndConstants(
  "teams",
  "../lib/config/teams",
  "../lib/generated/config",
);

// Generate files for scorecard entities
generateIndexAndConstants(
  "scorecard",
  "../lib/config/scorecards",
  "../lib/generated/config",
);

// Generate files for vendor entities
generateIndexAndConstants(
  "vendor",
  "../lib/config/vendors",
  "../lib/generated/config",
);