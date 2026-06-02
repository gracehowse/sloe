import { Platform } from 'react-native';

/**
 * Suppr brand accents (mobile). Aligned with the web design-overhaul palette.
 * Primary: `Accent.primary` (#588CE4 blue) — 8-slot lock 2026-05-22 canonical.
 * Body text stays warm ink via `Colors.*.text`. See `docs/ux/brand-tokens.md`.
 */
/** Accent palette — 8-slot lock (2026-05-22 evening). Every accent hue
 *  in the app maps to one of: Red #F16264 / Magenta #DF5EBC /
 *  Purple #9679D9 / Blue #588CE4 / Green #56A775 / Lime #81BE38 /
 *  Yellow #F3C336 / Orange #F78A32. Anchored on the Apple Photos wheel
 *  tonal family. `cyan` retained as alias of Blue so legacy callers
 *  keep compiling but resolve to the consolidated hue. Mirrors web
 *  `--accent-*` / `--macro-*` / `--slot-*` in `src/styles/theme.css`. */
export const Accent = {
  /** UI chrome — buttons, tabs, links, Log FAB. Blue slot. */
  primary: '#588CE4',
  /** Foreground on filled primary buttons (white on blue). */
  primaryForeground: '#ffffff',
  /** Lifted Blue — dark-mode primary, selected tabs. */
  primaryLight: '#7BA3EA',
  /** Soft fill for selected pills / segmented active. Use INSTEAD of solid
   *  `primary` on selected segmented controls, filter chips, fasting
   *  presets, billing toggle. Solid stays reserved for the ONE
   *  primary action per screen. */
  primarySoft: 'rgba(88, 140, 228, 0.10)',
  primarySoftDark: 'rgba(123, 163, 234, 0.16)',
  /** Legacy alias — now collapsed onto Blue. Macro identity (protein)
   *  uses MacroColors.protein which is the same hex. */
  brandBlue: '#588CE4',
  brandBlueLight: '#7BA3EA',
  /** Green slot — success, calorie ring under-target. */
  success: '#56A775',
  successLight: '#7ABE93',
  /** Orange slot — warning, over-budget, sodium, approaching limits.
   *  (bonus/burn/activity now own the Yellow slot via `Accent.activity`) */
  warning: '#F78A32',
  warningLight: '#FAA45F',
  /** Red slot — destructive, error, over-budget (traffic-light mode). */
  destructive: '#F16264',
  destructiveLight: '#F58385',
  /** Legacy `cyan` alias — folded into Blue (cyan dropped from 8 slots). */
  cyan: '#588CE4',
  /** Orange slot — single orange, not two close shades. */
  orange: '#F78A32',
  /** Magenta slot — Fat macro, AI source. */
  magenta: '#DF5EBC',
  /** Info — folded to Blue (info family). */
  info: '#588CE4',
  /** Carbs (+ sugar) — deep amber-orange. Distinct from sodium's orange
   *  and from the Yellow activity slot. */
  carbs: '#E8721E',
  carbsLight: '#F2904A',
  /** Activity / burn / earned-bonus — Yellow slot (vacated by carbs).
   *  Ring bonus arc, activity cards, burn-detail bonus. */
  activity: '#F3C336',
  activityLight: '#F5D162',
  /** Fiber — Green slot (folded with success). */
  fiber: '#56A775',
  fiberLight: '#7ABE93',
  /** Purple slot — streaks, milestones, Pro accent, snack slot, caffeine. */
  purple: '#9679D9',
  purpleLight: '#AC93E2',
  /** Lime slot — reserved for fresh / produce / match-your-day pill. */
  lime: '#81BE38',
  /**
   * Win / achievement GOLD — Design Direction 2026 (`docs/decisions/
   * 2026-06-01-design-direction-2026.md`; supersedes the interim amber
   * `#F2A93B` from the 2026-05-31 design-director review). A NEW
   * landmark-only role, intentionally OUTSIDE the 8-slot action palette
   * above. Gated behind the `design_system_colours` / `redesign_winmoment`
   * flag at the call site — never applied in the flag-off path.
   *
   * Why gold (not amber): gold carries universal *achievement* semantics and
   * separates celebration from the warm-orange family already owned by carbs
   * (`#E8721E`), sodium, and over-budget warnings. The solid deep gold below
   * is the legible text/number value on the warm-paper light + dark surfaces;
   * the gradient is the ring / glow / celebration fill (a flat gold reads
   * mustard, so fills always use the gradient).
   *
   * Three-role colour split (do not blur these — each owns one job):
   *   - PRIMARY (`Accent.primary`, Blue) = the commit CTA / one primary
   *     action per screen. The "do it" colour.
   *   - SUCCESS (`Accent.success`, Green) = calorie-ring under-target +
   *     macro identity (state + data colour). The "you're on track" colour.
   *   - WIN (`Accent.win`, this gold) = landmark celebration ONLY —
   *     hitting a goal, a streak milestone, a win-moment landmark. The
   *     "you did something special" colour. NOT a CTA, NOT a state, NOT a
   *     macro. Reaching for it anywhere routine dilutes the landmark.
   *
   * Mirrors web `--accent-win` / `--accent-win-gradient` in
   * `src/styles/theme.css` (light + dark) — kept in lockstep.
   */
  win: '#C99A22',
  /** Win at ~12% alpha — soft fill behind a win-moment landmark / badge. */
  winSoft: 'rgba(201, 154, 34, 0.12)',
};

/**
 * Win / achievement GOLD gradient stops — Design Direction 2026. The
 * celebration FILL (ring sweep / glow / pulse), never the flat solid: a flat
 * gold reads mustard. Use with `react-native-svg` `<LinearGradient>` (3 stops
 * at 0% / 45% / 100%) or any consumer that takes an ordered stop list.
 * Mirrors web `--accent-win-gradient`
 * (`linear-gradient(150deg, #F8E08A 0%, #E7C25C 45%, #C99A22 100%)`).
 */
export const AccentWinGradient = {
  /** Light → mid → deep gold, in paint order. */
  stops: ['#F8E08A', '#E7C25C', '#C99A22'] as const,
  /** Matching stop offsets (`0..1`) for SVG `<Stop offset>`. */
  offsets: [0, 0.45, 1] as const,
} as const;

/**
 * Stimulant tracker colours (Batch 2.5 hydration & stimulants).
 * Caffeine is its own violet tone (not a macro role). Alcohol uses the
 * same amber hue as the warning accent — the semantic is "approaching
 * weekly limit", not error. Mirrors web `--stimulant-caffeine` /
 * `--stimulant-alcohol` in `src/styles/theme.css`. See
 * `docs/ux/brand-tokens.md` for the full role table.
 */
export const StimulantColors = {
  /** Purple slot — violet semantic preserved. */
  caffeine: '#9679D9',
  /** Orange slot — "approaching weekly limit" warning family. */
  alcohol: '#F78A32',
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

/** Macro-specific colors — Canonical 2026-05-22 v4 (TF49 saturated, restored).
 *
 *  v1 (pre-2026-05-22): saturated rainbow — cool indigo / amber /
 *    magenta / teal. Shipped on TestFlight 49 (git sha 34e079f8).
 *  v2 (2026-05-22 morning): monochrome periwinkle ladder. Removed
 *    rainbow but lost macro identity entirely; user couldn't tell
 *    protein from fat at a glance.
 *  v3 (2026-05-22 afternoon): warm cohesive pastels. Calmer but
 *    macro pop too quiet on small inner ring arcs.
 *  v4 (2026-05-22 evening — locked): restore TF49 saturated semantic
 *    palette. Grace call: "we need the pop of colour back". Required
 *    by the multi-ring revival — slim 6px inner arcs need saturation
 *    to remain distinguishable at small scale.
 *
 *  Differentiation by icon (Beef / Wheat / Droplet / Leaf) + uppercase
 *  label + position is still load-bearing; colour is the secondary
 *  identity channel that makes the inner ring arcs visually parseable.
 *
 *  Calories stays success-green (state colour, locked to the 3-state
 *  outer-ring rule — empty gradient / under green / over warning amber).
 *  Sodium / sugar / water keep their original hues (niche
 *  micronutrient/alert/hydration semantics).
 */
/** Macro-specific colors — palette (2026-05-25 carbs/activity de-collide).
 *  Carbs + sugar move to amber-orange (#E8721E), distinct from sodium's
 *  orange (#F78A32) and from the Yellow slot (now owned by Accent.activity
 *  for burn/bonus). Water folds into Blue. Calories stays success-green. */
export const MacroColors = {
  calories: Accent.success,    // Green slot — state colour, locked
  protein:  '#588CE4',         // Blue slot
  carbs:    Accent.carbs,      // Amber-orange (#E8721E) — distinct from sodium
  fat:      '#DF5EBC',         // Magenta slot
  fiber:    '#56A775',         // Green slot (paired with calories — see icon for differentiation)
  sugar:    Accent.carbs,      // Sugar follows carbs (#E8721E)
  sodium:   '#F78A32',         // Orange slot — distinct tint from carbs
  water:    '#588CE4',         // Blue (folded from cyan)
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
/** Meal-slot tints — 8-slot palette (2026-05-22 evening lock).
 *  Breakfast → Yellow, Lunch → Green, Dinner → Blue, Snack → Purple
 *  (cyan dropped from the 8; purple is the remaining non-colliding
 *  slot). Mirrors web `--slot-*` in `src/styles/theme.css`. */
export const SlotColors = {
  breakfast: '#F3C336',           // Yellow slot
  lunch:     '#56A775',           // Green slot
  dinner:    '#588CE4',           // Blue slot
  snack:     '#9679D9',           // Purple slot
};

/**
 * Brand tokens. The `violet` and `pink` deprecated aliases were
 * deleted 2026-04-28 (Next-10 #15) — zero production code
 * referenced them. Use `Brand.primary` (`#588CE4` blue) and
 * `Brand.accent` (`#DF5EBC` magenta) directly. The gradient is
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
  // ── Canonical 2026-05-22 v2 (chroma pull). Mirrors web theme.css.
  //    v1 read as "khaki cottage" — secondary surfaces too chromatic.
  //    v2: page is warm white, cards pure white, secondary surfaces
  //    barely-warmer-than-card. Warmth lives in INK and HAIRLINES,
  //    not in fills. Chips/rows still use backgroundSecondary; inputs
  //    use inputBg (now also lower chroma).
  light: {
    text: '#1a1714',                // warm chocolate ink (unchanged — the warmth lives here)
    textSecondary: '#5b554b',
    textTertiary: '#8a8377',
    background: '#fbfaf6',          // warm white (was #faf7f1 — too chromatic)
    backgroundSecondary: '#f7f6f3', // neutral warm grey (was #f5f3ec — too beige)
    card: '#ffffff',                // pure white — primary content surface
    cardElevated: '#fafaf8',        // subtle lift — nearly white, no beige (was #fbf8f0)
    cardBorder: '#ebe7dc',          // hairline (was #e6dfd0 — less yellow)
    border: '#ebe7dc',
    borderStrong: '#ddd6c5',
    tint: Accent.primary,
    icon: '#5b554b',
    tabIconDefault: '#a39a8f',
    tabIconSelected: Accent.primary,
    inputBg: '#f5f4f1',             // input fields (was #f0ece4 — too beige)
    overlay: '#00000088',
    /** Source / provenance dots — 8-slot palette. Mirrors web --source-*. */
    sourceUsda: '#56A775',          // Green
    sourceOff: '#588CE4',           // Blue
    sourceFatsecret: '#F78A32',     // Orange
    sourceManual: '#8c8378',        // neutral grey
    sourceAi: '#DF5EBC',            // Magenta
    confidenceNeutral: '#8c8378',
    /** North-star + over-budget — 8-slot palette. Blue → Magenta gradient. */
    northStarBgFrom: 'rgba(88, 140, 228, 0.10)',
    northStarBgTo: 'rgba(223, 94, 188, 0.05)',
    northStarBorder: 'rgba(88, 140, 228, 0.22)',
    overBudgetFg: '#F78A32',        // Orange default; trafficLight mode swaps in Red via runtime
    overBudgetSoft: 'rgba(247, 138, 50, 0.08)',
    /** Foreground tokens that previously lived only in CSS — wired
     *  here so RN consumers can stop hardcoding `#fff`. */
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    /** Logo plate — black rings on cream (not brand blue). */
    brandMarkRing: '#1c1916',
    /** Calorie ring empty track — Blue tint (8-slot, readable on white hero). */
    ringTrack: '#D6E0F5',
  },
  dark: {
    // Canonical 2026-05-22 palette lock — warm-graphite, not cool-slate.
    text: '#ece8df',                // ↔ web --foreground (ivory ink)
    textSecondary: '#a39d92',
    textTertiary: '#6e695f',
    background: '#0f0e12',          // ↔ web --background
    backgroundSecondary: '#16151a', // ↔ web --background-secondary
    card: '#1a181f',                // ↔ web --card
    cardElevated: '#221f29',        // ↔ web --card-elevated (premium tier)
    cardBorder: '#2a2630',          // ↔ web --border
    border: '#2a2630',
    borderStrong: '#3a3640',        // ↔ web --border-strong
    tint: Accent.primaryLight,
    icon: '#a39d92',                // ↔ web --foreground-secondary (dark)
    tabIconDefault: '#5c5868',
    tabIconSelected: Accent.primaryLight,
    inputBg: '#1f1c25',             // ↔ web --input-background (dark)
    overlay: '#000000aa',
    /** Source / provenance dots — dark, 8-slot palette OLED-lifted. */
    sourceUsda: '#7ABE93',
    sourceOff: '#7BA3EA',
    sourceFatsecret: '#FAA45F',
    sourceManual: '#706c7c',
    sourceAi: '#E689CB',
    confidenceNeutral: '#706c7c',
    /** North-star + over-budget — dark, 8-slot palette. */
    northStarBgFrom: 'rgba(123, 163, 234, 0.16)',
    northStarBgTo: 'rgba(230, 137, 203, 0.05)',
    northStarBorder: 'rgba(123, 163, 234, 0.28)',
    overBudgetFg: '#FAA45F',
    overBudgetSoft: 'rgba(250, 164, 95, 0.14)',
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    brandMarkRing: '#ffffff',
    ringTrack: 'rgba(123, 163, 234, 0.35)',
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

// Canonical 2026-05-22 lock — tighter radii. Previous 16/12/8 ladder
// read as "kids' tablet" / "consumer wellness app". Linear / Stripe /
// Things 3 / Notion all sit at 4-8px. Tightening to 8/6/4/12 cascades
// through ~287 callers without further edits.
//
// Previous values: sm 8, md 12, lg 16, xl 20
export const Radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
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
  /** Macro tile + calorie ring centre value — keep in sync. */
  macroValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.35,
  },
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
  // Canonical 2026-05-22 lock — flat hierarchy.
  // Cards used to have a soft shadow + hairline border. Now: hairline
  // only. Notion / Linear / Things 3 grammar. Shadow lives on the FAB
  // only (it legitimately floats). Sheets keep their shadow because
  // they overlay other content. Card shadow neutralised here so any
  // component still spreading `...Elevation.card` becomes a no-op.
  card: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  // ENG-795 (Redesign — Design Direction 2026): the soft-elevation variant
  // that SUPERSEDES the 2026-05-22 flat lock above, per the 2026-05-31
  // design-director review + approved prototypes. Applied only when the
  // `design_system_elevation` flag is on (LIGHT mode) — see SupprCard, which
  // renders it on an outer wrapper because RN `overflow: hidden` clips iOS
  // shadows. Dark mode uses tonal lift (`cardElevated`), not this shadow.
  // ↔ web `--elev-card` (src/styles/theme.css). The flat `card` above stays
  // as the flag-OFF fallback.
  cardSoft: {
    shadowColor: '#1c1916',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  /** FAB — primary accent glow. Updated 2026-05-22 to follow the
   *  warmed periwinkle primary; routes through `Accent.primary` so
   *  any future primary shift cascades cleanly. */
  floatPrimary: {
    shadowColor: Accent.primary,
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
