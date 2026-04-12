/**
 * ESLint plugin for functional programming patterns.
 * Contains rules not available in standard ESLint or TypeScript-ESLint
 */
import type { Rule } from "eslint";
import type {
  ArrowFunctionExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  MemberExpression,
  MethodDefinition,
  Node,
  VariableDeclarator,
} from "estree" with { "resolution-mode": "import" };

interface NoArrayMutationOptions {
  allowedVariables?: string[];
  allowedPatterns?: string[];
  methods?: string[];
  ignoreThis?: boolean;
}

interface PreferAwaitOptions {
  maxChainLength?: number;
}

interface NoImplicitBooleanOptions {
  ignoreNullish?: boolean;
  allowedPatterns?: string[];
}

interface PreferConsoleInfoOptions {
  allowedFunctions?: string[];
}

const DEFAULT_ALLOWED_VARIABLES: readonly string[] = [] as const;
const DEFAULT_MUTATING_METHODS = [
  "push",
  "splice",
  "shift",
  "unshift",
  "pop",
  "sort",
  "reverse",
  "copyWithin",
  "fill",
] as const;

// Utility Functions

const isGetterName = (name: string | null | undefined): boolean =>
  name !== null && name !== undefined && /^get[A-Z]/.test(name);

const isMemberExpressionWithIdentifier = (
  node: Node,
): node is MemberExpression & {
  object: Identifier;
  property: Identifier;
} => {
  if (node.type !== "MemberExpression") return false;
  const member = node as MemberExpression;
  return (
    member.object.type === "Identifier" && member.property.type === "Identifier"
  );
};

const getPropertyName = (node: MemberExpression): string | null =>
  node.property.type === "Identifier"
    ? (node.property as Identifier).name
    : null;

const getObjectName = (node: MemberExpression): string | null =>
  node.object.type === "Identifier" ? (node.object as Identifier).name : null;

const isObviousIOInGetter = (node: Node): boolean => {
  if (node.type !== "CallExpression") return false;
  const callExpr = node as CallExpression;
  const { callee } = callExpr;

  if (callee.type === "Identifier" && (callee as Identifier).name === "fetch") {
    return true;
  }

  if (isMemberExpressionWithIdentifier(callee) === false) return false;
  const objectName = getObjectName(callee);
  const propertyName = getPropertyName(callee);
  const sideEffectObjects = ["console", "fs", "axios"];
  if (
    objectName !== null &&
    objectName !== undefined &&
    sideEffectObjects.includes(objectName)
  ) {
    return true;
  }

  const sideEffectMethods = ["write", "send"];
  return propertyName !== null && sideEffectMethods.includes(propertyName);
};

const extractChildNodes = (value: unknown): Node[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object") as Node[];
  }
  if (value && typeof value === "object") {
    return [value as Node];
  }
  return [];
};

const findObviousIO = (rootNode: Node): boolean => {
  const skipKeys = new Set(["parent", "loc", "range"]);
  const leafTypes = new Set(["Identifier", "Literal", "TemplateElement"]);

  const processNode = (node: Node): boolean => {
    if (node === null || node === undefined || typeof node !== "object")
      return false;
    if (leafTypes.has(node.type)) return false;
    if (isObviousIOInGetter(node)) return true;

    const childNodes = Object.keys(node)
      .filter((key) => skipKeys.has(key) === false)
      .flatMap((key) =>
        extractChildNodes((node as unknown as Record<string, unknown>)[key]),
      );

    return childNodes.some(processNode);
  };

  return processNode(rootNode);
};

const isThenCall = (node: Node): boolean => {
  if (node.type !== "CallExpression") return false;
  const callExpr = node as CallExpression;
  return (
    callExpr.callee.type === "MemberExpression" &&
    getPropertyName(callExpr.callee as MemberExpression) === "then"
  );
};

const countThenChain = (startNode: CallExpression): number => {
  const countRecursive = (current: CallExpression | null): number => {
    if (current === null || current === undefined) return 0;
    if (isThenCall(current) === false) return 0;

    const callee = current.callee;
    if (callee.type === "MemberExpression") {
      const memberExpr = callee as MemberExpression;
      if (
        memberExpr.object.type === "CallExpression" &&
        isThenCall(memberExpr.object)
      ) {
        return 1 + countRecursive(memberExpr.object as CallExpression);
      }
      return 1;
    }
    return 0;
  };
  return countRecursive(startNode);
};

// Rule Definitions

const rules: Record<string, Rule.RuleModule> = {
  "no-array-mutation": {
    meta: {
      type: "suggestion",
      docs: {
        description:
          "Disallow array mutation methods; prefer immutable patterns. " +
          "Use 'mutable' prefix (e.g., mutableCache) for rare exceptions.",
        category: "Functional Programming",
        recommended: true,
      },
      messages: {
        noArrayMutation:
          "Array mutation detected; prefer spreading or immutable utilities. " +
          "If unavoidable, rename variable with 'mutable' prefix.",
      },
      schema: [
        {
          type: "object",
          properties: {
            allowedVariables: {
              type: "array",
              items: { type: "string" },
            },
            allowedPatterns: {
              type: "array",
              items: { type: "string" },
            },
            methods: {
              type: "array",
              items: { type: "string" },
            },
            ignoreThis: {
              type: "boolean",
              default: true,
            },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context: any): Rule.RuleListener {
      const options = (context.options[0] as NoArrayMutationOptions) ?? {};
      const allowedVariables = new Set(
        options.allowedVariables ?? DEFAULT_ALLOWED_VARIABLES,
      );
      const allowedPatterns = (options.allowedPatterns ?? ["^mutable"]).map(
        (pattern) => new RegExp(pattern),
      );
      const mutatingMethods = new Set(
        options.methods ?? DEFAULT_MUTATING_METHODS,
      );
      const ignoreThis = options.ignoreThis ?? true;

      return {
        CallExpression(node: Node): void {
          const callExpr = node as CallExpression;
          if (callExpr.callee.type !== "MemberExpression") return;
          const memberExpr = callExpr.callee as MemberExpression;
          const methodName = getPropertyName(memberExpr);
          if (!methodName || !mutatingMethods.has(methodName)) return;
          const { object } = memberExpr;

          if (ignoreThis && object.type === "ThisExpression") return;

          const objectName =
            object.type === "Identifier" ? (object as Identifier).name : null;
          if (objectName && allowedVariables.has(objectName)) return;

          if (
            objectName &&
            allowedPatterns.some((pattern) => pattern.test(objectName))
          )
            return;

          context.report({ node, messageId: "noArrayMutation" });
        },
      };
    },
  },

  "impure-getter": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Detect obvious I/O operations in getter functions (console, fs, fetch, axios). " +
          "This is NOT comprehensive purity analysis.",
        category: "Functional Programming",
        recommended: true,
      },
      messages: {
        impureGetter:
          "Obvious I/O detected in getter function (console/fs/fetch/axios).",
      },
      schema: [],
    },
    create(context: any): Rule.RuleListener {
      const checkFunction = (
        node:
          | FunctionDeclaration
          | FunctionExpression
          | ArrowFunctionExpression,
        nameNode: Identifier,
      ): void => {
        if (!isGetterName(nameNode.name)) return;
        if (node.body && findObviousIO(node.body)) {
          context.report({ node: nameNode, messageId: "impureGetter" });
        }
      };

      return {
        FunctionDeclaration(node: Node): void {
          const funcDecl = node as FunctionDeclaration;
          if (funcDecl.id !== null && funcDecl.id !== undefined) {
            checkFunction(funcDecl, funcDecl.id as Identifier);
          }
        },
        VariableDeclarator(node: Node): void {
          const varDecl = node as VariableDeclarator;
          if (
            varDecl.id.type === "Identifier" &&
            varDecl.init &&
            (varDecl.init.type === "FunctionExpression" ||
              varDecl.init.type === "ArrowFunctionExpression")
          ) {
            checkFunction(
              varDecl.init as FunctionExpression | ArrowFunctionExpression,
              varDecl.id as Identifier,
            );
          }
        },
        MethodDefinition(node: Node): void {
          const methodDef = node as MethodDefinition;
          if (
            methodDef.key.type === "Identifier" &&
            methodDef.value?.type === "FunctionExpression" &&
            isGetterName((methodDef.key as Identifier).name)
          ) {
            checkFunction(
              methodDef.value as FunctionExpression,
              methodDef.key as Identifier,
            );
          }
        },
      };
    },
  },

  "prefer-await-over-then-chain": {
    meta: {
      type: "suggestion",
      docs: {
        description: "Prefer async/await over chained .then() calls",
        category: "Async Patterns",
        recommended: true,
      },
      messages: {
        preferAwait:
          "Multiple .then calls detected; consider async/await for clarity.",
      },
      schema: [
        {
          type: "object",
          properties: {
            maxChainLength: {
              type: "number",
              default: 2,
            },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context: any): Rule.RuleListener {
      const options = (context.options[0] as PreferAwaitOptions) ?? {};
      const maxChainLength = options.maxChainLength ?? 2;

      return {
        CallExpression(node: Node): void {
          const callExpr = node as CallExpression & { parent?: Node };
          if (!isThenCall(callExpr)) return;

          const parent = callExpr.parent;
          if (
            parent?.type === "MemberExpression" &&
            (parent as Node & { parent?: Node }).parent?.type ===
              "CallExpression"
          ) {
            const grandparent = (parent as Node & { parent?: Node }).parent;
            if (grandparent && isThenCall(grandparent)) {
              return;
            }
          }

          const count = countThenChain(callExpr);
          if (count >= maxChainLength) {
            context.report({ node, messageId: "preferAwait" });
          }
        },
      };
    },
  },

  "no-implicit-boolean": {
    meta: {
      type: "suggestion",
      docs: {
        description:
          "Require explicit boolean comparisons instead of implicit truthiness checks.",
        category: "Functional Programming",
        recommended: true,
      },
      messages: {
        explicitComparison:
          "Use explicit comparison (=== true, === false, !== null, !== undefined) instead of implicit boolean coercion.",
        invalidComparison:
          "Comparison should be against boolean, null, or undefined.",
      },
      schema: [
        {
          type: "object",
          properties: {
            ignoreNullish: {
              type: "boolean",
              default: false,
            },
            allowedPatterns: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context: any): Rule.RuleListener {
      const options = (context.options[0] as NoImplicitBooleanOptions) ?? {};
      const allowedPatterns = new Set(options.allowedPatterns ?? []);
      const ignoreNullish = options.ignoreNullish ?? false;

      const isBooleanLikeString = (node: Node): boolean => {
        if (node.type === "Literal") {
          const literal = node as { value: unknown };
          return (
            literal.value === "true" ||
            literal.value === "false" ||
            literal.value === "1" ||
            literal.value === "0"
          );
        }
        return false;
      };

      const getNodeString = (node: Node): string => {
        if (node.type === "Identifier") {
          return (node as Identifier).name;
        }
        if (node.type === "MemberExpression") {
          const memberExpr = node as MemberExpression;
          const obj = getNodeString(memberExpr.object);
          const prop =
            memberExpr.property.type === "Identifier"
              ? (memberExpr.property as Identifier).name
              : "?";
          return `${obj}.${prop}`;
        }
        if (node.type === "Literal") {
          const literal = node as { value: unknown };
          return typeof literal.value === "string"
            ? `"${literal.value}"`
            : String(literal.value);
        }
        return "expression";
      };

      const isAllowedPattern = (node: Node): boolean => {
        const nodeType = node.type;
        return (
          allowedPatterns.has(nodeType) ||
          nodeType === "LogicalExpression" ||
          nodeType === "Literal"
        );
      };

      const isNullishPattern = (node: Node): boolean => {
        return (
          (node.type === "LogicalExpression" &&
            (node as { operator?: string }).operator === "??") ||
          node.type === "ChainExpression"
        );
      };

      const checkTest = (test: Node | null | undefined): void => {
        if (test === null || test === undefined) return;

        if (test.type === "BinaryExpression") {
          const binaryExpr = test as {
            left: Node;
            right: Node;
            operator: string;
          };
          const { left, right, operator } = binaryExpr;

          if (
            operator === "===" ||
            operator === "!==" ||
            operator === "==" ||
            operator === "!="
          ) {
            if (
              (left.type === "Identifier" || left.type === "MemberExpression") &&
              isBooleanLikeString(right)
            ) {
              context.report({
                node: test,
                messageId: "invalidComparison",
              });
            }

            if (
              (right.type === "Identifier" ||
                right.type === "MemberExpression") &&
              isBooleanLikeString(left)
            ) {
              context.report({
                node: test,
                messageId: "invalidComparison",
              });
            }
          }
          return;
        }

        if (isAllowedPattern(test)) return;

        if (ignoreNullish && isNullishPattern(test)) return;

        if (test.type === "Identifier" || test.type === "MemberExpression") {
          context.report({ node: test, messageId: "explicitComparison" });
        }

        if (
          test.type === "UnaryExpression" &&
          (test as { operator: string }).operator === "!" &&
          ((test as { argument: Node }).argument.type === "Identifier" ||
            (test as { argument: Node }).argument.type === "MemberExpression")
        ) {
          context.report({ node: test, messageId: "explicitComparison" });
        }
      };

      return {
        IfStatement(node: Node): void {
          const ifStmt = node as { test: Node };
          checkTest(ifStmt.test);
        },
        WhileStatement(node: Node): void {
          const whileStmt = node as { test: Node };
          checkTest(whileStmt.test);
        },
        DoWhileStatement(node: Node): void {
          const doWhileStmt = node as { test: Node };
          checkTest(doWhileStmt.test);
        },
        ConditionalExpression(node: Node): void {
          const condExpr = node as { test: Node };
          checkTest(condExpr.test);
        },
      };
    },
  },

  "prefer-console-info": {
    meta: {
      type: "suggestion",
      docs: {
        description:
          "Prefer console.info over console.log for informational messages",
        category: "Code Quality",
        recommended: true,
      },
      fixable: "code",
      messages: {
        useConsoleInfo:
          "Use console.info for informational messages instead of console.log.",
      },
      schema: [
        {
          type: "object",
          properties: {
            allowedFunctions: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context: any): Rule.RuleListener {
      const options = (context.options[0] as PreferConsoleInfoOptions) ?? {};
      const allowedFunctions = new Set(
        options.allowedFunctions ?? ["error", "warn", "debug", "trace"],
      );

      return {
        CallExpression(node: Node): void {
          const callExpr = node as CallExpression;
          if (callExpr.callee.type !== "MemberExpression") return;
          const memberExpr = callExpr.callee as MemberExpression;
          const objectName = getObjectName(memberExpr);
          const propertyName = getPropertyName(memberExpr);

          if (
            objectName === "console" &&
            propertyName === "log" &&
            allowedFunctions.has("log") === false
          ) {
            context.report({
              node,
              messageId: "useConsoleInfo",
              fix(fixer) {
                const property = memberExpr.property as Identifier;
                return fixer.replaceText(property, "info");
              },
            });
          }
        },
      };
    },
  },
};

module.exports = { rules };
