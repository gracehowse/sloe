import { Platform } from 'react-native';

/** ENG-1521 — THE two sanctioned soft-tint steps per scheme (Linear ruling,
 *  2026-07-17): Soft = 12% light / 18% dark; SoftStrong = 20% light / 28%
 *  dark. Every soft tint in this file derives from a family hue at one of
 *  these four alphas via `withAlpha` below. Call sites consume the NAMED
 *  `*Soft` / `*SoftStrong` tokens ONLY — ad-hoc alpha-concat (`hue + "18"`)
 *  and call-site `withAlpha` are banned by the `check:token-scale`
 *  alpha-concat detector. */
const SOFT = 0.12;
const SOFT_DARK = 0.18;
const SOFT_STRONG = 0.2;
const SOFT_STRONG_DARK = 0.28;

/** `#RRGGBB` → `rgba(r, g, b, a)` at a sanctioned soft-tint alpha (ENG-1521).
 *  Token-file-internal derivation helper ONLY — never import, re-export, or
 *  re-implement it at a call site; consume the named `*Soft` tokens instead
 *  (`check:token-scale` enforces this outside token-definition files). */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Suppr brand accents (mobile). Aligned with the web Sloe palette.
 * Primary: `Accent.primary` (#5B3B6E aubergine-violet) — 2026-06-08.
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
  /** UI chrome — outlined CTAs, tabs, links, Log FAB. Deep plum #3B2A4D
   *  (2026-06-08 — see docs/decisions/2026-06-08-aubergine-accent-system.md).
   *  Darker = more premium (Grace), rationed hard; the lighter #5B3B6E is the
   *  gradient / active LIFT, not the base. */
  primary: '#3B2A4D',
  /** Foreground on filled primary buttons (white on plum #3B2A4D ≈ 12:1 — AA). */
  primaryForeground: '#ffffff',
  /** Plum Lift — gradient top, pressed/glow, active-tab tint, selected lift. */
  primaryLight: '#5B3B6E',
  /** Deep plum — text/icon/link/outline-border on light (≈12:1 on white — AA).
   *  Mirrors web `--accent-primary-solid`. Use INSTEAD of `primary` when the
   *  accent is small text, an icon, or a 1.5px outline border on a light surface. */
  primarySolid: '#3B2A4D',
  /** Lifted aubergine for text on dark (AA on dark card). */
  primarySolidDark: '#C4ACD0',
  /** Dark-scheme accent FILL — the OLED-contrast aubergine the dark theme
   *  inverts to (= AccentWinGradient stop 3). Named here (ENG-1013, 2026-06-10)
   *  so the dark accent family lives in this file with the light one instead of
   *  as a literal in `context/theme.tsx`'s DARK_ACCENT. Mirrors web `.dark`
   *  `--accent-primary`. (`primaryLight` dark = `purpleLight` #9A7BAA.) */
  primaryDark: '#7E5C92',
  /** Sloe Deep (#241733) — the deep-plum brand GROUND for full-bleed brand
   *  screens (onboarding welcome `.ob--brand`, paywall). White text + frost
   *  accents sit on it. Mirrors web `--primary-deep`. (ENG-1247) */
  primaryDeep: '#241733',
  /** Frost (#c9c2d6) — soft lavender-grey for muted dividers + the brand-screen
   *  italic tagline on the deep-plum ground. Mirrors web `--accent-frost`. */
  frost: '#c9c2d6',
  /** Frost Bright (#efe9f2) — the near-white plum-tinted PRIMARY text/heading
   *  on the deep-plum brand ground (`primaryDeep`). One step brighter + warmer
   *  than the muted `frost` divider/tagline value and than the dark-scheme body
   *  ink (`Colors.dark.text` #ECE8F0); the cook-mode V3 shell + recipe cook
   *  overlay paint their headline in it over the #241733 ground. Named here
   *  (ENG-1013, 2026-06-10) so the cook-shell foreground lives in this file
   *  instead of as a repeated literal in `app/cook.tsx` + `app/recipe/[id].tsx`.
   *  Value-equal to those literals — a token-routing move, render unchanged. */
  frostBright: '#efe9f2',
  /** Soft fill for selected pills / segmented active / nudge tint. Lifted-aubergine
   *  hue (12%) so the tint stays perceptible. Solid fill stays reserved for the FAB
   *  + conversion CTAs; everyday primaries are a deep-plum OUTLINE. */
  primarySoft: 'rgba(91, 59, 110, 0.12)',
  primarySoftDark: 'rgba(154, 123, 170, 0.18)',
  /** Stronger soft fill (~20%) for the ONE hero tinted-slab affordance that
   *  must out-weigh a settings row without becoming a solid slab — the
   *  Discover import-from-Reel card (ENG-1087). Flat-card law still holds: the
   *  tint IS the separation, just louder. Reserve for that hero; everyday
   *  selected pills/nudges stay on `primarySoft` (12%). */
  primarySoftStrong: 'rgba(91, 59, 110, 0.20)',
  primarySoftStrongDark: 'rgba(154, 123, 170, 0.28)',
  /** Legacy alias — now deep plum. Macro identity (protein) uses
   *  MacroColors.protein (olive-sage), a different hue. */
  brandBlue: '#3B2A4D',
  brandBlueLight: '#5B3B6E',
  /** Sage slot — success, calorie-ring at/under-target signals.
   *  `successSolid` (#466046, 6.95:1 on white) carries text usage.
   *  `successSolidDark` (#83A57E) is the OLED-lifted sage TEXT for the dark
   *  scheme: the light #466046 collapses to 2.43:1 on a dark card, so any
   *  success TEXT on a dark tint (the Badge "added" label, the Today streak
   *  headline) must read `successSolidDark` via `useAccent()` — 5.29:1 on the
   *  success 14% tint / 5.66:1 on the 8% StreakInsight card, AA PASS. Mirrors
   *  web `.dark` `--accent-success-solid: #83A57E`. (ENG-1275.) */
  success: '#5E7C5A',
  successLight: '#83A57E',
  successSolid: '#466046',
  successSolidDark: '#83A57E',
  /** Soft sage tint for success chips / "added" badges / on-track fills
   *  (ENG-1521 — snaps the old `Accent.success + "1F"`-style concats onto the
   *  sanctioned scale). Dark derives from the OLED-lifted sage, same lift the
   *  primary family uses. ↔ web `--accent-success-soft` (light + .dark). */
  successSoft: withAlpha('#5E7C5A', SOFT),
  successSoftDark: withAlpha('#83A57E', SOFT_DARK),
  /** Stronger sage slab for the rare hero success surface (ENG-1521 — the
   *  `"35"`/`"40"`-suffix concat sites snap here). No web `-soft-strong`
   *  counterpart yet: web has zero consuming sites (ENG-1521 census). */
  successSoftStrong: withAlpha('#5E7C5A', SOFT_STRONG),
  successSoftStrongDark: withAlpha('#83A57E', SOFT_STRONG_DARK),
  /** Amber slot — warning, sodium, approaching limits, AND over-budget
   *  (2026-07-01 re-ratification, sweep decision #2 / ENG-1296: the dossier
   *  D-2 "over = red" carve-out is RETIRED — over-budget signals product-wide
   *  are uniformly amber; bonus/burn own honey via `Accent.activity`.)
   *  `warning` (#C9892C, 2.96:1 text-fail) is FILLS ONLY (dots / bars / soft
   *  tints). `warningSolid` carries ALL amber TEXT + icons. Darkened
   *  #956619 → #925812 (2026-06-23, a11y parity with web `--accent-warning-solid`):
   *  the old solid was 5.01:1 white but only 4.47:1 on the cream the amber chips
   *  sit on; #925812 is 5.79 white / 5.17 cream — PASS as text (a touch more
   *  orange than `activitySolid` #8A5A14 so warning ≠ honey-bonus). */
  warning: '#C9892C',
  warningLight: '#D6A24A',
  warningSolid: '#925812',
  /** Soft amber tint for warning chips / approaching-limit fills (ENG-1521).
   *  Value-equal to `Colors.*.overBudgetSoft` (the over-budget family IS the
   *  warning family — ENG-1296); dark derives from the lifted honey.
   *  ↔ web `--accent-warning-soft` (light + .dark). */
  warningSoft: withAlpha('#C9892C', SOFT),
  warningSoftDark: withAlpha('#D6A24A', SOFT_DARK),
  /** Stronger amber slab (ENG-1521 — the `"40"`-suffix warning concat sites
   *  snap here). No web `-soft-strong` counterpart yet: zero web consumers
   *  (ENG-1521 census). */
  warningSoftStrong: withAlpha('#C9892C', SOFT_STRONG),
  warningSoftStrongDark: withAlpha('#D6A24A', SOFT_STRONG_DARK),
  /** Alcohol INK — the alcohol tracker FILL is the amber `warning` hue
   *  (`StimulantColors.alcohol` / `HydrationStimulantsCard` tone), which is
   *  only 2.61:1 as TEXT on the chip's `backgroundSecondary` surface in light
   *  (AA FAIL) — the same regression class the web `--stimulant-alcohol-solid`
   *  (ENG-1266) fixed. `alcoholSolid` (#9C5228) is the AA-safe warm clay TEXT
   *  for the alcohol quick-add chip label in light (5.07:1 on the light chip
   *  surface / 5.0:1 on the amber 14% tint), a touch warmer than `warningSolid`
   *  so alcohol ≠ generic warning. In DARK the chip sits on the dark
   *  `backgroundSecondary` where the dark clay #9C5228 collapses to 3.13:1, so
   *  `alcoholSolidDark` lifts to the bright honey #D6A24A (7.82:1 dark) — read
   *  scheme-resolved via `useAccent()`. Mirrors web `--stimulant-alcohol-solid`
   *  (#9C5228 light / #D6A24A dark). (ENG-1275.) */
  alcoholSolid: '#9C5228',
  alcoholSolidDark: '#D6A24A',
  /** Brick slot — destructive + error ONLY (over-budget is amber since the
   *  2026-07-01 re-ratification — ENG-1296). Base hue is the TEXT
   *  token in practice, so it must clear AA 4.5:1 as text: darkened
   *  #C0533F → #B04434 (2026-06-09, a11y; 4.86:1 on the cream
   *  `destructive/5` composite, 5.64:1 on white — PASS), mirrors web
   *  `--accent-destructive`. `destructiveSolid` (#9E3F2E, 6.55:1 on white)
   *  stays the darkest text variant. */
  destructive: '#B04434',
  destructiveLight: '#DC6B55',
  destructiveSolid: '#9E3F2E',
  /** Soft brick tint for destructive rows / delete confirms / error fills
   *  (ENG-1521 — the `Accent.destructive + "12"/"14"`-style concats snap
   *  here). Dark derives from the lifted brick. ↔ web
   *  `--accent-destructive-soft` (light + .dark). */
  destructiveSoft: withAlpha('#B04434', SOFT),
  destructiveSoftDark: withAlpha('#DC6B55', SOFT_DARK),
  /** Stronger brick slab (ENG-1521 — the `"40"`/`"55"`-suffix destructive
   *  concat sites snap here). No web `-soft-strong` counterpart yet: zero web
   *  consumers (ENG-1521 census). */
  destructiveSoftStrong: withAlpha('#B04434', SOFT_STRONG),
  destructiveSoftStrongDark: withAlpha('#DC6B55', SOFT_STRONG_DARK),
  /** Legacy `cyan` alias — remapped onto Sloe teal (cyan has no Sloe slot). */
  cyan: '#4A7878',
  /** Teal INK — the raw `cyan` fill (#4A7878) is only 4.14:1 as TEXT on its own
   *  14% Badge tint in light and 2.98:1 on a dark card (AA FAIL both schemes).
   *  The `-solid` family carries any cyan/teal TEXT (freeze/info Badge label,
   *  the Today freeze-earned "Got it" ghost-link) while the raw hue stays the
   *  fill/border. Scheme-resolved via `useAccent()` exactly like
   *  `primarySolid` → `primarySolidDark`. Mirrors web `--macro-water-solid`
   *  (#3C5F6B light / #7FAAB8 dark). #3C5F6B = 5.78:1 on the light tint; the
   *  lifted #7FAAB8 = 5.84:1 on the dark tint — PASS both. (ENG-1275, parity
   *  with web ENG-780/828/1273.) */
  cyanSolid: '#3C5F6B',
  cyanSolidDark: '#7FAAB8',
  /** Soft teal tint for freeze/fiber chips + snack-adjacent fills (ENG-1521 —
   *  the teal family had NO soft token on either platform; the `#4A7878`
   *  concat sites snap here). Dark derives from the lifted teal `fiberLight`
   *  #6FA3A3 (= dark `sourceOff`), the same OLED lift the other families use.
   *  No web `--accent-teal-soft` yet — nearest web relative is
   *  `--macro-water-soft`, a different (muted-teal) hue; zero web consumers
   *  need one (ENG-1521 census). */
  cyanSoft: withAlpha('#4A7878', SOFT),
  cyanSoftDark: withAlpha('#6FA3A3', SOFT_DARK),
  cyanSoftStrong: withAlpha('#4A7878', SOFT_STRONG),
  cyanSoftStrongDark: withAlpha('#6FA3A3', SOFT_STRONG_DARK),
  /** Legacy `orange` alias — remapped onto Sloe amber. */
  orange: '#C9892C',
  /** Legacy `magenta` alias — remapped onto Sloe amber (Fat macro is amber;
   *  AI source is damson). No standalone magenta in Sloe. */
  magenta: '#C9892C',
  /** Info — Sloe damson (info/win family). Mirrors web `--accent-info`. */
  info: '#6A4B7A',
  /** Soft damson tint for info fills — paywall feature-row tint, PRO-column
   *  wash (ENG-1521). Dark derives from the lifted damson `purpleLight` (=
   *  web .dark `--accent-info`). Web `--accent-info-soft` currently sits at
   *  8% light / 16% dark — under the sanctioned 12/18 scale; the ruling snaps
   *  sub-10% UP to Soft, and the web-side snap is part of the same ENG-1521
   *  consolidation (mobile lands the ruling values, not the drifted ones). */
  infoSoft: withAlpha('#6A4B7A', SOFT),
  infoSoftDark: withAlpha('#9A7BAA', SOFT_DARK),
  infoSoftStrong: withAlpha('#6A4B7A', SOFT_STRONG),
  infoSoftStrongDark: withAlpha('#9A7BAA', SOFT_STRONG_DARK),
  /** Carbs (+ sugar) — Sloe clay. Distinct from sodium's honey + the amber
   *  warning/fat hue. */
  carbs: '#C8794E',
  carbsLight: '#D58A5E',
  /** Activity / burn / earned-bonus — Sloe honey. Ring bonus arc, activity
   *  cards, burn-detail bonus. Distinct from the darker warning/over-budget
   *  ambers (ENG-1296). FILL-only (arc/dot/icon at 3:1) — see `activitySolid`
   *  for text. */
  activity: '#D6A24A',
  activityLight: '#E0B25E',
  /** Deep honey — TEXT/icon-on-light variant of `activity` (mirrors web
   *  `--activity-solid`). Base honey is fill-only (#D6A24A is 2.3:1 even on
   *  white — never passes as text). Clears AA on the honey activity tint
   *  (4.9:1) + on white (5.9:1). Use for burn-detail "Bonus earned" value +
   *  workout-kcal text. `activitySolidDark` (= lifted honey) carries text on
   *  the dark card (6.9:1). */
  activitySolid: '#8A5A14',
  activitySolidDark: '#E0B25E',
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
  /** Win soft, dark scheme (ENG-1521 — `winSoft` was light-only). Derives
   *  from the OLED-lifted damson `purpleLight` (= web .dark `--accent-win`).
   *  Web .dark `--accent-win-soft` sits at 16% — 2 points under the
   *  sanctioned dark Soft step; the web-side snap is part of the same
   *  ENG-1521 consolidation. */
  winSoftDark: withAlpha('#9A7BAA', SOFT_DARK),
  /** Stronger win slab for the one hero celebration surface (ENG-1521). No
   *  web `-soft-strong` counterpart yet: zero web consumers (census). */
  winSoftStrong: withAlpha('#6A4B7A', SOFT_STRONG),
  winSoftStrongDark: withAlpha('#9A7BAA', SOFT_STRONG_DARK),
};

/**
 * Win / achievement SLOE BRAND gradient stops — Phase 0 (dossier D-3). The
 * celebration FILL (ring sweep / glow / pulse). Use with `react-native-svg`
 * `<LinearGradient>` (3 stops at 0% / 50% / 100%) or any consumer that takes an
 * ordered stop list. Mirrors web `--accent-win-gradient`
 * (`linear-gradient(120deg, #3B2A4D 0%, #5B3B6E 50%, #7E5C92 100%)`).
 */
/** Shape for the win-moment gradient. 3 ordered stops + matching offsets. */
export type WinGradient = {
  readonly stops: readonly [string, string, string];
  readonly offsets: readonly [number, number, number];
};

export const AccentWinGradient: WinGradient = {
  /** Sloe brand gradient — plum → aubergine → lift, in paint order. */
  stops: ['#3B2A4D', '#5B3B6E', '#7E5C92'] as const,
  /** Matching stop offsets (`0..1`) for SVG `<Stop offset>`. */
  offsets: [0, 0.5, 1] as const,
};

/** Opacity of the cold-open empty calorie-ring brand-gradient sweep (ENG-1086).
 *  The empty ring paints a full 360° AccentWinGradient at this opacity so the
 *  largest object on the most-viewed screen reads as a confident brand loop,
 *  not a grey loading skeleton. ~0.36 keeps it present but clearly "ready/empty"
 *  vs the full-opacity populated fill. Mirrored on web as
 *  `--ring-empty-gradient-opacity`. */
export const RING_EMPTY_GRADIENT_OPACITY = 0.36;

// Accent history: the Frost flag (`brand_frost_secondary`) was retired
// 2026-06-08; clay was briefly the unconditional accent, then SUPERSEDED the
// same day by the aubergine-violet `#5B3B6E` system (Julienne-restraint review
// — see docs/decisions/2026-06-08-aubergine-accent-system.md). Clay survives
// ONLY as `MacroColors.carbs`. Damson `#6A4B7A` stays a scarce brand-identity
// role (win / Pro / streaks / info), never "the accent".

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
  // Sloe v3 reassignment (2026-06-21, prototype `:root`) — protein → plum,
  // carbs → amber, fat → berry-rose (NEW), fiber + calories → sage,
  // sugar → damson, sodium → clay, water → muted teal. `-Solid` darkened
  // variants carry small text/icon at AA on light. ↔ web src/styles/theme.css.
  calories: '#5E7C5A',         // Sage — under-budget calorie ring identity
  protein:  '#3B2A4D',         // Plum
  proteinSolid: '#3B2A4D',     // 12:1 on white — AA PASS
  carbs:    '#C9892C',         // Amber
  carbsSolid: '#956619',
  fat:      '#B25D7A',         // Berry rose — NEW v3 hue
  fatSolid: '#9A4A66',         // darkened berry — ~6:1 on white, AA PASS
  fiber:    '#5E7C5A',         // Sage
  fiberSolid: '#466046',
  sugar:    '#6A4B7A',         // Damson
  sodium:   '#C8794E',         // Clay
  water:    '#5A8A99',         // Muted teal
};

/**
 * Dark-scheme macro hues (ENG-1223). The v3 light macros are tuned for the
 * white ground — protein plum `#3B2A4D` is near-invisible on the Nocturne dark
 * ground `#120D18`. The core 5 mirror web `.dark` (`src/styles/theme.css`)
 * value-for-value (pinned by `crossPlatformThemeTokens.test.ts`); sugar/sodium/
 * water have no web dark token (secondary micros) so they're lightened here for
 * dark-ground contrast. Resolve via `macroColorFor(key, isDark)` /
 * `useMacroColors()` — never read `MacroColors.*` directly in a themed surface.
 */
export const MacroColorsDark: typeof MacroColors = {
  calories: '#7FA078',         // sage (lightened)
  protein:  '#B9A7CC',         // plum (lightened)
  proteinSolid: '#B9A7CC',
  carbs:    '#E0A64A',         // amber (lightened)
  carbsSolid: '#E0A64A',
  fat:      '#D489A3',         // berry rose (lightened)
  fatSolid: '#D489A3',
  fiber:    '#7FA078',         // sage (lightened)
  fiberSolid: '#7FA078',
  sugar:    '#A98BC0',         // damson (lightened — no web dark token)
  sodium:   '#D89A6E',         // clay (lightened — no web dark token)
  water:    '#7FAAB8',         // teal (lightened — no web dark token)
};

/** The 8 macro identity hues that carry a soft-tint role. The `*Solid` keys
 *  are INK variants — they have no soft form (a tint derives from the FILL
 *  hue). (ENG-1521.) */
type MacroSoftTints = Record<
  'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium' | 'water',
  string
>;

/** ENG-1521 — macro soft tints (the dynamic `config.color + "20"` /
 *  `mc.fat + "…"` concat sites snap here). Light derives from `MacroColors`
 *  at the sanctioned Soft/SoftStrong steps; dark from `MacroColorsDark`
 *  (already the OLED-lifted hues). Resolve scheme-side like the base maps
 *  (`macroColorFor`-style), never read the light map on a dark surface.
 *  ↔ web `--macro-*-soft` — web light matches at 12% except sodium (8%) and
 *  web dark sits at 16%; both are under the sanctioned scale and the
 *  web-side snap is part of the same ENG-1521 consolidation. Web has no
 *  `--macro-calories-soft`; included here so the map is total over the 8. */
export const MacroColorsSoft: MacroSoftTints = {
  calories: withAlpha(MacroColors.calories, SOFT),
  protein: withAlpha(MacroColors.protein, SOFT),
  carbs: withAlpha(MacroColors.carbs, SOFT),
  fat: withAlpha(MacroColors.fat, SOFT),
  fiber: withAlpha(MacroColors.fiber, SOFT),
  sugar: withAlpha(MacroColors.sugar, SOFT),
  sodium: withAlpha(MacroColors.sodium, SOFT),
  water: withAlpha(MacroColors.water, SOFT),
};
export const MacroColorsSoftDark: MacroSoftTints = {
  calories: withAlpha(MacroColorsDark.calories, SOFT_DARK),
  protein: withAlpha(MacroColorsDark.protein, SOFT_DARK),
  carbs: withAlpha(MacroColorsDark.carbs, SOFT_DARK),
  fat: withAlpha(MacroColorsDark.fat, SOFT_DARK),
  fiber: withAlpha(MacroColorsDark.fiber, SOFT_DARK),
  sugar: withAlpha(MacroColorsDark.sugar, SOFT_DARK),
  sodium: withAlpha(MacroColorsDark.sodium, SOFT_DARK),
  water: withAlpha(MacroColorsDark.water, SOFT_DARK),
};
export const MacroColorsSoftStrong: MacroSoftTints = {
  calories: withAlpha(MacroColors.calories, SOFT_STRONG),
  protein: withAlpha(MacroColors.protein, SOFT_STRONG),
  carbs: withAlpha(MacroColors.carbs, SOFT_STRONG),
  fat: withAlpha(MacroColors.fat, SOFT_STRONG),
  fiber: withAlpha(MacroColors.fiber, SOFT_STRONG),
  sugar: withAlpha(MacroColors.sugar, SOFT_STRONG),
  sodium: withAlpha(MacroColors.sodium, SOFT_STRONG),
  water: withAlpha(MacroColors.water, SOFT_STRONG),
};
export const MacroColorsSoftStrongDark: MacroSoftTints = {
  calories: withAlpha(MacroColorsDark.calories, SOFT_STRONG_DARK),
  protein: withAlpha(MacroColorsDark.protein, SOFT_STRONG_DARK),
  carbs: withAlpha(MacroColorsDark.carbs, SOFT_STRONG_DARK),
  fat: withAlpha(MacroColorsDark.fat, SOFT_STRONG_DARK),
  fiber: withAlpha(MacroColorsDark.fiber, SOFT_STRONG_DARK),
  sugar: withAlpha(MacroColorsDark.sugar, SOFT_STRONG_DARK),
  sodium: withAlpha(MacroColorsDark.sodium, SOFT_STRONG_DARK),
  water: withAlpha(MacroColorsDark.water, SOFT_STRONG_DARK),
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

/** OLED-lifted slot hues for the dark soft tints below — the same per-family
 *  lift the accent tokens use (amber → honey `warningLight`, sage →
 *  `successLight`, damson → `purpleLight`, teal → `fiberLight`). Module-
 *  private: only the dark soft derivations read it. (ENG-1521.) */
const SlotColorsLifted: typeof SlotColors = {
  breakfast: '#D6A24A',
  lunch:     '#83A57E',
  dinner:    '#9A7BAA',
  snack:     '#6FA3A3',
};

/** ENG-1521 — meal-slot soft tints (the `slotColor(slot) + "14"` /
 *  `resolveSlotTint` concat sites snap here). Light derives from
 *  `SlotColors` at the sanctioned steps; dark from the lifted hues above.
 *  ↔ web `--slot-*-soft` — currently hex8 `#…12` (~7% alpha), under the
 *  sanctioned scale; the web-side snap is part of the same ENG-1521
 *  consolidation. */
export const SlotColorsSoft: typeof SlotColors = {
  breakfast: withAlpha(SlotColors.breakfast, SOFT),
  lunch: withAlpha(SlotColors.lunch, SOFT),
  dinner: withAlpha(SlotColors.dinner, SOFT),
  snack: withAlpha(SlotColors.snack, SOFT),
};
export const SlotColorsSoftDark: typeof SlotColors = {
  breakfast: withAlpha(SlotColorsLifted.breakfast, SOFT_DARK),
  lunch: withAlpha(SlotColorsLifted.lunch, SOFT_DARK),
  dinner: withAlpha(SlotColorsLifted.dinner, SOFT_DARK),
  snack: withAlpha(SlotColorsLifted.snack, SOFT_DARK),
};
export const SlotColorsSoftStrong: typeof SlotColors = {
  breakfast: withAlpha(SlotColors.breakfast, SOFT_STRONG),
  lunch: withAlpha(SlotColors.lunch, SOFT_STRONG),
  dinner: withAlpha(SlotColors.dinner, SOFT_STRONG),
  snack: withAlpha(SlotColors.snack, SOFT_STRONG),
};
export const SlotColorsSoftStrongDark: typeof SlotColors = {
  breakfast: withAlpha(SlotColorsLifted.breakfast, SOFT_STRONG_DARK),
  lunch: withAlpha(SlotColorsLifted.lunch, SOFT_STRONG_DARK),
  dinner: withAlpha(SlotColorsLifted.dinner, SOFT_STRONG_DARK),
  snack: withAlpha(SlotColorsLifted.snack, SOFT_STRONG_DARK),
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
    textSecondary: '#655C6E',
    // a11y (2026-06-23, web parity): darkened #9B93A3 → #6E6874 (old grey was
    // 2.96:1 on white — failed AA 4.5:1 as small text). #6E6874 is 5.39 white /
    // 4.81 cream — PASS, lightest grey that clears AA. Mirrors web
    // `--foreground-tertiary`. textSecondary (#655C6E) already passed.
    textTertiary: '#6E6874',
    // Sloe v3 surface model (2026-06-21, prototype docs/ux/redesign/v3),
    // refined 2026-07-01 (decision #6, ENG-1316): the v3 ground system wants
    // "a whisper-cool near-white ground so BRIGHT WHITE cards lift on a soft
    // shadow" — but the pure-white token left page vs card at 2/255 (the
    // one-card soft lift was invisible at the fill level). The ground now
    // lands that intent: whisper-COOL plum-white #F7F6FA (NOT beige/warm —
    // "elevation, not warmth" holds), white cards + Elevation.cardSoft
    // unchanged. Δ 8/9/5 per channel vs the white card — measurable. Ladder:
    // card #FFFFFF > background #F7F6FA > grouped #F5F4F7 > secondary
    // #F1F0F4. Splash/icon ground stays #FBF8F3 in app.json
    // (brandIconSplash.test.ts pins it). ↔ web theme.css --background.
    background: '#F7F6FA',          // whisper-cool plum-white canvas (ENG-1316)
    backgroundSecondary: '#F1F0F4', // recessed cool plum-grey (tracks, wells)
    backgroundGrouped: '#F5F4F7',   // faint cool-plum grouped ground (NOT beige)
    card: '#FFFFFF',                // white card — lift via Elevation.cardSoft
    cardElevated: '#FFFFFF',
    fillQuiet: '#F1F0F4',           // cool quiet fill (was warm cream); ↔ web --fill-quiet
    cardBorder: '#EAE7F0',          // v3 faint cool-plum hairline
    border: '#EAE7F0',
    borderStrong: '#D9D4E0',
    tint: Accent.primary,
    /** Nav / brand primary — Sloe plum. The FAB, wordmark, and page titles
     *  use this (locked Grace 2026-06-04: plum = brand/nav primary, clay =
     *  inline content CTAs). Distinct from `tint` (clay) so the centre Log
     *  FAB reads as nav chrome, not a content action. Matches the Figma TD
     *  frames + `_gen.mjs` tabBar (`bg-plum` FAB). Mirrors web --nav-primary. */
    navPrimary: '#3B2A4D',
    icon: '#655C6E',
    tabIconDefault: '#9B93A3',
    tabIconSelected: Accent.primary,
    inputBg: '#FFFFFF',             // v3 white input — lifts on the cool ground + border (ENG-1316)
    /** Skeleton/shimmer fill — mirrors web `--muted` (#EBEAF1 frost-grey).
     *  MUST stay distinct from `card`: the pre-ENG-1479 skeletons filled with
     *  `inputBg`, which the v3 migration turned white — white-on-white loading
     *  states read as a blank broken box (Discover "Recipe ideas", 2.5s). */
    skeleton: '#EBEAF1',
    overlay: '#00000088',
    /** Source / provenance dots — Sloe palette. Mirrors web --source-*. */
    sourceUsda: '#5E7C5A',          // sage
    sourceOff: '#4A7878',           // teal
    sourceFatsecret: '#C9892C',     // amber
    sourceManual: '#9B93A3',        // warm grey
    sourceAi: '#6A4B7A',            // damson
    confidenceNeutral: '#655C6E',
    /** ENG-1521 — soft chip tints for the provenance + confidence families
     *  (NutritionSourceBadge, TrustChip/ConfidenceChip, ProgressOnTargetRibbon
     *  fills that previously alpha-concatenated the base hue). Soft step only:
     *  these chips never take the hero SoftStrong weight. Scheme-resolved via
     *  `colors.*` like their base hues. No web counterparts yet — zero web
     *  consumers (ENG-1521 census). */
    sourceManualSoft: withAlpha('#9B93A3', SOFT),
    sourceAiSoft: withAlpha('#6A4B7A', SOFT),
    confidenceNeutralSoft: withAlpha('#655C6E', SOFT),
    /** North-star + over-budget — Sloe palette. plum → clay gradient. */
    northStarBgFrom: 'rgba(59, 42, 77, 0.08)',
    northStarBgTo: 'rgba(200, 121, 78, 0.05)',
    northStarBorder: 'rgba(59, 42, 77, 0.18)',
    /** ENG-1525 — Progress hierarchy hero tint: the ONE tinted card on the
     *  Progress page (Trajectory hero), a deliberate ENG-1497 carve-out on
     *  the flat card field. Brand plum (#5B3B6E) wash — gradient from → to +
     *  hairline border. ↔ web `--hero-tint/-to/-border`. */
    heroTint: 'rgba(91, 59, 110, 0.11)',
    heroTintTo: 'rgba(91, 59, 110, 0.045)',
    heroTintBorder: 'rgba(91, 59, 110, 0.28)',
    /** ENG-1094 — Discover import-from-Reel hero (the permanent conversion
     *  wedge). A confident lavender-plum accent: the lighter brand plum (#7E5C92)
     *  at a higher opacity reads clearly as a deliberate accent, not the
     *  desaturated grey of the muddy flat ~20% dark-plum wash it replaces.
     *  Text-safe (the plum headline + grey subcopy stay legible). Grace
     *  2026-06-13: "keep it a hero but a real accent." */
    importHeroBg: 'rgba(126, 92, 146, 0.30)',
    /** Over-budget foreground — AMBER (2026-07-01 re-ratification, ENG-1296):
     *  the dossier D-2 red carve-out is retired; over-budget product-wide is
     *  the amber warning family. Value == `Accent.warningSolid` (#925812 —
     *  5.79:1 white / 5.17:1 cream / 5.38:1 tinted ground — AA PASS as text,
     *  so the "kcal over" ring numeral reads at AA). ↔ web `--over-budget-fg`
     *  (= var(--accent-warning-solid)). */
    overBudgetFg: '#925812',
    overBudgetSoft: 'rgba(201, 137, 44, 0.12)', // amber soft — ↔ web --over-budget-soft (= --accent-warning-soft)
    /** Foreground tokens that previously lived only in CSS — wired
     *  here so RN consumers can stop hardcoding `#fff`. */
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    /** Logo plate — Sloe plum rings on oat (mirrors web --brand-mark-ring). */
    brandMarkRing: '#3B2A4D',
    /** Calorie ring empty track — v3 frost-grey (visible full ring on white). */
    ringTrack: '#D8D0E6',
    /** Bold ring track — a 14% tint of the plum ring hue (#3B2A4D), used as the
     *  empty-arc track in every LOGGED state (design-director 2026-06-16, Apple
     *  Fitness grammar). The old frost-mist #EDEAF1 measured ~10/255 off the
     *  white card — invisible, so a partly-logged ring read as empty. 14% plum
     *  lands ~30/255 off white: a confident "unfilled ring", still subordinate
     *  to the 100%-opacity fill arc. Macro tracks use a tint of their OWN hue
     *  (in CalorieRing/SkiaRingArcs), not this. ↔ web --ring-track-bold. */
    ringTrackBold: 'rgba(59, 42, 77, 0.24)',
    /** CalorieRing overflow-ramp `to`-stop (light) — the "~1.5 shades up" wrap
     *  tone the lap ends on (2026-06-10 round 3). The `from`-stop reuses
     *  `Accent.primaryLight`; this `to`-stop had no token so it lived as a raw
     *  hex in CalorieRing — tokenised in ENG-1269 (value-equal). */
    ringOverflowTo: '#7A5890',
    /** Sloe v3 jewel watch-dial — graduation ticks + state gradient stops +
     *  luminous gem core. ↔ web theme.css `--ring-{tick,under,over,empty,cap-core}`.
     *  ENG-1485 (2026-07-10): the empty-track tick is DECORATIVE geometry, not
     *  informational iconography — ratified floor is ≥1.3:1 composited over card
     *  AND page ground (measures ~1.45:1 light / ~1.70:1 dark; the ENG-1315 3:1
     *  target applies to informational graphics only). Gated by
     *  tests/unit/ringTickContrast.test.ts — don't lower the alpha without it. */
    ringTick: 'rgba(59, 42, 77, 0.20)',
    ringCapCore: '#FFFFFF',
    ringUnderA: '#4D7A50', ringUnderB: '#93C08C',
    /** Over arc — ONE amber family with the numeral (ENG-1296, 2026-07-01:
     *  the coral/red #C0533F→#E08A5F pair is retired). Stops are the amber
     *  warning tokens themselves: A = `Accent.warningSolid`, B = `Accent.warning`. */
    ringOverA: '#925812', ringOverB: '#C9892C',
    /** Empty (cold-open) arc — deepened calm plum-lilac (ENG-1315, decision
     *  2026-07-01 #5): the old frost bloom #C4BCD4/#E6E0F1 measured ≈1.8:1 on
     *  white — under the 3:1 UI-component floor, so the hero read as a
     *  skeleton. Both stops now clear it: A #786A94 = 4.90:1 white, B #9587B3
     *  = 3.28:1 white — still the calm "ready/empty" bloom, now visible. */
    ringEmptyA: '#786A94', ringEmptyB: '#9587B3',
  },
  dark: {
    // SLOE Phase 0 dark — warm aubergine graphite, not cool-slate.
    text: '#ECE8F0',                // ↔ web --foreground (soft plum-white, never pure #fff)
    textSecondary: '#B8B0C4',
    textTertiary: '#8A8198',
    background: '#120D18',          // ↔ web --background (Nocturne deep plum-black)
    backgroundSecondary: '#1A1422', // ↔ web --background-secondary
    backgroundGrouped: '#161019',   // ↔ web --background-grouped
    card: '#211A2A',                // ↔ web --card (raised plum card)
    cardElevated: '#2A2233',        // ↔ web --card-elevated (one-step lift)
    fillQuiet: '#241C2E',           // quiet fill (dark) — ↔ web dark --muted
    cardBorder: '#332843',          // ↔ web --border
    border: '#332843',
    borderStrong: '#443656',        // ↔ web --border-strong
    tint: Accent.primaryLight,
    /** Nav / brand primary — Sloe lifted plum on dark (matches `_gen.mjs`
     *  HEAD_DARK `plum:'#815E91'`). See light-mode note above. */
    navPrimary: '#815E91',
    icon: '#B7B2BA',                // ↔ web --foreground-secondary (dark)
    tabIconDefault: '#857F8B',
    tabIconSelected: Accent.primaryLight,
    inputBg: '#1A1422',             // ↔ web --input-background (dark)
    /** Skeleton/shimmer fill — deliberately NOT web's dark `--muted`
     *  (#241C2E), which measures 1.03:1 on the dark card — as invisible as
     *  the white-on-white bug this token exists to fix. #332843 (the border
     *  hue) hits 1.22:1 on card, matching the light scheme's 1.20:1 weight. */
    skeleton: '#332843',
    overlay: '#000000aa',
    /** Source / provenance dots — Sloe dark (lifted). */
    sourceUsda: '#83A57E',
    sourceOff: '#6FA3A3',
    sourceFatsecret: '#D6A24A',
    sourceManual: '#857F8B',
    sourceAi: '#9A7BAA',
    confidenceNeutral: '#857F8B',
    /** ENG-1521 — provenance + confidence soft chip tints, dark scheme.
     *  Derive from the lifted dark base hues above (see light-scheme note). */
    sourceManualSoft: withAlpha('#857F8B', SOFT_DARK),
    sourceAiSoft: withAlpha('#9A7BAA', SOFT_DARK),
    confidenceNeutralSoft: withAlpha('#857F8B', SOFT_DARK),
    /** North-star + over-budget — Sloe dark. */
    northStarBgFrom: 'rgba(129, 94, 145, 0.16)',
    northStarBgTo: 'rgba(213, 138, 94, 0.06)',
    northStarBorder: 'rgba(129, 94, 145, 0.28)',
    /** ENG-1525 — Progress hierarchy hero tint, Sloe dark (lifted plum,
     *  alphas raised so the wash + hairline read on the dark ground).
     *  ↔ web .dark `--hero-tint/-to/-border`. */
    heroTint: 'rgba(154, 123, 170, 0.2)',
    heroTintTo: 'rgba(154, 123, 170, 0.08)',
    heroTintBorder: 'rgba(154, 123, 170, 0.38)',
    /** ENG-1094 — Discover import hero confident lavender-plum accent (dark). */
    importHeroBg: 'rgba(154, 123, 170, 0.30)',
    /** Over-budget foreground (dark) — amber (ENG-1296): the dark warning-solid
     *  honey (7.33:1 on the dark card — AA PASS). ↔ web .dark --over-budget-fg. */
    overBudgetFg: '#D6A24A',
    overBudgetSoft: 'rgba(214, 162, 74, 0.18)', // ↔ web .dark --over-budget-soft
    destructiveForeground: '#ffffff',
    primaryForeground: '#ffffff',
    brandMarkRing: '#ffffff',
    ringTrack: '#372F44',
    /** Bold ring track (dark) — lifted plum #815E91 at 22% so the unfilled ring
     *  reads on the dark card. ↔ web .dark --ring-track-bold. */
    ringTrackBold: 'rgba(129, 94, 145, 0.34)',
    /** CalorieRing overflow-ramp `to`-stop (dark) — the "~1.5 shades up" wrap
     *  tone the lap ends on (2026-06-10 round 3). The `from`-stop reuses
     *  `Colors.dark.navPrimary`; this `to`-stop had no token so it lived as a
     *  raw hex in CalorieRing — tokenised in ENG-1269 (value-equal). */
    ringOverflowTo: '#A589B5',
    /** Sloe v3 jewel watch-dial (dark) — brighter so the gem reads luminous on
     *  Nocturne. ↔ web .dark `--ring-{tick,under,over,empty,cap-core}`. */
    ringTick: 'rgba(201, 194, 214, 0.24)',
    ringCapCore: '#FBF7FF',
    ringUnderA: '#6FA06A', ringUnderB: '#B6E0AD',
    /** Over arc (dark) — lifted amber family (ENG-1296): A = dark warning-solid
     *  honey, B = lifted light honey. Red pair #D2614A→#F0A47A retired. */
    ringOverA: '#D6A24A', ringOverB: '#E0B25E',
    /** Empty arc (dark) — A lifted #6A5A7E → #7D6C93 (ENG-1315: 3.56:1 on the
     *  dark card vs 2.71:1 before — same 3:1 floor as light). B unchanged. */
    ringEmptyA: '#7D6C93', ringEmptyB: '#B9ADD0',
  },
};

/** 4px grid — 2026-05-19 premium rhythm bump (Noom/Lifesum airy feel).
 *  xs/sm unchanged for tight in-row gaps; md+ lifted ~4–8px. */
export const Spacing = {
  xs: 4,
  sm: 8,
  // ENG-1012 (Grace, 2026-06-10): the legal dense step between sm and md —
  // chip/pill internal padding, dense meal-row rhythm. Adopted because the
  // 8→16 jump was too coarse: 12 appeared 224× as a literal (the single
  // heaviest off-scale value in the 2026-06-10 census). Use this token, not
  // the literal.
  dense: 12,
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
  /** ENG-1497 (2026-07-10, Grace's card-grammar ruling) — THE card corner.
   *  Cards, banners, card-rows, tiles and sheets all share it (one
   *  material); chips stay `full`, nested/inset panels stay `xl` (the
   *  12-inside-24 concentric standard). Previously an untokenised
   *  SupprCard module constant. ↔ web `--radius-card-lg`. */
  card: 24,
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
  /** Fraunces Bold — the brand WORDMARK/logo ONLY (the lowercase "sloe"
   *  mark). 700 Bold matches the splash logotype (Grace 2026-06-26 — the
   *  in-app mark read too thin next to the launch logo); supersedes the prior
   *  300 Light. Fraunces = wordmark; Newsreader = every other serif role. */
  brand: 'Fraunces_700Bold',
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
  /** Ratified standard page title (ENG-1574/1577): Newsreader 33/38/500.
   *  Used by Plan, Recipes, Progress, Settings, and comparable utility
   *  screens. Today deliberately keeps its wordmark + ring-first chrome. */
  pageTitle: { fontFamily: FontFamily.serifMedium, fontSize: 33, lineHeight: 38, fontWeight: '500' as const, letterSpacing: -0.4 },
  headline:{ fontFamily: FontFamily.serifMedium, fontSize: 17, lineHeight: 22, fontWeight: '500' as const, letterSpacing: -0.1 },
  /** Large left-aligned in-body screen H1 — Newsreader serif 28/34, weight 600,
   *  the editorial screen-title voice (matches what SloeHeaderWordmark / Settings
   *  already render). For the big top-of-scroll title on a push/sub screen:
   *  Targets ("Daily targets"), Health-Sync, Household, Weight & Trends,
   *  Nutrition-sources. Consolidates five hand-rolled serif/Inter headers into
   *  one token (ui-product-designer Spec 3, 2026-06-09). Set `color: colors.text`
   *  at the call site. Mirrors web `.screen-title` in `src/styles/theme.css`.
   *  Rule of thumb: large left-aligned top-of-scroll title → screenTitle. */
  screenTitle: { fontFamily: FontFamily.serifSemibold, fontSize: 28, lineHeight: 34, fontWeight: '600' as const, letterSpacing: -0.3 },
  /** Compact nav-bar-row title — Newsreader serif 18/22, weight 500. The single
   *  shared lever for PushScreenHeader's title (and any nav-bar-row title that
   *  was Inter-bold). Quieter than `screenTitle`; sits next to the back chevron.
   *  Mirrors web `.nav-title`. Rule of thumb: compact nav-bar-row title →
   *  navTitle (ui-product-designer Spec 3, 2026-06-09). */
  navTitle: { fontFamily: FontFamily.serifMedium, fontSize: 18, lineHeight: 22, fontWeight: '500' as const, letterSpacing: -0.1 },
  body:    { fontFamily: FontFamily.sansMedium, fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0 },
  /** In-body emphasis row — 15/20 sans medium (ENG-1281). Call sites often override weight. */
  bodyLarge: { fontFamily: FontFamily.sansMedium, fontSize: 15, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0 },
  /** CTA / button label — Inter SemiBold 16. Sans, NOT the Newsreader serif
   *  ramp (headline/title): serif on a control reads dated; every comparable
   *  (Withings/Alma) uses a sans semibold button label. Grace 2026-06-12. */
  button:  { fontFamily: FontFamily.sansSemibold, fontSize: 16, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0 },
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
  /** Secondary metadata — 12/16 sans medium (ENG-1281). Prefer over raw `fontSize: 12`. */
  captionSmall: { fontFamily: FontFamily.sansMedium, fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0 },
  /** Hero stat label — GOAL/EATEN/BONUS under the ring. A calmer sibling of
   *  `label`: 600 (not 700) and 0.5 tracking (not 0.88) so the tracked caps
   *  read as a quiet section label, not a shouty warning (design-director
   *  2026-06-16, grounded in MacroFactor's light hero labels). Colour set at
   *  the call site — use `textSecondary` (AA), not `textTertiary`. Mirrors web
   *  `.stat-label`. */
  statLabel: { fontFamily: FontFamily.sansSemibold, fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  /** Tab-chrome subtitle — the descriptive line under a primary-tab serif
   *  title (Plan week-range, Progress "Your weight, weekly recap…"). 13/600,
   *  one step above `caption` so it reads as a peer descriptor not a footnote.
   *  Sole token home for the previously hand-rolled chrome subtitle literal
   *  (headers census 2026-06-10). Set colour at the call site. */
  captionStrong: { fontFamily: FontFamily.sansSemibold, fontSize: 13, lineHeight: 18, fontWeight: '600' as const, letterSpacing: 0.2 },
  /** Quiet editorial coach line — Newsreader italic, muted, centred. The
   *  calm forward-looking nudge under the ring (de-carded deficit insight,
   *  2026-06-03). Matches the Stitch `today.html` coach line
   *  (`font-headline italic text-[17px] text-plum/90`) — bumped 14→17 on
   *  2026-06-04 (Grace measured-spec pass) so the "Room for dinner…" line
   *  reads as the editorial plum nudge it is in the mock, not a grey caption.
   *  Sole consumer: `TodayDeficitInsight.tsx` (colour set there to plum). */
  // Fresh-eyes §6 (2026-06-10): de-italicised — the serif-italic nudge read
  // as quaint at small sizes and cream+serif-italic is the documented
  // AI-default tell. The COPY stays warm; the dressing goes calm sans.
  coach:   { fontFamily: FontFamily.sansRegular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  /** Macro tile + calorie ring centre value — keep in sync. Inter (numerals
   *  stay in the sans for tight tabular alignment on small tiles + inline
   *  macro callouts like the saved-meal portion + ingredient sheets, which
   *  must NOT go serif). For the BIG hero numerals (targets / profile /
   *  weight + the Today macro-tile numeral) use `Type.heroValue` instead. */
  macroValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.35,
  },
  /** Big hero numeral — Newsreader (serif), per the approved Figma frames
   *  (the `01 · Today` macro-tile numeral + the targets/profile/weight big
   *  numbers). SLOE Phase 0 wants the big numbers in serif; this is the
   *  dedicated serif sibling of `macroValue` so adopting it on a big-numeral
   *  surface never forces serif on the small inline macro callouts that keep
   *  `macroValue`. Same 20/24 box + tabular alignment as `macroValue` (pair
   *  with `fontVariant: ['tabular-nums']` at the call site) so it's a drop-in
   *  swap; the family is the only difference. Bump `fontSize` per surface at
   *  the call site where the frame is larger. Added ENG-997 (2026-06-08). */
  heroValue: {
    fontFamily: FontFamily.serifMedium,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500' as const,
    letterSpacing: -0.35,
  },
  /** Card-payoff hero numeral — the T2 card-hero tier, one step below
   *  `ringValue` (48). Fixes the inverted 52>48 hierarchy where a card's own
   *  payoff numeral (e.g. a stat-card headline) was rendering LARGER than
   *  the Today ring's centre value, the actual apex numeral of the app.
   *  Newsreader (serif) to match every other big-numeral token on this
   *  ramp. 36 sits in the mobile type-scale DISPLAY band
   *  (`check-type-scale-mobile.mjs`), so this token is ramp-legal the
   *  moment it's added — no ratchet re-pin needed. Web mirror:
   *  `.card-hero-value` in `src/styles/theme.css` (reuses `--text-display`,
   *  no new web scale step). Sole source of truth for a card's own hero
   *  payoff number — do not hand-roll `fontSize: 36` at a call site. */
  cardHeroValue: {
    fontFamily: FontFamily.serifRegular,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '400' as const,
    letterSpacing: -0.5,
  },
  /** Serif stat row under the ring. ENG-1099 M4 set 18/22; bumped to 22/26
   *  (2026-06-16, design-director) so the second-most-important data on Today
   *  (Goal/Eaten/Bonus) reads as a real stat row, not a footnote under the 48px
   *  ring numeral. 22 = the next on-scale step (`--text-xl`); web mirrors it
   *  with `text-[22px]` (20 was off the web type ramp — ENG-119 lint). */
  statValue: {
    fontFamily: FontFamily.serifRegular,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
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
 * Shadow base colours — the `shadowColor` values that drop shadows cast from.
 *
 * Two roles, mirroring what the `Elevation.*` tokens below already use:
 *   - `cast` (#000) — the neutral black shadow base for SHEETS / TOASTS /
 *     FLOATING overlays (matches `Elevation.sheet` / `Elevation.float`). The
 *     bespoke per-component shadow recipes (custom opacity/radius/offset on a
 *     toast or modal that aren't a 1:1 `Elevation.*` token) route their
 *     `shadowColor` through this instead of a raw `'#000'`.
 *   - `ink` (#221B26) — the aubergine-ink shadow base for resting CARDS
 *     (matches `Elevation.cardSoft` / `Elevation.cardHairline`). Exposed as a
 *     token so card-level shadows never hardcode the ink hex either.
 *
 * Named here (ENG-1013, 2026-06-10) so component `shadowColor` literals can be
 * routed to a token; values are unchanged so every shadow renders identically.
 */
export const ShadowColor = {
  cast: '#000',
  ink: '#221B26',
} as const;

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
  // Subtle small-surface lift — fills the gap between flat `card` and the heavy
  // page-card `cardSoft` (radius 18). Mirrors the prototype's `--shadow-card`
  // (`0 1px 3px rgba(36,23,51,.05)`) + web `shadow-sm`, for small interactive
  // cards like the Plan-header action buttons where cardSoft reads as floaty.
  // Opacity nudged 0.05 → 0.10 so it registers on RN's white-on-white, where a
  // 5% halo is invisible (see the cardSoft edge-sampling note below). Tight
  // radius (4) + low offset (1) keep it crisp, not a wide ambient halo.
  cardHairline: {
    shadowColor: '#221B26',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
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
  // the edge pixels after the bump (see cardElevationVariants.test.tsx +
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
