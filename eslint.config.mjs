import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "dist/**",
      "apps/mobile/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "scripts/**",
      "supabase/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Ratchet: keep hooks/import hygiene as errors where possible; relax noisy
  // rules until the web tree is cleaned up incrementally (see CONTRIBUTING.md).
  {
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "off",
      "prefer-const": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
    },
  },
];
