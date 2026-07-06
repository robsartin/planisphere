// SPDX-License-Identifier: Apache-2.0
//
// ESLint 10 flat config. Replaces the ESLint 8 `.eslintrc.cjs` (removed in
// the same PR). Behaviourally equivalent — same rule set, same globs — but
// expressed as the flat-config array required by ESLint 9+ and consumed by
// the modern `typescript-eslint` unified helper.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".worktrees/**",
      "node_modules/**",
      "public/**",
      "pnpm-lock.yaml",
      // Build helpers under scripts/ are one-shot Node CLIs that intentionally
      // use `console.log` for progress output — the previous ESLint 8 config
      // never linted them (didn't traverse .mjs by default). Preserve that.
      "scripts/**",
      "**/*.cjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json", "./tsconfig.worker.json"],
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
        ecmaVersion: 2022,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Test / e2e / scripts / config files don't want the strict type-checked
    // rule set (parsing them under tsconfig would require adding them to
    // `include`, which pollutes the production compile). Fall back to the
    // untyped ruleset for these paths.
    files: [
      "**/*.test.ts",
      "e2e/**/*.ts",
      "scripts/**/*.mjs",
      "scripts/**/*.js",
      "*.mjs",
      "*.config.ts",
      "*.config.mjs",
      "*.config.js",
    ],
    ...tseslint.configs.disableTypeChecked,
  },
);
