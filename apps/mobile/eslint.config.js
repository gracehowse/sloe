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
 * If you're adding a third rule here: keep it `warn` (not `error`)
 * unless you've verified zero existing violations across the tree.
 * CI runs with `--max-warnings 500` and breaking that cap is loud.
 */
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
  // Today component tree: enforce design-system tokens for raw style
  // literals. Scoped tightly so the rest of the tree's legacy
  // literals stay as warnings against an unscoped rule's risk of
  // overwhelming the lint budget. Expand scope as more components
  // get cleaned up.
  {
    files: [
      'app/(tabs)/index.tsx',
      'components/today/**/*.{ts,tsx}',
      'components/charts/CalorieRing.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['warn', ...SUPPR_RESTRICTED_STYLE_LITERALS],
    },
  },
]);
