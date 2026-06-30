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
 *    verified ZERO-violation baseline — so it can ship at `warn` and a
 *    NEW raw hex shows up loudly in lint output. The token file
 *    (`constants/theme.ts`) is the only legal home for a literal hex and
 *    sits outside these `files` globs, so it is never linted. The
 *    Apple-HIG `#000` / `#fff` on `app/login.tsx` +
 *    `components/onboarding/steps/signup.tsx` are a brand-mandated carve-
 *    out (see `_project-context.md`) and are NOT in the scoped globs.
 *
 * If you're adding a fourth rule here: keep it `warn` (not `error`)
 * unless you've verified zero existing violations across the tree.
 * CI runs with `--max-warnings 500` and breaking that cap is loud.
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
        },
      ],
    },
  },
  // Today screen tree: enforce design-system tokens for raw style
  // literals + raw hex colours. Scoped tightly so the rest of the tree's
  // legacy literals stay as warnings against an unscoped rule's risk of
  // overwhelming the lint budget. The raw-hex guard (ENG-811 mobile lane)
  // rides along here because the Today screen + its component tree were
  // migrated to zero raw hexes (ENG-1013).
  {
    files: ['app/(tabs)/index.tsx', 'components/today/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        ...SUPPR_RESTRICTED_STYLE_LITERALS,
        ...SUPPR_RAW_HEX_SYNTAX,
      ],
    },
  },
  // CalorieRing keeps the style-literal guard but is held OUT of the
  // raw-hex lane (and out of the ENG-1013 target tree — it's
  // `components/charts/`, not a screen): its plum overflow-ramp
  // `to`-stops (#A589B5 / #7A5890, the "~1.5 shades up" wrap tone) have
  // no matching theme token, so adding the hex guard here would either
  // red on a real unmapped value or force an invented token, which
  // ENG-1013 forbids. Naming a token for those two ramp stops is a
  // CalorieRing-specific colour decision, deferred to the colour-token
  // owner; until then this stays style-literals only.
  {
    files: ['components/charts/CalorieRing.tsx'],
    rules: {
      'no-restricted-syntax': ['warn', ...SUPPR_RESTRICTED_STYLE_LITERALS],
    },
  },
  // ENG-811 mobile raw-hex lane — the rest of the ENG-1013 target screen
  // tree (the census-named tabs + recipe detail). These files carry the
  // full legacy baseline of style-literal warnings that we are NOT
  // surfacing yet (that scope-expansion is a separate cleanup), so this
  // block runs ONLY the raw-hex selector. Disjoint from the today block
  // above (no `index.tsx` / `components/today/**` overlap), so the two
  // `no-restricted-syntax` entries never clobber each other under flat
  // config's last-match-wins semantics. Verified zero-violation baseline.
  {
    files: [
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
    ],
    rules: {
      'no-restricted-syntax': ['warn', ...SUPPR_RAW_HEX_SYNTAX],
    },
  },
]);
