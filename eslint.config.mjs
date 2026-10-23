import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Personal overlay (git-ignored, see docs/private-overlay.md); lint covers the public code.
    "private/**",
    // Packaged Windows shell output.
    "windows/dist/**",
  ]),
  // The Electron shell (windows/) is plain CommonJS, as Electron main and preload scripts load it.
  {
    files: ["windows/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
