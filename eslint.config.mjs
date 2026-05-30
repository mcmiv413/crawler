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

const STRUCTURAL_LINT_ENABLED = process.env.LINT_STRUCTURAL === "true";

const structuralRule = (rule) => STRUCTURAL_LINT_ENABLED ? rule : "off";

const typedLanguageOptions = {
  parser: tseslint.parser,
  parserOptions: {
    projectService: true,
  },
};

const untypedLanguageOptions = {
  parser: tseslint.parser,
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

  // Base config for all TypeScript files (untyped for speed)
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      dungeon: pluginDungeon,
    },
    languageOptions: untypedLanguageOptions,
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
      complexity: structuralRule(["warn", { max: 10 }]),
      "max-depth": structuralRule(["warn", 4]),
      "max-lines-per-function": structuralRule(["warn", { max: 80 }]),
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
      complexity: structuralRule(["warn", { max: 10 }]),
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
      complexity: structuralRule(["warn", { max: 10 }]),
      "max-lines-per-function": structuralRule(["warn", { max: 100 }]),
    },
  },

  // Web: general
  {
    files: ["apps/web/src/**/*.ts", "apps/web/src/**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
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
      complexity: structuralRule(["warn", { max: 10 }]),
      "max-lines-per-function": structuralRule(["warn", { max: 120 }]),
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

  // Scripts top-level (untyped - tooling, not core game code)
  {
    files: [
      "scripts/analyze-session.ts",
      "scripts/balance-dashboard.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: untypedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "dungeon/no-array-mutation": "off",
      "no-console": "off",
    },
  },

  // Scripts/balance (untyped - tooling, not core game code)
  {
    files: ["scripts/balance/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: untypedLanguageOptions,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "dungeon/no-array-mutation": "off",
      "no-console": "off",
    },
  },

  // Tests (typed) - type-aware rules enforced
  {
    files: [
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.property.test.ts",
      "tests/**/*.ts",
    ],
    ignores: ["tests/vitest.config.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      vitest: pluginVitest,
      dungeon: pluginDungeon,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: [
          "./apps/*/tsconfig.test.json",
          "./packages/*/tsconfig.test.json",
          "./tests/tsconfig.test.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
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
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "dungeon/no-mocked-subject-call": "error",
      "dungeon/no-unsafe-test-contract-cast": "error",
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
      "no-restricted-syntax": ["error", NO_MATH_RANDOM],
      "no-console": "off",
    },
  },

  // Presenter tests: keep unit fixtures local instead of pulling live content registries
  {
    files: ["packages/presenter/src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@dungeon/content",
              message:
                "Presenter tests should use local fixtures or presenter-level builders instead of live content registries.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["packages/presenter/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@dungeon/core/utils/dice",
              message:
                "Presenter preview logic should use the stable combat preview helpers from @dungeon/core instead of low-level dice helpers.",
            },
            {
              name: "@dungeon/core/utils/dice.js",
              message:
                "Presenter preview logic should use the stable combat preview helpers from @dungeon/core instead of low-level dice helpers.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["apps/web/src/hooks/**/*.ts", "apps/web/src/testing/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/components/BumpAnimations.js",
                "**/components/CombatIndicators.js",
              ],
              message:
                "Hooks and testing runtime code should import animation emitters from apps/web/src/animation-runtime/emitters.js, not render components.",
            },
          ],
        },
      ],
    },
  },

  // Runner configs (untyped for speed)
  {
    files: [
      "vitest.config.ts",
      "apps/*/vitest.config.ts",
      "apps/*/vite.config.ts",
      "apps/*/vitest.setup.ts",
      "packages/*/vitest.config.ts",
      "tests/vitest.config.ts",
      "playwright.config.ts",
      "scripts/**/*.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      dungeon: pluginDungeon,
    },
    languageOptions: {
      ...untypedLanguageOptions,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "dungeon/no-array-mutation": "off",
      "no-console": "off",
    },
  },

  // Game-core system tests: enforce resilient numeric assertions
  {
    files: ["packages/game-core/src/systems/**/*.test.ts"],
    rules: {
      "dungeon/no-numeric-toBe": "error",
    },
  },
);
