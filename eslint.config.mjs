import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ---------------------------------------------------------------------------
// Suppr design-system colour guard (ENG-811, 2026-05-31)
//
// The 2026-05-31 redesign defines colour ONLY in the token files:
//   - web:    src/styles/theme.css  (--accent-win, --primary, --success, …)
//   - mobile: apps/mobile/constants/theme.ts  (Accent.win, Accent.primary, …)
//
// Without a guard the same drift that the redesign corrects (raw `#588CE4`
// hexes, `text-violet-600` / `bg-blue-500` Tailwind utilities scattered through
// component source) returns the moment a new component lands. These two
// `no-restricted-syntax` selectors flag that drift at lint time.
//
// SEVERITY: `warn`, deliberately. The web tree carries ~400 pre-existing raw
// hex + raw-Tailwind-colour usages (legit exceptions like third-party social
// brand hexes in source-badge.tsx, plus real drift to migrate). Shipping this
// at `error` would red the build immediately and block CI. `warn` surfaces the
// drift in lint output and lets each call-site be triaged against the token
// system without a hard stop. The `--max-warnings 500` cap (see the `lint`
// npm script) still bounds total drift so it can't balloon unnoticed.
//
// TO FLIP TO ERROR (after the redesign token sweep migrates the existing
// usages down to the documented allowlist): change `"warn"` to `"error"` in the
// rule entry below AND in the mobile counterpart
// (`apps/mobile/eslint.config.js`, ENG-811 mobile lane). Do this only once
// `npm run lint` reports zero of these two selectors firing, otherwise CI reds.
//
// ALLOWLIST (where raw colour values are correct and MUST live):
//   - src/styles/theme.css        — the web token definitions (CSS, not TS;
//                                    naturally outside the `src/**/*.{ts,tsx}`
//                                    glob below, so never linted by this rule)
//   - apps/mobile/constants/theme.ts — the mobile token definitions (lives in
//                                    the mobile tree, which is `ignores`-d here
//                                    and guarded by the mobile config instead)
//   - tests/**                    — fixtures legitimately assert literal colour
//                                    values; the selectors are NOT scoped to
//                                    tests (see the `files` glob on the block).
// ---------------------------------------------------------------------------
const SUPPR_RAW_COLOUR_SYNTAX = [
  {
    // Raw hex colour string literal, e.g. "#588CE4", '#fff', "#ff00aa80".
    // Anchored so it only matches a string that IS a hex colour — never an
    // anchor href like "#section" (non-hex chars) or "#home".
    selector:
      "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
    message:
      "Raw hex colour. Define colour in src/styles/theme.css as a --token and reference it (var(--token) / Tailwind token class). Token files are the only place a literal hex may live. See docs/planning/2026-05-31-redesign-implementation-plan.md (ENG-811).",
  },
  {
    // Raw Tailwind colour utility inside any string literal, e.g.
    // `text-violet-600`, `bg-blue-500`, `from-indigo-600`, `border-red-400`.
    // Matches the utility anywhere in a className string (template-literal
    // quasis are TemplateElement, covered by the second selector below).
    selector:
      "Literal[value=/(?:^|[\\s\"'`])(?:text|bg|from|to|via|border|ring|fill|stroke|decoration|outline|shadow|divide|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\\b/]",
    message:
      "Raw Tailwind colour utility. Use a semantic token class (e.g. text-primary, bg-[var(--accent-win)]) sourced from src/styles/theme.css instead of a raw palette colour. See docs/planning/2026-05-31-redesign-implementation-plan.md (ENG-811).",
  },
  {
    // Same Tailwind-utility check for className strings written as template
    // literals (`bg-blue-500 ${x}`), whose static parts are TemplateElement
    // nodes rather than string Literals.
    selector:
      "TemplateElement[value.raw=/(?:^|[\\s\"'`])(?:text|bg|from|to|via|border|ring|fill|stroke|decoration|outline|shadow|divide|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\\b/]",
    message:
      "Raw Tailwind colour utility (in a template literal). Use a semantic token class sourced from src/styles/theme.css instead of a raw palette colour. See docs/planning/2026-05-31-redesign-implementation-plan.md (ENG-811).",
  },
];

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
  // Suppr design-system colour guard (ENG-811). Scoped to component/source
  // trees only — `tests/**` is intentionally excluded so fixtures can assert
  // literal colour values. `src/styles/theme.css` is CSS and naturally outside
  // this `.{ts,tsx}` glob, so the web token file is never flagged. Starts at
  // `warn`; see the SUPPR_RAW_COLOUR_SYNTAX block above for the flip-to-error
  // procedure.
  {
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", ...SUPPR_RAW_COLOUR_SYNTAX],
    },
  },
];
