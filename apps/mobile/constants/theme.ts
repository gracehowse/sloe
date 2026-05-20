import { Platform } from 'react-native';

/**
 * Suppr brand accents (mobile). Aligned with the web design-overhaul palette.
 *
 * 2026-05-20 (Premium launch bar): `Accent.primary` is warm ink for UI
 * chrome (buttons, tabs, links) — not brand blue. Legacy brand blue lives
 * on `Accent.brandBlue` for protein macro, OFF provenance, and marketing
 * gradient endpoints only. See `docs/ux/brand-tokens.md`.
 */
/** Accent palette — aligned with web CSS custom properties in theme.css */
export const Accent = {
  /** UI chrome — buttons, tabs, links, Log FAB (light). */
  primary: '#1c1916',
  /**
   * Foreground on filled primary buttons. Light: white on ink; dark mode
   * uses inverted pair via `Colors.dark` (ink button on OLED).
   */
  primaryForeground: '#ffffff',
  /** Warm stone — secondary UI emphasis (onboarding icons, dinner slot). */
  primaryLight: '#5e574e',
  /** Legacy brand blue — protein macro, OFF dot, avatar gradient start. */
  brandBlue: '#4c6ce0',
  /** Lifted periwinkle — dark protein macro, sugar macro. */
  brandBlueLight: '#7a90f5',
  /** Leaf green — confirmations, calorie ring under-target. */
  success: '#62b35a',
  successLight: '#82d878',
  /** Golden amber (abstract art / breakfast slot); not yellow-neon. */
  warning: '#e0a838',
  warningLight: '#f0c058',
  destructive: '#e04848',
  destructiveLight: '#ff6c6c',
  cyan: '#06b6d4',
  orange: '#f97316',
  magenta: '#e04888',
  /** Info / carbs-style accent (aligned with web macro-carbs tone where needed) */
  info: '#0ea5e9',
  /** Muted yellow-orange carbs — distinct from warning amber (#e0a838). */
  carbs: '#d4a02f',
  carbsLight: '#e2b84c',
  /** Dusty blue-teal fibre — distinct hue from success/calories sage. */
  fiber: '#4a7878',
  fiberLight: '#5c8f8b',
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
  calories: Accent.success,       // web: --macro-calories (#62b35a)
  protein: Accent.brandBlue,      // web: --macro-protein  (#4c6ce0)
  // 2026-05-12 (premium-bar audit DC10): carbs split from
  // `Accent.warning` (amber) → `Accent.carbs` (warm orange). Amber is
  // now reserved for over-budget warnings only. See `Accent.carbs`
  // comment in theme.ts for the hue rationale.
  carbs: Accent.carbs,            // web: --macro-carbs    (#ed6b2a)
  fat: Accent.magenta,            // web: --macro-fat      (#e04888)
  fiber: Accent.fiber,
  sugar: Accent.brandBlueLight,
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
  dinner: Accent.primaryLight,    // web: --slot-dinner    (warm stone)
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
  primary: Accent.brandBlue,
  accent: Accent.magenta,
  gradient: [Accent.brandBlue, Accent.magenta] as const,
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
    text: '#1c1916',                // ↔ web --foreground (warm ink)
    textSecondary: '#5e574e',
    textTertiary: '#8c8378',
    background: '#f6f3ee',          // ↔ web --background (warm cream)
    backgroundSecondary: '#f0ebe3',
    card: '#ffffff',                // ↔ web --card (pure white boxes)
    cardBorder: '#ddd5c8',          // ↔ web --border (warm stone)
    border: '#ddd5c8',
    tint: Accent.primary,
    icon: '#5e574e',                // ↔ web --muted-foreground
    tabIconDefault: '#a39a8f',
    tabIconSelected: Accent.primary,
    inputBg: '#ebe5dc',             // ↔ web --input-background
    overlay: '#00000088',
    /** Production design spec §1.6 source / provenance dots. Mirrors web
     *  --source-* tokens. */
    sourceUsda: '#62b35a',
    sourceOff: '#4c6ce0',
    sourceFatsecret: '#f97316',
    sourceManual: '#8c8378',
    sourceAi: '#e04888',
    confidenceNeutral: '#8c8378',
    /** Production design spec §1.4 north-star + over-budget tokens. */
    northStarBgFrom: 'rgba(98, 179, 90, 0.10)',
    northStarBgTo: 'rgba(28, 25, 22, 0.04)',
    northStarBorder: 'rgba(98, 179, 90, 0.20)',
    overBudgetFg: '#e0a838',
    overBudgetSoft: 'rgba(224, 168, 56, 0.08)',
    /** Foreground tokens that previously lived only in CSS — wired
     *  here so RN consumers can stop hardcoding `#fff`. */
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    /** Logo plate — black rings on cream (not brand blue). */
    brandMarkRing: '#1c1916',
  },
  dark: {
    text: '#e8e7ed',                // ↔ web --foreground (dark)
    textSecondary: '#a8a4b4',
    textTertiary: '#706c7c',
    background: '#0a0a0f',          // intentional divergence — OLED-friendly
    backgroundSecondary: '#111118',
    card: '#16161e',                // intentional — sits on OLED-black bg
    cardBorder: '#32313c',          // ↔ web --border (dark)
    border: '#32313c',
    tint: '#e8e7ed',
    icon: '#9490a0',                // ↔ web --muted-foreground (dark)
    tabIconDefault: '#5c5868',
    tabIconSelected: '#e8e7ed',
    inputBg: '#222028',             // ↔ web --input-background (dark)
    overlay: '#000000aa',
    /** Source / provenance dots — dark. Lifted hues for OLED contrast. */
    sourceUsda: '#82d878',
    sourceOff: '#7a90f5',
    sourceFatsecret: '#fb923c',
    sourceManual: '#706c7c',
    sourceAi: '#ff7eb3',
    confidenceNeutral: '#706c7c',
    /** North-star + over-budget — dark. Visual-qa V-1 to A/B saturation. */
    northStarBgFrom: 'rgba(130, 216, 120, 0.14)',
    northStarBgTo: 'rgba(232, 231, 237, 0.05)',
    northStarBorder: 'rgba(130, 216, 120, 0.28)',
    overBudgetFg: '#f0c058',
    overBudgetSoft: 'rgba(240, 192, 88, 0.14)',
    destructiveForeground: '#ffffff',
    primaryForeground: '#101014',
    brandMarkRing: '#ffffff',
  },
};

/** 4px grid — 2026-05-19 premium rhythm bump (Noom/Lifesum airy feel).
 *  xs/sm unchanged for tight in-row gaps; md+ lifted ~4–8px. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
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
    shadowColor: '#1c1916',
    shadowOpacity: 0.06,
    shadowRadius: 6,
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
  /** FAB — neutral warm shadow (no brand-blue glow). */
  floatPrimary: {
    shadowColor: '#1c1916',
    shadowOpacity: 0.45,
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
