// @ts-check

import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import prettier from "eslint-plugin-prettier"
import eslintConfigPrettier from "eslint-config-prettier"

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        logseq: "readonly",
        console: "readonly",
      },
    },
    rules: {
      semi: "off", // Disable semicolon checks
      quotes: ["error", "double"], // Enforce double quotes
    },
  },
  // Add Prettier plugin (displays prettier errors as ESLint errors)
  {
    plugins: {
      prettier: prettier,
    },
    rules: {
      "prettier/prettier": [
        "error",
        {
          semi: false, // Tell prettier not to require semicolons
          singleQuote: false, // Use double quotes instead of single quotes
        },
      ],
    },
  },
  // Turns off ESLint rules that might conflict with prettier
  eslintConfigPrettier,
)
