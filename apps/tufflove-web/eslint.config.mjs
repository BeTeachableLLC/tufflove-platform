import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".vercel/**",
    "next-env.d.ts",
    // Local scripts / one-off fixers (not part of app runtime)
    "**/fix*.js",
    "**/repair*.js",
    "**/restore_app.js",
    "**/ignore_build_errors.js",
    "**/clean_garbage.js",
    // External bundles/vendor code
    "external/**",
  ]),
  // Enforce strict lint rules after cleanup.
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-require-imports": "error",
      "prefer-const": "error",
      "react/no-unescaped-entities": "error",
      "react/jsx-key": "error",
      "react-hooks/purity": "error",
    },
  },
]);

export default eslintConfig;
