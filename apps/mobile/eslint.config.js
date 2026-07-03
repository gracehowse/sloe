// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Suppr design-system enforcement rules (Next-10 #6 from
 * `docs/ux/teardown-2026-04-28-daily-loop.md`, 2026-04-28).
 *
 * Two preventive rules layered on top of the Expo preset:
 *
 * 1. `no-restricted-syntax` — flag raw numeric / string literals on
 *    style properties that have a documented design-system token
 *    (fontSize / fontWeight / padding* / margin* / borderRadius /
 *    gap). The fix is to import from `@/constants/theme` and use
 *    `Type.*`, `FontWeight.*`, `Spacing.*`, `Radius.*`. Documented
 *    in `docs/ux/design-system.md` and `docs/ux/brand-tokens.md`.
 *    Severity: `warn`, scoped to the Today component tree where
 *    drift is most observable. The rest of `apps/mobile/**` carries
 *    a baseline of legacy literals — those migrate opportunistically
 *    as files are touched. Expanding the scope from "today/" to
 *    `components/**` and `app/**` is a follow-up once the today/
 *    tree is clean.
 *
 * 2. `no-restricted-imports` — flag `@expo/vector-icons` Ionicons
 *    imports. The icon library decision (2026-04-28, Top-5 #4) was
 *    Lucide on both platforms; existing Ionicons usages migrate
 *    opportunistically. Severity: `warn`, mobile-wide. ~64 existing
 *    violations are absorbed by the package.json `--max-warnings`
 *    cap. New code uses `lucide-react-native`.
 *
 * 3. `no-restricted-syntax` raw-hex guard (`SUPPR_RAW_HEX_SYNTAX`, the
 *    ENG-811 mobile lane) — flag raw hex colour string literals
 *    (`"#fff"`, `'#3B2A4D'`, `"#00000088"`). The fix is a token from
 *    `@/constants/theme` (`Accent.*` / `Colors.*.*` / `MacroColors.*`
 *    / `ShadowColor.*`, or `colors.*` from `useThemeColors()`). Mirrors
 *    the web guard (`eslint.config.mjs`, `SUPPR_RAW_COLOUR_SYNTAX`).
 *    Scoped to the SCREEN TREE that ENG-1013 migrated to zero raw hexes
 *    (the four tabs the census named + recipe detail), where it holds a
 *    verified ZERO-violation baseline — so it ships at `error` and a
 *    NEW raw hex fails mobile lint immediately. The token file
 *    (`constants/theme.ts`) is the only legal home for a literal hex and
 *    sits outside these `files` globs, so it is never linted. The
 *    Apple-HIG `#000` / `#fff` on `app/login.tsx` +
 *    `components/onboarding/steps/signup.tsx` are a brand-mandated carve-
 *    out (see `_project-context.md`) and are NOT in the scoped globs.
 *
 * If you're adding a fourth rule here: keep it `warn` (not `error`)
 * unless you've verified zero existing violations across the tree. Raw-hex
 * enforcement is the exception: its scoped baseline is clean, so it is an
 * error-level CI gate.
 */
const SUPPR_RAW_HEX_SYNTAX = [
  {
    // Raw hex colour string literal, e.g. "#fff", '#3B2A4D', "#00000088".
    // Anchored to a full hex value so an anchor/route fragment like
    // "#section" (non-hex chars) never matches. Mirrors web
    // `SUPPR_RAW_COLOUR_SYNTAX` selector 1 in `eslint.config.mjs`.
    selector:
      "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
    message:
      "Raw hex colour. Use a token from @/constants/theme (Accent.* / Colors.*.* / MacroColors.* / ShadowColor.*, or colors.* from useThemeColors()). constants/theme.ts is the only place a literal hex may live (ENG-1013 / ENG-811).",
  },
];

const SUPPR_RESTRICTED_STYLE_LITERALS = [
  {
    selector: "Property[key.name='fontSize'][value.type='Literal']",
    message:
      "Don't hardcode fontSize. Import from @/constants/theme and use Type.headline / Type.body / etc. — see docs/ux/design-system.md.",
  },
  {
    selector: "Property[key.name='fontWeight'][value.type='Literal']",
    message:
      "Don't hardcode fontWeight. Use FontWeight.regular/medium/semibold/bold/heavy from @/constants/theme.",
  },
  {
    selector: "Property[key.name=/^padding/][value.type='Literal']",
    message:
      "Don't hardcode padding values. Use Spacing.xs/sm/md/lg/xl/xxl/xxxl from @/constants/theme.",
  },
  {
    selector: "Property[key.name=/^margin/][value.type='Literal']",
    message:
      "Don't hardcode margin values. Use Spacing.xs/sm/md/lg/xl/xxl/xxxl from @/constants/theme.",
  },
  {
    selector: "Property[key.name='borderRadius'][value.type='Literal']",
    message:
      "Don't hardcode borderRadius. Use Radius.sm/md/lg/xl/full from @/constants/theme. Cards always use Radius.lg.",
  },
  {
    selector: "Property[key.name='gap'][value.type='Literal']",
    message:
      "Don't hardcode gap values. Use Spacing.xs/sm/md/lg/xl/xxl/xxxl from @/constants/theme.",
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // Mobile-wide: forbid Ionicons imports (Lucide is canonical, decided
  // 2026-04-28 — see Top-5 #4 in the teardown doc).
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message:
                'Use lucide-react-native instead. The team standardised on Lucide on both platforms (2026-04-28, Top-5 #4 in docs/ux/teardown-2026-04-28-daily-loop.md). Existing Ionicons usages migrate opportunistically; new code uses Lucide.',
            },
          ],
          // ENG-1345 — collapse the dual nutrition-import alias to ONE mobile
          // boundary. Mobile imports nutrition modules from
          // `@suppr/nutrition-core/*` (the curated, server-free barrel; its
          // shims re-export `src/lib/nutrition/*`), never `@suppr/shared/
          // nutrition/*`. Verified zero-violation baseline after the codemod,
          // so any new dual-spelled import is flagged. Warn-level to match the
          // Ionicons guard's opportunistic-migration posture.
          patterns: [
            {
              group: ['@suppr/shared/nutrition/*'],
              message:
                'Import mobile nutrition modules from @suppr/nutrition-core/* (the single curated boundary), not @suppr/shared/nutrition/*. ENG-1345 collapsed the dual spelling; nutrition-core re-exports src/lib/nutrition/*.',
            },
          ],
        },
      ],
    },
  },
  // Today screen tree: enforce design-system tokens for raw style
  // literals + raw hex colours. Scoped tightly so the rest of the tree's
  // legacy literals stay as warnings against an unscoped rule's risk of
  // overwhelming the lint budget. The raw-hex guard (ENG-811 mobile lane)
  // rides along here because the Today screen + its component tree were
  // migrated to zero raw hexes (ENG-1013). Style literal warnings stay
  // separate from the error-level raw-hex block below so flat-config
  // last-match-wins semantics do not downgrade colour enforcement.
  {
    files: ['app/(tabs)/index.tsx', 'components/today/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        ...SUPPR_RESTRICTED_STYLE_LITERALS,
      ],
    },
  },
  // ENG-811 mobile raw-hex lane — the rest of the ENG-1013 target screen
  // tree (the census-named tabs + recipe detail) plus CalorieRing. These
  // files carry the full legacy baseline of style-literal warnings that we
  // are NOT surfacing yet (that scope-expansion is a separate cleanup), so
  // this block runs ONLY the raw-hex selector. It intentionally repeats the
  // Today screen files after their style-literal warning block so flat-config
  // last-match-wins semantics upgrade colour enforcement to error without
  // also promoting the legacy style-literal warnings. Verified zero-violation
  // raw-hex baseline.
  // CalorieRing joined the lane in ENG-1269: its plum overflow-ramp `to`-stops
  // (#A589B5 / #7A5890) were tokenised (`Colors.*.ringOverflowTo`, value-equal)
  // so the file now holds zero raw hexes and is held to the no-raw-hex rule.
  {
    files: [
      'app/(tabs)/index.tsx',
      'components/today/**/*.{ts,tsx}',
      'app/(tabs)/planner.tsx',
      'app/(tabs)/library.tsx',
      'app/(tabs)/discover.tsx',
      'app/(tabs)/progress.tsx',
      'app/(tabs)/barcode.tsx',
      'app/(tabs)/recipes.tsx',
      'app/(tabs)/more.tsx',
      'app/(tabs)/notifications.tsx',
      'app/(tabs)/settings.tsx',
      'app/recipe/[id].tsx',
      'components/charts/CalorieRing.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...SUPPR_RAW_HEX_SYNTAX],
    },
  },
]);
