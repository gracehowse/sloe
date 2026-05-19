import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import supprTokens from "./eslint-plugin-suppr-tokens/index.mjs";

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
      // Suppr design-system enforcement (Next-10 #6 from
      // docs/ux/teardown-2026-04-28-daily-loop.md, 2026-04-28). Web
      // is Lucide via `lucide-react`. The React Native variant
      // `lucide-react-native` should never appear in web source —
      // an agent occasionally reaches for the wrong import path
      // because both packages have the same icon names. Hard error
      // here because zero existing violations means a hard fail
      // catches drift the moment it lands. The mobile counterpart
      // (forbid `@expo/vector-icons`) lives in
      // `apps/mobile/eslint.config.js` as a `warn` since ~64
      // legacy Ionicons usages migrate opportunistically.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react-native",
              message:
                "Web uses lucide-react. The React Native variant is for apps/mobile only. Both packages have the same icon names so the autocomplete trap is real — double-check the import path.",
            },
          ],
        },
      ],
    },
  },
  // Suppr token-enforcement plugin — Phase 1.5 of the UI elevation plan
  // (/Users/graceturner/.claude/plans/i-m-really-struggling-to-goofy-rivest.md).
  // Bans literal spacing / colour / font-size values so the design system
  // can't silently drift. Starts as `warn` for a 1-week grace window; flips
  // to `error` in Phase 4.1 once Phase 2-3 P0 surfaces have been cleaned.
  // Applies to web app only (mobile has its own eslint config; tests + stories
  // opt out below).
  {
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/*.stories.{ts,tsx}"],
    plugins: { "suppr-tokens": supprTokens },
    rules: {
      "suppr-tokens/no-literal-spacing": "warn",
      "suppr-tokens/no-literal-color": "warn",
      "suppr-tokens/no-literal-fontSize": "warn",
    },
  },
];
