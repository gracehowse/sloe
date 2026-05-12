import { Platform } from 'react-native';

/**
 * Suppr brand accents (mobile). Aligned with the web design-overhaul palette.
 * Primary: `Accent.primary` (#4c6ce0 blue). Use `Brand.gradient` for hero highlights only.
 * Canonical roles: `docs/ux/brand-tokens.md`.
 */
/** Accent palette — aligned with web CSS custom properties in theme.css */
export const Accent = {
  primary: '#4c6ce0',
  /**
   * Canonical foreground colour for anything sitting on top of
   * Accent.primary (CTAs, segmented-active states, halo pills). Always
   * pure white — matches web's `--primary-foreground: #ffffff` token in
   * both light and dark modes (the `Accent.primary` indigo is dark
   * enough that white-on-indigo passes WCAG AA contrast 5.7:1; the
   * previous `#0a0a0f` near-black on indigo only hit ~3.1:1, failing AA
   * for normal text). Grace cohort 2026-05-12: standardised across
   * onboarding to match the rest of the app + web.
   */
  primaryForeground: '#ffffff',
  primaryLight: '#6c8cff',
  success: '#22a860',
  successLight: '#4cd080',
  warning: '#e8a020',
  warningLight: '#ffc04c',
  destructive: '#e04848',
  destructiveLight: '#ff6c6c',
  cyan: '#06b6d4',
  orange: '#f97316',
  magenta: '#e04888',
  /** Info / carbs-style accent (aligned with web macro-carbs tone where needed) */
  info: '#0ea5e9',
};

/**
 * Stimulant tracker colours (Batch 2.5 hydration & stimulants).
 * Caffeine is its own violet tone (not a macro role). Alcohol uses the
 * same amber hue as the warning accent — the semantic is "approaching
 * weekly limit", not error. Mirrors web `--stimulant-caffeine` /
 * `--stimulant-alcohol` in `src/styles/theme.css`. See
 * `docs/ux/brand-tokens.md` for the full role table.
 */
export const StimulantColors = {
  caffeine: '#8b5cf6',
  alcohol: '#f59e0b',
};

/**
 * `Neon` legacy alias was deleted 2026-04-28 (Next-10 #15 from
 * `docs/ux/teardown-2026-04-28-daily-loop.md`). It existed to make
 * pre-overhaul violet-palette imports compile during the 2026
 * design migration; by 2026-04-28 no production code referenced it
 * (audit-confirmed zero `Neon.` callers). New code uses `Accent.*`
 * directly. The `MacroColors` exports below already use `Accent.*`
 * as their source of truth.
 */

/** Macro-specific colors — aligned with web --macro-* CSS custom properties */
export const MacroColors = {
  calories: Accent.success,       // web: --macro-calories (#22a860)
  protein: Accent.primary,        // web: --macro-protein  (#4c6ce0)
  carbs: Accent.warning,          // web: --macro-carbs    (#e8a020)
  fat: Accent.magenta,            // web: --macro-fat      (#e04888)
  fiber: Accent.success,
  sugar: Accent.primaryLight,
  sodium: Accent.orange,
  water: Accent.cyan,
};

/**
 * Meal-slot tint roles — aligned with web `--slot-*` CSS custom properties.
 *
 * 2026-05-01 (ui-critic P2 #10): Snacks previously borrowed
 * `MacroColors.fat` (magenta) for its slot-header tint, which collided
 * 1:1 with the Fat macro tile on the same Today screen. Same hue, two
 * unrelated meanings — confusing to scan. Snacks now ships its own
 * cyan token; macro tokens stay reserved for the Macro tile row.
 *
 * Roles:
 *   - Breakfast → amber  (Accent.warning)
 *   - Lunch     → green  (Accent.success)
 *   - Dinner    → blue   (Accent.primary)
 *   - Snack     → cyan   (`#06b6d4`) — distinct from `MacroColors.fat`
 */
export const SlotColors = {
  breakfast: Accent.warning,      // web: --slot-breakfast (amber)
  lunch: Accent.success,          // web: --slot-lunch     (green)
  dinner: Accent.primary,         // web: --slot-dinner    (brand blue)
  snack: '#06b6d4',               // web: --slot-snack     (cyan)
};

/**
 * Brand tokens. The `violet` and `pink` deprecated aliases were
 * deleted 2026-04-28 (Next-10 #15) — zero production code
 * referenced them. Use `Brand.primary` (`#4c6ce0` blue) and
 * `Brand.accent` (`#e04888` magenta) directly. The gradient is
 * still exposed for marketing CTAs and hero sections only — never
 * use it inside the product UI per
 * `docs/ux/brand-guidelines.md` Section 9.
 */
export const Brand = {
  primary: Accent.primary,
  accent: Accent.magenta,
  gradient: [Accent.primary, Accent.magenta] as const,
};

/**
 * Dark-first color system.
 *
 * Cross-platform alignment (2026-04-18, updated 2026-04-20):
 *   - Foreground / border / input-bg hexes mirror `src/styles/theme.css`
 *     so a side-by-side comparison of mobile and web doesn't betray
 *     two different hue families (slate vs neutral-zinc).
 *   - **Background + card** now match web exactly per Grace's
 *     2026-04-20 review: "the background is better on the prototype
 *     (the slight grey tone, emphasising the white boxes)". Mobile
 *     used to render pure-white bg + pure-white cards, which made
 *     cards invisible against the backdrop. The Claude prototype's
 *     `--bg: #f4f5f7` + `--card: #ffffff` gives the correct slight
 *     separation; we now ship the same tokens on mobile.
 *   - Dark mode: mobile keeps `#0a0a0f` (OLED-friendly) over web's
 *     `#101014` (raised). The difference is sub-perceptible and the
 *     OLED-black on mobile is still the right default; revisit if
 *     Grace flags dark mode.
 */
export const Colors = {
  light: {
    text: '#111118',                // ↔ web --foreground
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    background: '#f4f5f7',          // ↔ web --bg (prototype tint)
    backgroundSecondary: '#f8fafc',
    card: '#ffffff',                // ↔ web --card (pure white boxes)
    cardBorder: '#e4e4ec',          // ↔ web --border
    border: '#e4e4ec',              // ↔ web --border
    tint: Accent.primary,
    icon: '#6b6b78',                // ↔ web --fg-muted
    tabIconDefault: '#94a3b8',
    tabIconSelected: Accent.primary,
    inputBg: '#ededf2',             // ↔ web --input-background
    overlay: '#00000088',
    /** Production design spec §1.6 source / provenance dots. Mirrors web
     *  --source-* tokens. */
    sourceUsda: '#22a860',
    sourceOff: '#4c6ce0',
    sourceFatsecret: '#f97316',
    sourceManual: '#94a3b8',
    sourceAi: '#e04888',
    confidenceNeutral: '#94a3b8',
    /** Production design spec §1.4 north-star + over-budget tokens. */
    northStarBgFrom: 'rgba(76, 108, 224, 0.08)',
    northStarBgTo: 'rgba(224, 72, 136, 0.04)',
    northStarBorder: 'rgba(76, 108, 224, 0.18)',
    overBudgetFg: '#e8a020',
    overBudgetSoft: 'rgba(232, 160, 32, 0.08)',
    /** Foreground tokens that previously lived only in CSS — wired
     *  here so RN consumers can stop hardcoding `#fff`. */
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
  },
  dark: {
    text: '#e4e4e8',                // ↔ web --foreground (dark)
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    background: '#0a0a0f',          // intentional divergence — OLED-friendly
    backgroundSecondary: '#111118',
    card: '#16161e',                // intentional — sits on OLED-black bg
    cardBorder: '#282830',          // ↔ web --border (dark)
    border: '#282830',              // ↔ web --border (dark)
    tint: Accent.primaryLight,
    icon: '#7a7a88',                // ↔ web --fg-muted (dark)
    tabIconDefault: '#4a4a5a',
    tabIconSelected: Accent.primaryLight,
    inputBg: '#202028',             // ↔ web --input-background (dark)
    overlay: '#000000aa',
    /** Source / provenance dots — dark. Lifted hues for OLED contrast. */
    sourceUsda: '#4cd080',
    sourceOff: '#6c8cff',
    sourceFatsecret: '#fb923c',
    sourceManual: '#64748b',
    sourceAi: '#ff7eb3',
    confidenceNeutral: '#64748b',
    /** North-star + over-budget — dark. Visual-qa V-1 to A/B saturation. */
    northStarBgFrom: 'rgba(108, 140, 255, 0.14)',
    northStarBgTo: 'rgba(255, 126, 179, 0.08)',
    northStarBorder: 'rgba(108, 140, 255, 0.32)',
    overBudgetFg: '#ffc04c',
    overBudgetSoft: 'rgba(255, 192, 76, 0.14)',
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

/** Semantic font weight scale — use these instead of raw weight strings */
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'System',
    mono: 'monospace',
  },
});

/**
 * Production design spec — 2026-04-27 §1.2 typography ladder.
 *
 * Five canonical steps + landing display + numeric specials. Apply
 * `fontVariant: ['tabular-nums']` per usage on numeric Text.
 *
 * Display is mobile-only on the onboarding success screen; never
 * in-product for routine reading.
 */
export const Type = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.6 },
  title:   { fontSize: 24, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  headline:{ fontSize: 17, lineHeight: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  body:    { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0 },
  bodyMuted:{ fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0 },
  label:   {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.88, // 11 * 0.08em
    textTransform: 'uppercase' as const,
  },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0 },
  /** Numeric specials — pair with `fontVariant: ['tabular-nums']` per usage. */
  ringValue:   { fontSize: 36, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.7 },
  ringValueLg: { fontSize: 56, lineHeight: 56, fontWeight: '700' as const, letterSpacing: -1.2 },
};

/**
 * Production design spec §1.3 — depth ladder (mobile mirror of web
 * --elev-* tokens).
 *
 * Use shape: `<View style={[Elevation.card, { backgroundColor: ... }]}>`.
 * Note: RN does not honour `shadowColor` on dark surfaces well — the
 * SupprCard primitive layers a 1px hairline highlight on dark mode to
 * compensate.
 */
export const Elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  /** FAB tint — primary-blue glow underneath. */
  floatPrimary: {
    shadowColor: Accent.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

/**
 * Production design spec §1.5 — icon sizing scale.
 *
 * Pair every numeric size with the matching role (see spec §1.5
 * Lucide → role mapping table). Do not introduce off-grid sizes.
 */
export const IconSize = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  hero: 24,
} as const;

/**
 * Production design spec §1.1 — Reanimated spring configs.
 *
 * Pass these directly to `withSpring(toValue, Spring.softSheet)` /
 * `withSpring(toValue, Spring.snapSegment)`. Prefer these over bespoke
 * configs so motion stays consistent across the app.
 */
export const Spring = {
  /** Sheet present + confirm-success (gentle overshoot). */
  softSheet: { damping: 18, stiffness: 220, mass: 0.9 },
  /** Tab switch + segmented control thumb (crisp settle). */
  snapSegment: { damping: 22, stiffness: 320 },
} as const;
