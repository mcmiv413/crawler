import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginVitest from "@vitest/eslint-plugin";
import pluginDungeon from "eslint-plugin-dungeon";

// Shared restricted syntax patterns
const NO_THEN_CHAIN = {
  selector: "CallExpression[callee.property.name='then']",
  message: "Prefer async/await over .then() chains.",
};

const NO_MATH_RANDOM = {
  selector: "MemberExpression[object.name='Math'][property.name='random']",
  message:
    "Use SeededRNG instead of Math.random() in game-core. This ensures deterministic game state.",
};

const typedLanguageOptions = {
  parser: tseslint.parser,
  parserOptions: {
    projectService: {
      allowDefaultProject: [
        "*.ts",
        "*.mts",
        "apps/*/vitest.config.ts",
        "apps/*/vite.config.ts",
        "apps/*/vitest.setup.ts",
        "apps/*/src/*.test.ts",
        "apps/*/src/*.test.tsx",
        "apps/*/src/ai/*.test.ts",
        "apps/*/src/components/*.test.ts",
        "apps/*/src/components/*.test.tsx",
        "apps/*/src/hooks/*.test.ts",
        "apps/*/src/sprites/*.test.ts",
        "apps/*/src/utils/*.test.ts",
        "apps/*/src/config/*.test.ts",
        "apps/*/src/api/*.test.ts",
        "apps/*/src/store/*.test.ts",
        "apps/server/api/*.ts",
        "packages/*/vitest.config.ts",
        "packages/*/src/test-utils.d.ts",
        "packages/*/src/*.test.ts",
        "packages/*/src/*.test.tsx",
        "packages/*/src/abilities/*.test.ts",
        "packages/*/src/abilities/runtime/*.test.ts",
        "packages/*/src/balance/*.test.ts",
        "packages/*/src/biomes/*.test.ts",
        "packages/*/src/enchantments/*.test.ts",
        "packages/*/src/enemies/*.test.ts",
        "packages/*/src/engine/*.test.ts",
        "packages/*/src/engine/handlers/*.test.ts",
        "packages/*/src/generation/*.test.ts",
        "packages/*/src/sprites/*.test.ts",
        "packages/*/src/utils/*.test.ts",
        "packages/*/src/items/*.test.ts",
        "packages/*/src/quests/*.test.ts",
        "packages/*/src/state/*.test.ts",
        "packages/*/src/systems/*.test.ts",
        "packages/*/src/testing/*.test.ts",
        "packages/*/src/validation/*.test.ts",
        "tools/balance/*.ts",
        "tools/balance/*.test.ts",
        "vitest.workspace.ts",
        "playwright.config.ts",
        "tests/contracts/*.contract.test.ts",
        "tests/e2e/*.spec.ts",
        "tests/vitest.config.ts",
      ],
      maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 8000,
    },
  },
};

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "**/*.d.ts",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "balance-results/**",
    ],
  },

  // Base config for all TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "no-console": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  // Tier 1: game-contracts + game-core (strictest)
  {
    files: [
      "packages/game-contracts/src/**/*.ts",
      "packages/game-core/src/**/*.ts",
    ],
    ignores: ["**/*.test.ts", "**/*.property.test.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "dungeon/no-array-mutation": "error",
      "dungeon/impure-getter": "error",
      "dungeon/prefer-await-over-then-chain": "error",
      "dungeon/no-implicit-boolean": "error",
      "no-restricted-syntax": [
        "error",
        NO_THEN_CHAIN,
        NO_MATH_RANDOM,
      ],
      complexity: ["warn", { max: 10 }],
      "max-depth": ["warn", 4],
      "max-lines-per-function": ["warn", { max: 80 }],
    },
  },

  // Tier 1.5: content + presenter
  {
    files: [
      "packages/content/src/**/*.ts",
      "packages/presenter/src/**/*.ts",
    ],
    ignores: ["**/*.test.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "dungeon/no-array-mutation": "error",
      "dungeon/impure-getter": "error",
      complexity: ["warn", { max: 10 }],
    },
  },

  // Server
  {
    files: ["apps/server/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-restricted-syntax": ["error", NO_THEN_CHAIN],
      "dungeon/prefer-await-over-then-chain": "error",
      "dungeon/no-array-mutation": "warn",
      complexity: ["warn", { max: 10 }],
      "max-lines-per-function": ["warn", { max: 100 }],
    },
  },

  // Web: general
  {
    files: ["apps/web/src/**/*.ts", "apps/web/src/**/*.tsx"],
    ignores: ["**/*.test.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      dungeon: pluginDungeon,
    },
    languageOptions: {
      ...typedLanguageOptions,
      parserOptions: {
        ...typedLanguageOptions.parserOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "no-restricted-syntax": ["error", NO_THEN_CHAIN],
      "dungeon/prefer-await-over-then-chain": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-array-index-key": "warn",
      "react/react-in-jsx-scope": "off",
      complexity: ["warn", { max: 10 }],
      "max-lines-per-function": ["warn", { max: 120 }],
    },
  },

  // Web: stricter sub-tier (hooks/store/api)
  {
    files: [
      "apps/web/src/hooks/**/*.ts",
      "apps/web/src/store/**/*.ts",
      "apps/web/src/api/**/*.ts",
    ],
    ignores: ["**/*.test.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "dungeon/no-array-mutation": "warn",
      "dungeon/impure-getter": "error",
    },
  },

  // Scripts top-level
  {
    files: [
      "scripts/analyze-session.ts",
      "scripts/balance-dashboard.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "dungeon/no-array-mutation": "off",
      "no-console": "off",
    },
  },

  // Scripts/balance
  {
    files: ["scripts/balance/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: typedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "dungeon/no-array-mutation": "off",
      "no-console": "off",
    },
  },

  // Tests
  {
    files: [
      "**/*.test.ts",
      "**/*.property.test.ts",
      "tests/e2e/**/*.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      vitest: pluginVitest,
      dungeon: pluginDungeon,
    },
    languageOptions: {
      ...typedLanguageOptions,
      globals: {
        ...pluginVitest.environments.env.globals,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "dungeon/no-array-mutation": "off",
      "dungeon/impure-getter": "off",
      "dungeon/no-implicit-boolean": "off",
      complexity: "off",
      "max-lines-per-function": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "warn",
    },
  },
);
