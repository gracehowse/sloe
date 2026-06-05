import { Platform } from 'react-native';

/**
 * Suppr brand accents (mobile). Aligned with the web Sloe palette.
 * Primary: `Accent.primary` (#C8794E clay) — Sloe Phase 0 (2026-06-03).
 * Body text stays warm ink via `Colors.*.text`. See `docs/ux/brand-tokens.md`.
 */
/** Accent palette — SLOE Phase 0 (2026-06-03). Values-only re-skin: every
 *  export NAME is unchanged so no caller breaks; only the hexes move from the
 *  blue 8-slot lock to the warm Sloe family validated across the 44 approved
 *  Figma frames. The harmonious 6-hue palette (plum / clay / sage / amber /
 *  damson / teal) is intentional — distinguishability is by icon + label +
 *  position (dossier D-4), not 8 saturated hues. Legacy slot names with no
 *  Sloe equivalent (magenta / cyan / lime / orange) are remapped onto the
 *  nearest Sloe hue so callers keep compiling. Mirrors web `--accent-*` /
 *  `--macro-*` / `--slot-*` in `src/styles/theme.css`. Spec:
 *  `docs/ux/redesign/phase-0-token-foundation-dossier.md`.
 *
 *  CONTRAST: base hues used as TEXT/ICON on light surfaces that fail AA
 *  (clay 3.33:1, amber 2.96:1, sage 4.40:1 on oat) are kept as the FILL value
 *  and a darkened `*Solid` variant carries text/icon usage (mirrors web
 *  `--accent-*-solid`). */
export const Accent = {
  /** UI chrome — buttons, tabs, links, Log FAB. Clay slot. */
  primary: '#C8794E',
  /** Foreground on filled primary buttons (white on clay = 3.37:1, OK for
   *  bold button labels). */
  primaryForeground: '#ffffff',
  /** Lifted clay — dark-mode primary, selected tabs. */
  primaryLight: '#D58A5E',
  /** Deep clay — text/icon/link on light (5.48:1 on white — AA PASS).
   *  Mirrors web `--accent-primary-solid`. Use INSTEAD of `primary` when the
   *  clay is small text or an icon on a light surface. */
  primarySolid: '#A0552E',
  /** Lifted clay for text on dark (7.18:1 on dark card — AA PASS). */
  primarySolidDark: '#E0A074',
  /** Soft fill for selected pills / segmented active. Use INSTEAD of solid
   *  `primary` on selected segmented controls, filter chips, fasting
   *  presets, billing toggle. Solid stays reserved for the ONE
   *  primary action per screen. */
  primarySoft: 'rgba(200, 121, 78, 0.10)',
  primarySoftDark: 'rgba(213, 138, 94, 0.16)',
  /** Legacy alias — now clay. Macro identity (protein) uses
   *  MacroColors.protein (olive-sage), a different hue. */
  brandBlue: '#C8794E',
  brandBlueLight: '#D58A5E',
  /** Sage slot — success, calorie-ring at/under-target signals.
   *  `successSolid` (#466046, 6.95:1 on white) carries text usage. */
  success: '#5E7C5A',
  successLight: '#83A57E',
  successSolid: '#466046',
  /** Amber slot — warning, sodium, approaching limits. (over-budget moved to
   *  red per dossier D-2; bonus/burn own honey via `Accent.activity`.)
   *  `warningSolid` (#956619, 5.01:1 on white) carries text usage. */
  warning: '#C9892C',
  warningLight: '#D6A24A',
  warningSolid: '#956619',
  /** Brick slot — destructive, error, over-budget. `destructiveSolid`
   *  (#9E3F2E, 6.55:1 on white) carries text usage. */
  destructive: '#C0533F',
  destructiveLight: '#DC6B55',
  destructiveSolid: '#9E3F2E',
  /** Legacy `cyan` alias — remapped onto Sloe teal (cyan has no Sloe slot). */
  cyan: '#4A7878',
  /** Legacy `orange` alias — remapped onto Sloe amber. */
  orange: '#C9892C',
  /** Legacy `magenta` alias — remapped onto Sloe amber (Fat macro is amber;
   *  AI source is damson). No standalone magenta in Sloe. */
  magenta: '#C9892C',
  /** Info — Sloe damson (info/win family). Mirrors web `--accent-info`. */
  info: '#6A4B7A',
  /** Carbs (+ sugar) — Sloe clay. Distinct from sodium's honey + the amber
   *  warning/fat hue. */
  carbs: '#C8794E',
  carbsLight: '#D58A5E',
  /** Activity / burn / earned-bonus — Sloe honey. Ring bonus arc, activity
   *  cards, burn-detail bonus. Distinct from warning (amber) + over (red). */
  activity: '#D6A24A',
  activityLight: '#E0B25E',
  /** Fiber — Sloe teal. */
  fiber: '#4A7878',
  fiberLight: '#6FA3A3',
  /** Damson slot — streaks, milestones, Pro accent, dinner slot, caffeine,
   *  win. `purpleLight` is the OLED-lifted damson (mirrors web dark
   *  `--accent-win` / damson-accent family). */
  purple: '#6A4B7A',
  purpleLight: '#9A7BAA',
  /** Legacy `lime` alias — remapped onto Sloe olive-sage (protein hue); no
   *  lime slot in Sloe. */
  lime: '#7C8466',
  /**
   * Win / achievement — SLOE BRAND GRADIENT — Phase 0 (2026-06-03, dossier
   * D-3), superseding the blue→purple→magenta brand spectrum and the interim
   * amber `#F2A93B` / gold that briefly shipped. A landmark-only role,
   * intentionally OUTSIDE the 6-hue action palette above. Gated behind
   * `design_system_colours` / `redesign_winmoment` — never in the flag-off
   * path.
   *
   * `Accent.win` below is a single calm DAMSON for PERSISTENT achievement bits
   * (streak chip, milestone badge); `AccentWinGradient` is the celebration
   * MOMENT fill (the warm Sloe plum → clay → amber gradient — most ownable,
   * ties to the brandmark, collision-free with the macro/warning hues).
   *
   * Three-role colour split (do not blur these — each owns one job):
   *   - PRIMARY (`Accent.primary`, clay) = the commit CTA / one primary
   *     action per screen. The "do it" colour.
   *   - SUCCESS (`Accent.success`, sage) = calorie-ring at/under-target +
   *     macro identity (state + data colour). The "you're on track" colour.
   *   - WIN (`Accent.win` / `AccentWinGradient`) = landmark celebration ONLY —
   *     hitting a goal, a streak milestone, a win-moment landmark. NOT a CTA,
   *     NOT a state, NOT a macro. Reaching for it anywhere routine dilutes it.
   *
   * Mirrors web `--accent-win` / `--accent-win-gradient` in
   * `src/styles/theme.css` (light + dark) — kept in lockstep.
   */
  win: '#6A4B7A',
  /** Win at ~12% alpha — soft fill behind a win-moment landmark / badge. */
  winSoft: 'rgba(106, 75, 122, 0.12)',
};

/**
 * Win / achievement SLOE BRAND gradient stops — Phase 0 (dossier D-3). The
 * celebration FILL (ring sweep / glow / pulse). Use with `react-native-svg`
 * `<LinearGradient>` (3 stops at 0% / 50% / 100%) or any consumer that takes an
 * ordered stop list. Mirrors web `--accent-win-gradient`
 * (`linear-gradient(120deg, #3B2A4D 0%, #C8794E 50%, #C9892C 100%)`).
 */
export const AccentWinGradient = {
  /** Sloe brand gradient — plum → clay → amber, in paint order. */
  stops: ['#3B2A4D', '#C8794E', '#C9892C'] as const,
  /** Matching stop offsets (`0..1`) for SVG `<Stop offset>`. */
  offsets: [0, 0.5, 1] as const,
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
  /** Damson slot — violet semantic preserved (Sloe). */
  caffeine: '#6A4B7A',
  /** Amber slot — "approaching weekly limit" warning family (Sloe). */
  alcohol: '#C9892C',
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
/** Macro-specific colors — SLOE Phase 0 (2026-06-03). Each macro maps to a
 *  Sloe hue: calories → plum (the calorie ring), protein → olive-sage,
 *  carbs → clay, fat → amber, fiber → teal. Sugar follows carbs; sodium →
 *  honey; water → teal. Icon (Beef / Wheat / Droplet / Leaf) + uppercase label
 *  + position remain the primary identity channel; colour is secondary. Mirrors
 *  web `--macro-*` in `src/styles/theme.css`. */
export const MacroColors = {
  calories: '#3B2A4D',         // Plum — the calorie ring (Sloe chrome hue)
  protein:  '#7C8466',         // Olive-sage
  carbs:    Accent.carbs,      // Clay (#C8794E)
  fat:      '#C9892C',         // Amber
  fiber:    '#4A7878',         // Teal
  sugar:    Accent.carbs,      // Sugar follows carbs (clay)
  sodium:   '#C9892C',         // Amber (mirrors web --macro-sodium)
  water:    '#4A7878',         // Teal
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
/** Meal-slot tints — SLOE Phase 0 (2026-06-03, dossier D-4).
 *  Breakfast → amber, Lunch → sage, Dinner → damson, Snack → teal.
 *  Distinguishable by hue + icon + position. Mirrors web `--slot-*` in
 *  `src/styles/theme.css`. */
export const SlotColors = {
  breakfast: '#C9892C',           // Amber
  lunch:     '#5E7C5A',           // Sage
  dinner:    '#6A4B7A',           // Damson
  snack:     '#4A7878',           // Teal
};

/**
 * Brand tokens — MARKETING gradient (paywall hero, gradient avatars, landing
 * CTAs ONLY; never inside product UI per `docs/ux/brand-guidelines.md` §9).
 *
 * INTENTIONALLY decoupled from `Accent.primary` in Sloe Phase 0 (2026-06-03):
 * the blue→magenta marketing brand gradient is OUT of the Phase 0 semantic
 * re-skin scope (the dossier remaps the product semantic tokens + the win /
 * north-star gradients, not the marketing hero gradient). Pinned to the
 * literal old endpoints so the marketing gradient is preserved exactly while
 * `Accent.primary` moves to clay. Whether the marketing gradient should also
 * move to Sloe (e.g. plum → clay) is a brand-manager call — flagged for a
 * later slot. Web mirror: `src/lib/theme/brandGradient.ts` +
 * `src/lib/paywall/basePaywallContent.ts` (both still on the old endpoints).
 */
export const Brand = {
  primary: '#588CE4',
  accent: '#DF5EBC',
  gradient: ['#588CE4', '#DF5EBC'] as const,
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
  // ── SLOE Phase 0 (2026-06-03). Mirrors web `theme.css` :root / .dark.
  //    Values-only re-skin: the warm-white page + pure-white cards grammar is
  //    kept; the hue moves to the Sloe family. Warmth lives in the aubergine
  //    INK + the oat page + the hairlines, not in the fills.
  light: {
    text: '#221B26',                // aubergine ink (the warmth lives here)
    textSecondary: '#6A6072',
    textTertiary: '#9B93A3',
    background: '#FFFFFF',          // white page (matches all Figma designs; oat removed 2026-06-03)
    backgroundSecondary: '#F6F5F2',
    card: '#F6F5F2',                // Sloe surface-card — Figma `654:2` / stitch `surface.card`. Warm off-white slab on `#FFFFFF` (tonal separation only on flat Today; soft lift on other tabs).
    cardElevated: '#F6F5F2',        // same fill in light; dark uses a stepped lift; soft shadow carries elevation on non-flat cards
    cardBorder: '#E8E2EC',          // hairline (Sloe line)
    border: '#E8E2EC',
    borderStrong: '#C9C2D6',
    tint: Accent.primary,
    /** Nav / brand primary — Sloe plum. The FAB, wordmark, and page titles
     *  use this (locked Grace 2026-06-04: plum = brand/nav primary, clay =
     *  inline content CTAs). Distinct from `tint` (clay) so the centre Log
     *  FAB reads as nav chrome, not a content action. Matches the Figma TD
     *  frames + `_gen.mjs` tabBar (`bg-plum` FAB). Mirrors web --nav-primary. */
    navPrimary: '#3B2A4D',
    icon: '#6A6072',
    tabIconDefault: '#9B93A3',
    tabIconSelected: Accent.primary,
    inputBg: '#F6F5F2',
    overlay: '#00000088',
    /** Source / provenance dots — Sloe palette. Mirrors web --source-*. */
    sourceUsda: '#5E7C5A',          // sage
    sourceOff: '#4A7878',           // teal
    sourceFatsecret: '#C9892C',     // amber
    sourceManual: '#9B93A3',        // warm grey
    sourceAi: '#6A4B7A',            // damson
    confidenceNeutral: '#6A6072',
    /** North-star + over-budget — Sloe palette. plum → clay gradient. */
    northStarBgFrom: 'rgba(59, 42, 77, 0.08)',
    northStarBgTo: 'rgba(200, 121, 78, 0.05)',
    northStarBorder: 'rgba(59, 42, 77, 0.18)',
    overBudgetFg: '#C0533F',        // Sloe destructive red (dossier D-2)
    overBudgetSoft: 'rgba(192, 83, 63, 0.08)',
    /** Foreground tokens that previously lived only in CSS — wired
     *  here so RN consumers can stop hardcoding `#fff`. */
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    /** Logo plate — Sloe plum rings on oat (mirrors web --brand-mark-ring). */
    brandMarkRing: '#3B2A4D',
    /** Calorie ring empty track — Sloe frost-mist (readable on white hero). */
    ringTrack: '#EDEAF1',
  },
  dark: {
    // SLOE Phase 0 dark — warm aubergine graphite, not cool-slate.
    text: '#F5F3F4',                // ↔ web --foreground (ivory ink)
    textSecondary: '#B7B2BA',
    textTertiary: '#857F8B',
    background: '#19181C',          // ↔ web --background
    backgroundSecondary: '#232126', // ↔ web --background-secondary
    card: '#232126',                // ↔ web --card
    cardElevated: '#2A2730',        // ↔ web --card-elevated (premium tier)
    cardBorder: '#35323A',          // ↔ web --border
    border: '#35323A',
    borderStrong: '#47424F',        // ↔ web --border-strong
    tint: Accent.primaryLight,
    /** Nav / brand primary — Sloe lifted plum on dark (matches `_gen.mjs`
     *  HEAD_DARK `plum:'#815E91'`). See light-mode note above. */
    navPrimary: '#815E91',
    icon: '#B7B2BA',                // ↔ web --foreground-secondary (dark)
    tabIconDefault: '#857F8B',
    tabIconSelected: Accent.primaryLight,
    inputBg: '#232126',             // ↔ web --input-background (dark)
    overlay: '#000000aa',
    /** Source / provenance dots — Sloe dark (lifted). */
    sourceUsda: '#83A57E',
    sourceOff: '#6FA3A3',
    sourceFatsecret: '#D6A24A',
    sourceManual: '#857F8B',
    sourceAi: '#9A7BAA',
    confidenceNeutral: '#857F8B',
    /** North-star + over-budget — Sloe dark. */
    northStarBgFrom: 'rgba(129, 94, 145, 0.16)',
    northStarBgTo: 'rgba(213, 138, 94, 0.06)',
    northStarBorder: 'rgba(129, 94, 145, 0.28)',
    overBudgetFg: '#DC6B55',
    overBudgetSoft: 'rgba(220, 107, 85, 0.14)',
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    brandMarkRing: '#ffffff',
    ringTrack: '#372F44',
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

/** SLOE Phase 0 (2026-06-03) — font family names loaded via
 *  `@expo-google-fonts/newsreader` + `@expo-google-fonts/inter` in
 *  `apps/mobile/app/_layout.tsx`. The string names below are the exact
 *  family identifiers those packages register with `expo-font`. `Type.*`
 *  picks the matching weight family; `Fonts` keeps `System` as a graceful
 *  fallback for any consumer that hasn't migrated. Headlines/display/ring
 *  numerals use Newsreader (serif); body/label/caption use Inter. */
export const FontFamily = {
  /** Newsreader (serif) — headlines, display, ring/macro numerals. */
  serifRegular: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  serifSemibold: 'Newsreader_600SemiBold',
  /** Newsreader italic — quiet editorial coach lines (the calm,
   *  forward-looking nudge under the ring; matches the Figma 01 frame's
   *  italic "Room for dinner…" line). Real italic face, not synthesized. */
  serifItalic: 'Newsreader_400Regular_Italic',
  /** Inter (sans) — body, labels, captions. */
  sansRegular: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'Inter_400Regular',
    serif: 'Newsreader_400Regular',
    mono: 'Menlo',
  },
  default: {
    sans: 'Inter_400Regular',
    serif: 'Newsreader_400Regular',
    mono: 'monospace',
  },
});

/**
 * Production design spec — 2026-04-27 §1.2 typography ladder.
 * SLOE Phase 0 (2026-06-03): `fontFamily` wired per role — display / title /
 * headline + the big ring numerals read in Newsreader (serif), body /
 * bodyMuted / label / caption / macroValue in Inter, per the dossier. Sizes /
 * line-heights / weights / letter-spacing are UNCHANGED (the existing ladder
 * is pinned by `designTokensPhase1.test.ts`); only the family is added. The
 * loaded Newsreader weights are 400/500/600 — serif roles point at the
 * SemiBold (600) file, and the few roles that keep a 700/800 `fontWeight`
 * (title/display) synthesize the extra weight on iOS (acceptable for Phase 0;
 * Grace visually validates). Apply `fontVariant: ['tabular-nums']` per usage
 * on numeric Text (preserved on ringValue / macroValue at call sites).
 *
 * Display is mobile-only on the onboarding success screen; never
 * in-product for routine reading.
 */
export const Type = {
  display: { fontFamily: FontFamily.serifRegular, fontSize: 32, lineHeight: 36, fontWeight: '400' as const, letterSpacing: -0.4 },
  title:   { fontFamily: FontFamily.serifRegular, fontSize: 24, lineHeight: 28, fontWeight: '400' as const, letterSpacing: -0.3 },
  headline:{ fontFamily: FontFamily.serifMedium, fontSize: 17, lineHeight: 22, fontWeight: '500' as const, letterSpacing: -0.1 },
  body:    { fontFamily: FontFamily.sansMedium, fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0 },
  bodyMuted:{ fontFamily: FontFamily.sansRegular, fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0 },
  label:   {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.88, // 11 * 0.08em
    textTransform: 'uppercase' as const,
  },
  caption: { fontFamily: FontFamily.sansMedium, fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0 },
  /** Quiet editorial coach line — Newsreader italic, muted, centred. The
   *  calm forward-looking nudge under the ring (de-carded deficit insight,
   *  2026-06-03). Matches the Stitch `today.html` coach line
   *  (`font-headline italic text-[17px] text-plum/90`) — bumped 14→17 on
   *  2026-06-04 (Grace measured-spec pass) so the "Room for dinner…" line
   *  reads as the editorial plum nudge it is in the mock, not a grey caption.
   *  Sole consumer: `TodayDeficitInsight.tsx` (colour set there to plum). */
  coach:   { fontFamily: FontFamily.serifItalic, fontSize: 17, lineHeight: 23, letterSpacing: 0 },
  /** Macro tile + calorie ring centre value — keep in sync. Inter (numerals
   *  stay in the sans for tight tabular alignment on small tiles). */
  macroValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.35,
  },
  /** Numeric specials — the big hero numbers read in Newsreader (serif) to
   *  match the approved Figma frames. Pair with `fontVariant: ['tabular-nums']`
   *  per usage (already set at call sites).
   *
   *  `ringValue` is THE Today calorie-ring centre numeral. Bumped 36→48 on
   *  2026-06-04 (Grace measured-spec pass) to match the Stitch `today.html`
   *  centre value (`font-headline text-5xl` ≈ 48px). The numeral is a single
   *  unconstrained Text that overlays the SVG, so it never wraps; at 48px it
   *  reads as the hero number the mock intends (slight overlap of the side
   *  macro arcs is the mock's own look). 44px is the documented fallback if a
   *  capture shows crowding on the narrowest device (ring SIZE = min(W·0.53,
   *  230) → ~208 on iPhone 17). The two collateral consumers that do NOT want
   *  the hero size — `TodayActivityBonusCard` net headline + `WinMomentPlayer`
   *  pct — pin their own fontSize at the call site (see those files), so this
   *  bump lands only on the ring. `ringValueLg` (56) is untouched. */
  ringValue:   { fontFamily: FontFamily.serifRegular, fontSize: 48, lineHeight: 48, fontWeight: '400' as const, letterSpacing: -0.5 },
  ringValueLg: { fontFamily: FontFamily.serifRegular, fontSize: 56, lineHeight: 56, fontWeight: '400' as const, letterSpacing: -0.9 },
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
  // design-director review + approved prototypes. As of 2026-06-04 this is the
  // DEFAULT light resting-card treatment (useCardElevation no longer gates it
  // behind the flag — Grace: "sim cards are blending into the background, figma
  // does not do this"). The soft lift is what separates the `#F6F5F2` card from
  // the `#FFFFFF` page in the Sloe Figma — a gentle ambient shadow, NOT a
  // heavier border (Grace rejected the 1pt border as too heavy). See SupprCard
  // + the Today cards, which render it on an OUTER wrapper because RN
  // `overflow: hidden` clips iOS shadows.
  //
  // Tuned to mirror web `--elev-card-soft` EXACTLY (src/styles/theme.css:
  // `0 6px 18px rgba(34, 27, 38, 0.16)`): the aubergine Sloe ink (#221B26 ==
  // rgba(34,27,38)) at 0.16 opacity, 18 radius, y+6 — a calm, premium plum-
  // tinted lift, not a cheap/harsh Material drop shadow. Keeps web == mobile.
  //
  // 2026-06-04 (Grace, "push it to 10%"): opacity bumped 0.07 → 0.10, radius
  // 12 → 14, y stayed +4.
  // 2026-06-04 (Grace, "cards still blend on-device — sim looks so different to
  // Figma"): edge-pixel sampling of the sim PROVED the shadow was rendering
  // (penumbra just below a card dipped #F6F5F2→#EEEEEE, ~17 lum under the white
  // page) but far too weak to lift the card — the trap is that the #F6F5F2 fill
  // sits only ~10 lum below the #FFFFFF page, so the shadow has to do ALL the
  // separation, and a 10% / 14px halo was lighter than the card itself at its
  // outer reach. Strengthened the lift to 0.16 / 18px / y+6: a confident,
  // still-soft plum penumbra (NOT a hard Material drop shadow — radius stays
  // wide and the colour stays the Sloe ink, so it reads as ambient lift). The
  // wider radius keeps the penumbra gradient long (premium), the higher opacity
  // makes the slab unmistakably raised on-device. Re-verified by re-sampling
  // the edge pixels after the bump (see cardElevationSoftLiftDefault.test.tsx +
  // the agent capture). Both levers move in lockstep with web. The flat `card`
  // above stays as the explicit flat fallback for any direct consumer.
  cardSoft: {
    shadowColor: '#221B26',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
