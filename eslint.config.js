import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tsTypeCheckedConfigs = tseslint.configs["flat/recommended-type-checked"].map(
  (config) => ({
    ...config,
    files: ["**/*.ts"]
  })
);

const tsStylisticTypeCheckedConfigs = tseslint.configs[
  "flat/stylistic-type-checked"
].map((config) => ({
  ...config,
  files: ["**/*.ts"]
}));

export default [
  {
    ignores: ["dist/**", "node_modules/**", "out/**", "coverage/**"]
  },
  js.configs.recommended,
  ...tsTypeCheckedConfigs,
  ...tsStylisticTypeCheckedConfigs,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json", "./test/tsconfig.json"],
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"]
    }
  }
];
