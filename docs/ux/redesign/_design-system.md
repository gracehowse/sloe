# Suppr Redesign — Cross-cutting Design System

**Version:** 1.0  
**Date:** 2026-06-02  
**Status:** Canonical spec — locked for implementation. All per-surface redesign specs in `docs/ux/redesign/` are subordinate to this file where they conflict.  
**Synthesised from:** all 12 per-surface specs (`today.md`, `recipes.md`, `plan.md`, `progress-insights.md`, `nutrition-log.md`, `weight.md`, `onboarding.md`, `paywall.md`, `settings.md`, `ai-coach.md`, `import.md`, `habits.md`) plus the Mobbin warm-coaching direction board at `docs/ux/mobbin-refs/warm-coaching-direction.md`.

---

## 0. Design philosophy (locked)

**Suppr is an editorial cookbook that coaches you warmly.** It sits between diet apps (kill food joy) and recipe apps (ignore goals). The aesthetic encodes this positioning directly:

- **Julienne gives the bones:** serif-display editorial type, restrained whitespace, painterly ingredient illustrations, clean white canvas, single warm accent, gallery layout.
- **Lifesum gives the soul:** coaching voice, emotional feedback moments, warmer colour temperature, nurturing personality — expressed via copy and micro-colour, never via a cream background wash.

**Design constraints that override all surface-level decisions:**

1. White base `#FFFFFF` everywhere in the app. No cream/beige page wash. Warm cards (`#F6F5F2`) create warmth; the page background stays white.
2. Accents are accent-only, never colour-block heroes.
3. The calorie ring has its own over-budget rule (destructive red). Every other over-budget signal uses amber. This is the only exception to any rule.
4. Macro colours are immutable across all surfaces — they belong to nutrition data only.
5. Serif (Fraunces/Newsreader) is for editorial moments: display headlines, big numerals, recipe and meal names, section headers. Inter handles everything else where legibility wins.
6. Calm-warm-coach voice: encouraging, grounded in real numbers, never shaming or bubbly. No `!`. No `🔥`. No "crushed it". Past days in past tense.

---

## 0.1 Brand overlay — Sloe + post-run supersessions (2026-06-02)

These were decided AFTER this doc was generated; they supersede where they conflict. Source of
truth for the brand: `docs/brand/sloe/brand.md`.

- **Brand = Sloe** (candidate rebrand, pending TM clearance). The in-app functional palette below is
  UNCHANGED — Clay (≈ the "terracotta" referenced in specs) stays the warm CTA/Pro/encouragement
  accent; Sage = success, Amber = macros-over (not ring), Honey = best-day star, Destructive =
  ring-over-budget only. Add a **brand-identity layer**: Sloe plum `#3B2A4D` (wordmark / mark / ink
  tint), Damson `#6A4B7A` (active, gradient), **Frost `#C9C2D6` = the ownable accent**, brand
  gradient Damson→Sloe→Frost (marketing, paywall hero, empty-ring). Wherever a spec says
  "terracotta", read **Clay `#C8794E`**.
- **Ground split:** APP UI = white `#FFFFFF` (as §0 states). MARKETING surfaces (App Store
  screenshots, landing, paywall promo, social) = **Oat `#FBF8F3`** warm canvas with painterly
  produce botanicals framing the device (the Julienne App-Store treatment). Marketing surfaces are
  out of this in-app system's scope but use the Oat ground + the painterly illustration set.
- **Icons & object imagery (refined):** the off-brand failure was the COLD GLOSSY 3D CHROME render
  look, not images. (a) **Tangible objects** — cookware (saucepan, Dutch oven, pan), camera for
  "Photo", jars/bottles — MAY be images in the SAME style as ingredient single-subjects (warm, soft
  daylight, stylised-photoreal, single subject on white; ref Julienne enamel-pot loading +
  saucepan empty-state). Same generation pipeline as ingredients. (b) **Abstract controls / nav**
  (link, paste, share, bookmark, chevron, +, search, Cook/Plan/Ask, tab bar) = clean LINE icons
  (lucide), ink + Clay active. (c) **BANNED:** cold/glossy 3D chrome product-render icons.
- **Meal/dish photography** = hyperreal editorial in the register of IG `_foodstories_` and
  `thelittleplantation` (reaffirms §11). Ingredient single-subjects = keep exactly.

---

## 1. Colour system

### 1.1 Base palette (exact hex, no deviation)

| Role | Hex | Token name | Notes |
|---|---|---|---|
| Page base | `#FFFFFF` | `--background` | Every screen background. Never cream/beige in-app. |
| Ink / near-black | `#1B1814` | `--foreground` | All primary text, display numerals. |
| Warm card | `#F6F5F2` | `--card` | Secondary card backgrounds, macro tile backgrounds, input fills. |
| Hairline border | `#ECEAE4` | `--border` | All card borders, dividers, skeleton tracks. |
| Terracotta (primary CTA / active) | `#C2683E` | `--primary` | Primary buttons, active states, fit chips, filled CTAs, selected tab, streak pip active. |
| Sage (secondary) | `#7C8466` | `--secondary` | Secondary text, labels, inactive states, secondary buttons, supporting icons. |
| Amber (over-budget / alerts) | `#C9892C` | `--amber` | Over-budget macros (except calorie ring), activity bonus stat, alert states, approaching-limit signals. |
| Success green | `#5E7C5A` | `--success` | Calorie ring (logged + under budget), goal-hit states, verified ticks, weight-toward-goal delta. |
| Destructive red | CSS `--destructive` | `--destructive` | Calorie ring (logged + over budget) ONLY. Errors and dangerous actions. |
| Ring track | `#ECEAE4` | `--ring-bg` | Unfilled ring track. Same as hairline border. |

### 1.2 Semantic role rules

**Amber (`#C9892C`) is used for:**
- Over-budget macros (protein / carbs / fat / fibre / sodium when tracked)
- Over-budget day total on Plan
- Out-of-band macro indicators
- Approaching-limit signals
- Alert banners that are recoverable
- Warning tier on pace step in onboarding

**Amber is NOT used for:**
- Calorie ring over-budget (uses destructive red — the only exception)
- Streak milestone tint (uses `--streak-milestone` `#A3522C`, a distinct deeper terracotta)
- Missed-yesterday banner (uses sage left-border, not amber — it is not an alert)
- Recipe import errors that are recoverable (uses amber correctly)

**Destructive red (`--destructive`) is used for:**
- Calorie ring when logged and over budget — only this surface
- Irreversible/dangerous actions in Settings (delete account)
- Low-confidence ingredient confidence bars in recipe verify (<0.5 confidence)

**Terracotta (`#C2683E`) is accent only — never block-hero.** It appears in:
- Primary CTA button fills
- Active tab indicator
- Selected card borders (1.5–2px)
- Fit-band chips (12% opacity fill + full border)
- Streak pip active state
- Pro badge backgrounds
- CTA text links ("terracotta text link" pattern)

**Success green (`#5E7C5A`) is used for:**
- Calorie ring under-budget state
- Verified ingredient confidence bars (≥0.9 confidence)
- Goal-hit win moment context
- "On target" / "Connected" status chips
- Weight-trending-toward-goal delta arrows

### 1.3 Macro colour map (immutable)

These map exactly to `MacroColors` in `apps/mobile/constants/theme.ts` and `--macro-*` CSS variables. Do not use them for any non-nutrition purpose.

| Macro | Hex (light) | Token |
|---|---|---|
| Protein | `#588CE4` | `--macro-protein` / `MacroColors.protein` |
| Carbs | `#E8721E` | `--macro-carbs` / `MacroColors.carbs` |
| Fat | `#DF5EBC` | `--macro-fat` / `MacroColors.fat` |
| Fibre | `#4a7878` | `--macro-fiber` / `MacroColors.fiber` |
| Sugar | `#E8721E` | `--macro-sugar` (shares carbs orange) |
| Sodium | `#F78A32` | `--macro-sodium` (lighter orange than carbs) |
| Calories | `#62b35a` | `--macro-calories` |
| Water | `#06b6d4` | `--macro-water` |

**Important:** In the warm-coaching redesign, the macro colours above are used in progress bars, confidence dots, and macro tracking widgets only. The primary UI chrome (CTAs, active states, cards) uses the warm palette (terracotta, sage, amber, success green) — not macro colours.

### 1.4 Meal-slot colours

| Slot | Light hex | Token |
|---|---|---|
| Breakfast | `#F3C336` | `--slot-breakfast` |
| Lunch | `#62b35a` | `--slot-lunch` |
| Dinner | `#588CE4` | `--slot-dinner` |
| Snacks | `#06b6d4` | `--slot-snack` |

### 1.5 Specialist tokens

| Token | Hex | Use |
|---|---|---|
| `--streak-milestone` | `#A3522C` | Streak milestone pip tint only — deeper terracotta, distinct from `--amber` to avoid alert collision. |
| `--destructive-muted` | `#C25B5B` | Low-confidence ingredient bars in recipe verify. Not full destructive; signals data uncertainty, not an error. |

### 1.6 Opacity and tint patterns

All tinted backgrounds must use the format `{base-hex} at N% opacity`. Standard set:

| Use case | Base | Opacity |
|---|---|---|
| Terracotta tinted card / unselected paywall card | `#C2683E` | 6% |
| Amber tinted warning card | `#C9892C` | 12% |
| Amber tinted over-range indicator | `#C9892C` | 20–40% |
| Success green "no payment" chip | `#5E7C5A` | 8% |
| Fits-your-day success chip | `#5E7C5A` | 12% |
| Confidence band on weight chart | `#C2683E` | 12% |
| Trajectory forecast fill | `#C2683E` | 6% |
| Sage confidence band on weight chart | (sage) | 40% |

Never mix `08`, `12`, `18`, `20` for the same semantic role — pick one and apply it consistently.

---

## 2. Typography system

### 2.1 Type faces

| Face | Role | Rationale |
|---|---|---|
| **Fraunces** (primary serif) | Display, editorial numerals, recipe names, meal names, screen titles, paywall price numerals, big stats | "Editorial cookbook" register. Warm, editorial, premium without being cold. |
| **Newsreader** (secondary serif, fallback) | Used interchangeably with Fraunces when Fraunces is unavailable. Italic variant for narrative/hedge lines. | |
| **Inter** | Body, labels, data, dense tracker UI, captions, button labels, all secondary text | Legibility first. Every place where the data matters more than the editorial register. |
| **Inter (tabular-nums, ss01)** | Mono-style data values inline in sentences | Keeps numeric data stable width in flowing sentences. Apply via `fontVariant: 'tabular-nums'` (mobile) / `font-variant-numeric: tabular-nums` (web). |

**System serif fallback (mobile):** `Georgia` (iOS). Used when Fraunces/Newsreader is not yet loaded via Expo Fonts. Font load must be verified in a sim capture before push. Never assume the font loaded.

### 2.2 Full type scale

| Role | Face | Size (mobile) | Size (web) | Weight | Line height | Use |
|---|---|---|---|---|---|---|
| `display-hero` | Fraunces | 56–72pt | 56–72px | 700 | 1.0 | Calorie ring central numeral, Reveal kcal numeral, weight log hero numeral, pay wall price numeral |
| `display-title` | Fraunces | 32–40pt | 36–48px | 700 | 1.1 | Screen H1, onboarding step question, milestone modal "30 days", check-in hero headline |
| `display-subtitle` | Fraunces | 22–28pt | 24–32px | 600 | 1.2 | Recipe name (detail), section hero numbers (macro tiles 28pt, streak insight 28pt, digest headline 22pt), paywall title, progress hero metric 28pt |
| `display-section` | Fraunces | 17–22pt | 18–22px | 600 | 1.3 | Meal names in log rows, north-star recipe name, plan week-overview headline, Settings sub-screen titles |
| `display-italic` | Fraunces italic | 15–17pt | 15–17px | 400–600 | 1.3 | Closest-to-target day name in digest, win-moment context line, hedge qualifier in fasting narrative, empty states, insight commentary lines |
| `body-primary` | Inter | 15pt | 15–16px | 400 | 1.5 | Body copy, narrative sentences, why-lines, coaching sentences, subtitle rows |
| `body-secondary` | Inter | 14pt | 14px | 400 | 1.5 | Supporting text, card subtitles, sheet body |
| `label-primary` | Inter | 13–14pt | 13–14px | 500–600 | 1.4 | Row primary labels in settings, tab labels, chip labels, button-adjacent labels |
| `label-secondary` | Inter | 12–13pt | 12–13px | 400 | 1.4 | Macro captions ("X g remaining"), source labels, guidance lines, badge text, timestamp labels |
| `caption` | Inter | 11–12pt | 11–12px | 400 | 1.4 | Section eyebrows (ALL CAPS, +0.08em tracking), fine print, footnotes, methodology notes, confidence tier labels |
| `section-eyebrow` | Inter | 10–11pt | 10–11px | 600 | 1.0 | ALL CAPS, letter-spacing +0.08em. Used for `THIS WEEK`, `PROJECTED WEIGHT`, `DANGER ZONE`, `MEMBERSHIP` section labels. Colour: `--secondary` (sage) except DANGER ZONE which uses `--amber`. |
| `cta-primary` | Inter | 15–16pt | 15–16px | 600 | 1.0 | Filled button text |
| `cta-secondary` | Inter | 13–14pt | 13–14px | 500 | 1.0 | Outlined or hairline button text |
| `cta-tertiary` | Inter | 13–14pt | 13–14px | 400 | 1.0 | Text-link CTAs. Terracotta for action links. Sage/muted for dismissal links. |
| `mono-data` | Inter tabular-nums | 14–17pt | 14–17px | 500–600 | 1.2 | Kcal/macro values in flowing sentences where numeric stability matters |

### 2.3 Typography rules

1. **Serif for editorial, Inter for data.** The test: "Is this number a personal achievement or data in a tracker?" Achievement (streak count, calorie target, recipe macro on detail) → Fraunces. Data in a dense row (macro sub-label, source chip, recipe card macro row) → Inter.
2. **Meal names and recipe names always Fraunces** throughout the product — in log rows, in plan cards, in north-star cards, in library cards. This is the most impactful single typographic change across the product.
3. **Big numerals always Fraunces** — the central calorie ring numeral, the macro tile gram values, streak count in insight card, progress hero metric, portion modal multiplier, log reveal kcal. Any number that is the primary focus of a screen or card uses the serif display face.
4. **No hardcoded font sizes** — use the scale tokens above. Platform-specific note: React Native uses `fontSize` as a number (pt); web uses `px` values via Tailwind or CSS variables. The scale aligns so 15pt ≈ 15px.
5. **Italic Fraunces for editorial commentary** — used for the insight/hedge layer: closest-to-target day in digest, win-moment lines, fasting narrative hedges, empty state copy that is editorial in register ("Quiet week.", "Day 30. That's a habit."). Not used for data or labels.
6. **ALL-CAPS section eyebrows** — Inter 10–11pt, letter-spacing +0.08em, `--secondary` (sage). Always a visual separator between sections, never decorative.

---

## 3. Spacing system

### 3.1 Base grid: 4pt

All spacing values are multiples of 4pt. The canonical set:

| Token | Value | Use |
|---|---|---|
| `xs` | 4pt/px | Tight gaps within a row (icon ↔ label, dot ↔ text) |
| `sm` | 8pt/px | Within-card row gaps, chip inner padding horizontal |
| `md` | 12pt/px | Card internal row-to-row gap, between-tile gap in grids |
| `lg` | 16pt/px | Card internal padding (standard), section label margin-below |
| `xl` | 20pt/px | Card internal padding (hero ring card) |
| `2xl` | 24pt/px | Between card sections, above section eyebrow |
| `3xl` | 32pt/px | Between major screen sections |
| `screen-edge` | 16pt/px (mobile) / 24px (web) | Horizontal screen margin |

### 3.2 Card internal padding

| Card type | Padding |
|---|---|
| Standard card | `px-4 py-4` (16pt all sides) |
| Hero ring card | `px-6 py-8` (24pt / 32pt) |
| Bottom sheet / modal | `px-5 py-6` top section; `px-4` body |
| Inset tile | `p-3` (12pt) |
| Chip / badge | `px-2 py-0.5` (8pt / 2pt) |

### 3.3 Row heights (minimum)

| Element | Min height |
|---|---|
| All interactive rows (settings, log rows, action rows) | 44pt |
| Standard meal log row | 64pt |
| Plan meal row card | 72–88pt |
| CTA button (primary) | 48–52pt |
| CTA button (secondary) | 44pt |
| Section eyebrow row | 32pt |

---

## 4. Radius system

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 6pt/px | Pills, small badges, stepper buttons |
| `radius-sm` | 8pt/px | Chips, filter pills, ingredient rows, Pro badge, recipe card image inner clip, inset stat tiles |
| `radius-md` | 12pt/px | Standard cards (macro tiles, insight banners, input fields, default card radius) |
| `radius-lg` | 16pt/px | Primary cards (hero ring card, north-star card, recipe detail card, settings cards, paywall TierCard), bottom sheet top radius |
| `radius-xl` | 20pt/px | Bottom sheet top radius (alternative), modals, large sheets |
| `radius-full` | 9999pt/px | Pills (fully rounded), avatar circles |

---

## 5. Elevation and shadow

**One elevation level in-app.** Cards sit on the page background with a hairline border. No layered card-on-card stacking.

| Use case | Shadow |
|---|---|
| Cards on white base (`--background`) | `border: 1px solid #ECEAE4` (hairline) + `box-shadow: 0 1px 4px rgba(27,24,20,0.06)` (iOS: `shadowColor: '#1B1814'`, `shadowOpacity: 0.06`, `shadowRadius: 4`, `shadowOffset: { width: 0, height: 1 }`, `elevation: 2`) |
| Tiles on card background (`--card`) | No shadow, no border — background token provides separation |
| Elevated sheets (LogSheet, preview card) | `box-shadow: 0 2px 8px rgba(27,24,20,0.04)` — lighter than cards since sheets already have the modal contrast |
| Bottom sheets / modals | `box-shadow: 0 8px 32px rgba(0,0,0,0.12)` |

---

## 6. Card system

### 6.1 Card anatomy

Every card has exactly one of three background roles:

1. **Primary card** — white base `#FFFFFF`, hairline border, standard shadow. Used for: hero ring card, north-star card, paywall TierCard, recipe detail card, meal log row card, plan meal row card, settings primary cards.
2. **Secondary card** — warm card `#F6F5F2`, no shadow, hairline border only (optional — on white, the fill provides contrast). Used for: macro tiles, insight banners, inset stat tiles, input fields, search fields, nudge cards, "how it works" rows.
3. **Inset tile** — `#F6F5F2` fill, 8pt radius, no border. Used inside primary cards for stat tiles, closest-to-target highlight, strategy card macro preview rows.

**No card colour outside of these three.** No tinted card backgrounds except for semantic state cards (terracotta-tinted unselected paywall card, amber-tinted warning card, fits-your-day semantic tints) — and those must always use the opacity system (§1.6), never a solid fill.

### 6.2 Card variants

| Variant | Additional treatment |
|---|---|
| Selected / active state | Swap hairline border to `2pt solid #C2683E` (terracotta). Background may optionally shift to `rgba(194,104,62,0.06)` for unselected → white selected (Julienne paywall pattern). |
| Semantic: warning | `rgba(194,104,62,0.12)` fill + `1pt solid #C9892C` border. For amber alert cards. |
| Semantic: over-budget (amber) | Same as warning. Never destructive red except calorie ring. |
| Semantic: fits / success | `rgba(94,124,90,0.12)` fill + `1pt solid #5E7C5A` border. |
| Semantic: recovery / note | No fill change. `2pt left-border in #7C8466 (sage)`. White background. Used for: missed-yesterday, recovery signals, informational nudges. |
| Semantic: confidence | `rgba(194,104,62,0.10)` fill for needs-review rows. Amber left-border 3pt. |

### 6.3 Empty / null / loading states

| State | Treatment |
|---|---|
| Loading (data in flight) | Skeleton: `--card` fill rectangles at exactly the height of the content they replace, animated shimmer gradient (`--card` → `--border` → `--card`). Never a spinner on data cards. |
| Empty (no data, first use) | No card chrome. Full-width editorial prompt in Fraunces italic + Inter body + terracotta CTA. |
| Null (suppressed by honesty gate) | Renders nothing. No "no data" chrome. The absence is intentional and not labelled. |
| Error | Inline muted error text (`--secondary` sage) + tertiary "Try again" terracotta text-link. No Alert unless the action is destructive or irreversible. |

---

## 7. Chart system

Suppr's charts must preserve MacroFactor-grade accuracy, trend lines, forecasting bands, and historical context while adopting the warm palette. Beauty must not come at the cost of analytical depth.

### 7.1 Weight trend chart

**Benchmark:** MacroFactor Scale Weight, Withings Weight (Quarter), Bevel Trends Analysis.

**Required chart layers (never reduce):**

1. **Raw scatter dots** — individual weigh-in points. Filled circles, 4–5pt radius, `#1B1814` at 60% opacity (web: same). Raw data must always be visible. A smoothed line with no raw points is the Noom/Yazio false-precision anti-pattern — explicitly rejected.
2. **Trend line (EMA/MA)** — the algorithm's smoothed signal. 2pt stroke, terracotta `#C2683E`, smooth bezier. Named "Trend" in a Trend/Scale toggle (MacroFactor pattern) so users understand why it differs from their scale reading.
3. **MA envelope / confidence band** — translucent terracotta fill `rgba(194,104,62,0.12)` around the trend line, width proportional to adaptive TDEE confidence (narrow = high confidence, wide = low). Absent when confidence is null.
4. **Goal line** — horizontal dashed line in muted sage `#7C8466`, 1pt, with a pinned pill label "GOAL {value}" right-aligned inside the chart. Hidden if outside the Y-domain.
5. **Dotted projection** — dashed terracotta `#C2683E` (4/4px), soft `rgba(194,104,62,0.06)` fill below. Terminates at a filled terracotta circle with a floating label (projected date/weight). Only when adaptive confidence is medium or high.
6. **"You are here" halo** — 8pt filled terracotta dot + 16pt transparent ring at the latest entry.
7. **Staleness pill** — amber badge when `daysSinceLatest > 10`.

**Grid and axes:** Horizontal hairline gridlines `#ECEAE4`, 4 lines maximum. X-axis date ticks Inter 10–11pt `--secondary`. Y-axis weight value ticks same. Chart background always `#FFFFFF` — never gradient fill beneath the line.

**Stat-pair header (above the chart, always):**
- Left: average weight for period — Fraunces 28pt ink, caption Inter 12pt sage.
- Right: signed delta vs previous period — Inter 16pt, `--success` if toward goal, `--amber` if away. Caption Inter 12pt sage.

**Range toggle pills:** 1W / 1M / 3M / 6M / 1Y / All. Active: `#1B1814` background, white Inter 13pt semibold. Inactive with sufficient data: transparent, Inter 13pt, hairline border. Insufficient data: greyed (`--border` text), non-interactive, tooltip on long-press.

### 7.2 Daily calories chart (7-bar)

**Benchmark:** BitePal Statistics, MFP Weekly Digest.

- **Bars:** per-day total calorie intake. Colour per state: `--success` green if at/under effective target, `--amber` if over. Zero log day: `--card` fill with `--border` stroke. Today bar: full opacity; other days: 0.75 opacity.
- **Per-day target dots:** small 4pt circle in `--secondary` sage at each bar's effective calorie target height (`effectiveTargetCalories` for that day). Replaces a single flat dashed line with a per-day accurate target.
- **Base target dashed line:** `--border` dashed horizontal at the profile `daily_targets` base (without activity bonus). Secondary reference, not the primary target signal.
- **Daily avg hero:** Fraunces 24pt ink above the bars, "daily average" Inter 12pt sage caption.
- **Today marker:** small filled terracotta triangle (▲) below today's bar column.
- **Tap interaction:** navigate to Today for that date.

### 7.3 Macro adherence bars

**Benchmark:** Tonal Strength Score, Yazio Nutrition Facts.

- Track: `--border` fill, 4–6pt height, fully rounded.
- Fill: `--success` if ≤100% adherence, `--amber` if >100%. Clamps at 100% width; overflow shown as amber 3-dot indicator right of track.
- Row height: 52pt minimum.
- "Current vs goal" framing on label: "Protein: avg 142g / 150g  94%".
- `proteinOnTarget` day count sub-label below protein bar only.
- Over-budget: amber `!` icon before percentage for non-colour accessibility.

### 7.4 Stacked macro bar chart (weekly nutrition)

**Benchmark:** MacroFactor stacked macro bars, Yazio Dietary Energy.

- Three segments per bar: protein (`--primary` terracotta), fat (`--amber`), carbs (`--secondary` sage). Stacked bottom-up.
- Bar corners: 2pt radius top.
- Target reference line: dashed `--border` at target kcal height, right-edge label "Target N kcal" Inter 11pt sage.
- Empty days: 4% minimum height bar in `--card` — never "0 kcal" rendered visually.
- Range selector: 1W / 1M / 3M / 1Y — same pill pattern as weight range toggle.
- Null-safety: average header shows "—" (em-dash), not "0", when no logged days.

### 7.5 Per-day macro band tracks (Plan surface)

**Benchmark:** MacroFactor Nutrient Explorer range-band track.

- Rail: full-width, `--border` fill, 4pt height, fully rounded.
- Acceptable-range fill: `--card` with 1pt `--border` border — the band as a shaded region on the rail.
- Actual value indicator: 8pt filled circle, colour per macro (terracotta protein, sage carbs/fibre, amber fat).
- Target tick: 1pt vertical rule in `#1B1814` at 30% opacity.
- Out-of-band: rail tinted amber at 20% (below lower edge) or 40% (above upper edge).
- Labels: macro name Inter 11pt left, gram value Inter 12pt semibold right.

### 7.6 Trajectory / forecast chart

**Benchmark:** Bevel Trends Analysis, Noom projection curve (aesthetic reference only — their false-precision framing is explicitly rejected).

- Historical segment: `--secondary` sage line, 1.5pt, scatter weigh-in dots at 3pt.
- Projection segment: `--primary` terracotta dashed (4/4), `rgba(194,104,62,0.06)` fill below.
- Goal marker: horizontal dashed `--success` green hairline + "Goal" pill right-aligned.
- Endpoint: filled terracotta 5pt circle + floating Fraunces 14pt white/terracotta label.
- Honesty footnote: always visible — "Based on 7,700 kcal ≈ 1 kg. An estimate, not a promise." Inter 11pt muted — not pushed to near-invisible opacity.
- Placeholder when <5 days: "A 3-day average swings too much to forecast honestly." progress arc instead of a chart.

### 7.7 7-day stacked macro bar strip (Plan week overview)

- Same pattern as §7.4 but compact (max 48pt height per bar), 7 bars.
- Over-target day: bar overflow in amber `#C9892C` above the hairline.
- Under-target day: no colour change (being under is not a problem for the cutting-bias algorithm).
- Fat segment: amber at 60% opacity to avoid false alarm reading (fat being below target is not a warning).
- Staggered entrance animation behind `redesign_winmoment` flag: 40ms stagger per bar, 280ms total.

### 7.8 Plan adherence charts (Progress)

Covered by §7.3 (macro adherence bars) and §7.5 (band tracks). Apply the same tokens.

---

## 8. Motion system

### 8.1 Easing tokens

| Token | Value | Use |
|---|---|---|
| `ease-decel` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Sheets entering, cards appearing (motion decelerates as it arrives) |
| `ease-accel` | `cubic-bezier(0.4, 0, 1, 1)` | Sheets dismissing (motion accelerates as it leaves) |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes, colour transitions |
| `ease-spring-soft` | Spring: damping 26, stiffness 300 (mobile) / `cubic-bezier(0.34, 1.56, 0.64, 1)` (web) | Tactile confirmations (log button success, bookmark save) |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.6, 1)` | Generic transitions when other tokens don't apply |

### 8.2 Duration tokens

| Token | Duration | Use |
|---|---|---|
| `instant` | 0ms | Immediate state swap under reduced-motion |
| `fast` | 100–150ms | Tap press feedback (scale), hover transitions |
| `medium` | 200–250ms | Colour transitions, banner appear/dismiss, skeleton-to-content crossfade |
| `slow` | 300–400ms | Chart line draw-in, sheet entry/exit, cook step transition (250ms), staggered bar reveals |
| `deliberate` | 600–1200ms | Onboarding reveal count-up (1200ms), 30-day milestone arc (600ms) |

### 8.3 Reduced-motion rule

Every animation must have a `prefers-reduced-motion` fallback. The fallback rule:
- No `translate` / `scale` — opacity only (fade to/from 0).
- No `path` animation on charts — instant state swap.
- No spring physics — instant.
- Haptics are not motion — they are preserved under reduced-motion.

### 8.4 Motion inventory by surface

| Interaction | Motion | Duration | Flag |
|---|---|---|---|
| Card entrance (Today, Progress scroll) | opacity 0→1 + translateY 8→0 | 250ms ease-decel, 50ms stagger | `useEntranceAnimation` |
| Ring colour state transition (calorie ring) | colour interpolation | 300ms ease-standard | always-on |
| North-star card skip | slide-left out + fade-in next | 200ms ease-decel / 150ms fade | always-on |
| Cook step transition | page slide horizontal | 250ms ease-decel | always-on |
| Log button confirm (ordinary log) | light haptic | <100ms | `redesign_motion` |
| Win-moment overlay | fade-in | 200ms ease-decel | `redesign_winmoment` |
| Plan bar strip reveal (post-generate) | staggered fade+scale per bar | 40ms stagger, 280ms total | `redesign_winmoment` |
| 7/7 weekday dots pulse | scale 1.0→1.2→1.0 | 200ms spring | `redesign_winmoment` |
| Timer pill pulse (cook mode) | border ring pulse | 1.5s loop | always-on |
| Sheet entry (bottom sheet) | spring up from bottom | 350ms ease-spring-soft | always-on |
| Bookmark save pop | scale 1.0→1.2→1.0 | 300ms spring | always-on |
| Fits-verdict framing toggle | cross-fade text | 150ms | always-on |
| Import processing icons | slow drift upward | 3s ease-in-out loop | always-on |
| Onboarding reveal count-up | cubic ease-out 0→target | 1200ms | always-on |
| OptionCard selection (onboarding) | scale 0.97→1.0 + border flash | 120ms spring | always-on |
| Progress bar advance (onboarding) | width expand | 260ms ease-in-out | always-on |

### 8.5 Haptics

iOS only. No custom haptics on web.

| Haptic | Intensity | Trigger |
|---|---|---|
| Ordinary log confirmation | Light impact | `confirmLog()` — behind `redesign_motion` flag |
| Win-moment beat | Heavy (notification SUCCESS) | Win-moment Lottie keyframe — behind `redesign_winmoment` flag |
| Slot selection (log sheet) | Light impact | Tap slot pill |
| Move-meal settle | Light impact | `moveMealInPlan` success |
| Portion applied | Selection | Portion modal apply |
| Range picker change (Progress) | Light impact | Tab change |
| Single-select onboarding | Light impact | Card select |
| 200ms auto-advance (onboarding) | Medium impact | Auto-advance fire |
| Reveal success (onboarding) | Notification SUCCESS | Reveal step loads |
| New low (weight) | Success medium | `isNewWeightLow` |

---

## 9. Navigation system

### 9.1 Tab bar (mobile)

Four tabs only: **Today / Plan / Recipes / Progress**. Canonical. No fifth tab.

| Tab | testID | Deep-link |
|---|---|---|
| Today | `tab-today` | `?openLog=1` to open log sheet |
| Plan | `tab-plan` | `suppr:///plan` (broken — use tab-plan testID) |
| Recipes | `tab-recipes` | — |
| Progress | `tab-you` (legacy testID, stable for Maestro) | `progress-metric?metric=weight` redirects to Progress |

Active tab: terracotta `#C2683E` icon + label. Inactive: sage `#7C8466`.

Terracotta dot on Progress tab icon when weekly recap is available (§ habits spec 3.8).

### 9.2 Navigation patterns

| Pattern | Mobile | Web |
|---|---|---|
| Primary navigation | Bottom tab bar | Sidebar / top nav |
| Sub-screen push | Stack push with back chevron | Route change |
| Sheet / modal | Bottom sheet (`BottomSheet` / `Modal`) | Dialog / drawer |
| Action sheet | Native iOS action sheet | Dropdown / context menu |
| Preview card | Half-sheet (280px fixed) | Inline panel |

Bottom sheets snap at `[0.4, 0.92]` (or medium/large iOS detents) for complex content. The drag handle is always 4×32pt `--border` pill, centred, 12pt from top edge.

---

## 10. Component library

### 10.1 List and table rows

**Row anatomy:** `[leading icon 20pt] [label + subtitle stack] [trailing control or value]`

- Row min-height: 44pt (touch target).
- Leading icon: lucide-react-native, 20pt, colour matches section role (`--primary` for navigation rows, `--secondary` for preference rows, `--amber` for caution rows, destructive for danger rows).
- Primary label: Inter 15pt, `--foreground`.
- Subtitle / value: Inter 13pt, `--secondary` (muted).
- Trailing: `ChevronRight` (14pt, `--border`) for nav rows; value chip (Inter 13pt terracotta) for modal/editor rows; iOS switch for toggles; value in Inter 13pt `--secondary` right-aligned for read-only rows.
- Trailing external link: `ExternalLink` 14pt `--secondary` — signals route leaves the app.
- Hairline separator between rows: `--border`.

### 10.2 Cards

See §6 (Card system). The card pattern is the primary layout primitive — avoid `<View>` stacks that don't resolve to one of the three card backgrounds.

### 10.3 Modal and bottom sheet

- Handle: 4×32pt `--border` pill.
- Background: `#FFFFFF`.
- Top radius: `radius-xl` (20pt).
- Shadow: `0 8px 32px rgba(0,0,0,0.12)`.
- Header: Fraunces 18–22pt semibold, `--foreground`.
- Sub-label: Inter 13pt, `--secondary`.
- All modals have an accessible dismiss path (drag, tap-outside, or explicit close button ≥44pt touch target).

### 10.4 Progress indicators

**Progress bar:** `--border` track (height 3–6pt, rounded), terracotta `--primary` fill for general progress. Macro-specific fills use macro colour tokens. Over-target uses `--amber`. Width clamped at 100%; overflow shown via indicator.

**Circular ring (calorie ring):** custom arc component. Track: `--ring-bg`. Fill: 3-state colour map (§1.2 Semantic role rules). Central numeral: Fraunces display-hero.

**Fraction ring (story-gate, onboarding reveal):** arc fills terracotta, track `--card` at 40%.

**Loading skeleton:** `--card` fill rectangles at exact content height, animated shimmer gradient.

**Onboarding progress bar:** terracotta fill on `--border` track. No numeric counter visible. 260ms width expand on step advance.

### 10.5 Search field

Full-width, 48pt height, `radius-md`, `--card` background, `--border` border (0.5pt on mobile). Leading `Search` lucide icon 16pt `--secondary`. Inter 15pt placeholder in `--border` colour. On focus: `--border` upgrades to `--secondary`.

### 10.6 Filter pills

Horizontal scroll row. Inactive: `--card` bg, `--border` border, `--foreground` text Inter 13pt. Active: `--primary` (terracotta) bg, white text.

Sort pills that encode current state: "Sort: Recent ▾" with explicit label showing the current sort — never an invisible icon-only cycle.

### 10.7 Empty states

No card chrome on empty states. Full-width layout:

1. Lucide icon (sage, 24–32pt).
2. Fraunces italic 16–20pt headline (editorial register).
3. Inter 14pt body (one or two sentences max, `--secondary`).
4. Up to two CTAs: terracotta filled primary, hairline secondary.

### 10.8 Notification / toast

Inline banner at top of content area. `--card` background, `--border` hairline. Icon 16pt. Inter 14pt message. Auto-dismiss on info toasts (3s). No Alert for non-destructive feedback.

### 10.9 Paywall / upsell

- Pro badge: `rgba(194,104,62,0.10)` bg, `--primary` terracotta text, Inter 10pt semibold, `radius-xs`. Top-right corner of locked element.
- "Pro" chip never renders as a grey lock (Julienne pattern — show value, badge the gate).
- Full paywall always uses the food photography hero (`§12.2`).
- Trial CTA: `--success` green fill. Subscribe CTA: `--primary` terracotta fill.
- Auto-renew disclosure: cadence-in-days (never a rendered calendar date). `--foreground` at 45%, Inter 11pt.

### 10.10 Onboarding OptionCard

- Background: `--card` `#F6F5F2`.
- Border: `--border` hairline inactive; `1.5pt solid --primary` terracotta active.
- Active fill tint: `rgba(253,245,240,1)` (very warm white-tinted) — tactile selection feedback.
- Leading icon: lucide, 20pt, `--primary` terracotta at all times (not just selected).
- Label: Inter 600 15pt `--foreground`.
- Subtitle: Inter 400 13pt `--secondary`.
- Min-height: 64pt.
- Selection: 120ms spring 0.97→1.0 scale. 200ms auto-advance on single-select.

### 10.11 Settings row

See §10.1 (List and table rows). Settings-specific additions:
- Section eyebrow: ALL-CAPS Inter 10–11pt `--secondary` +0.08em tracking, 24pt above, 8pt below. DANGER ZONE uses `--amber`.
- Sign Out row: `LogOut` icon neutral `--foreground`, no colour accent (reversible action).
- Destructive rows (Reset, Delete): `--amber` or `--destructive` leading icon + label colour.

---

## 11. Imagery system

### 11.1 Ingredient single-subjects

**Rule: stylised-photoreal on clean white. Keep exactly as the current eggs/blueberries style.**

- Subject: single food item or small group.
- Background: pure white `#FFFFFF`.
- Style: hyperreal render with light studio-product lighting. Not watercolour, not flat illustration.
- Aspect ratio: 1:1 (square).
- Generated with: the current ingredient image generation pipeline. Do not change the style.

**Reusable generation prompt template:**
```
[FOOD ITEM], single subject, isolated on pure white background, studio lighting,
hyperreal photographic style, slight natural shadow below, food photography quality,
no background textures, sharp focus, high detail, aspect ratio 1:1
```

**Used for:** shopping list ingredient rows, verify screen ingredient rows, log search result icons, onboarding diet card thumbnails where applicable, hydration card icon.

### 11.2 Meal / finished-dish photography

**Rule: hyperrealistic editorial food photography. @thelittleplantation / @_foodstories_ aesthetic.**

- Subjects: finished, plated, cooked dishes.
- Background: contextual props — ceramic bowls, linen napkins, wooden boards, stone surfaces. Never a plain white table.
- Lighting: natural/moody window light. Never overhead studio flash. Slight under-exposure for moody quality.
- Depth of field: shallow (wide aperture aesthetic). The dish is sharp; the background is soft.
- Colour palette: warm, muted, earthy. Browns, creams, greens, ochres. Never neon or over-saturated.
- Style: artful but hyperreal — editorial magazine quality. Not flat stock photography. Not loose watercolour. Not cartoon illustration.

**Used for:** north-star recipe card hero, recipe detail hero, plan meal row thumbnails, paywall hero strip, check-in hero card overlay, empty state illustrations for planner and meal plan surfaces, recipe import success state, onboarding welcome hero.

**Reusable generation prompt template for meals:**
```
[DISH NAME], editorial food photography, natural window light, ceramic bowl/plate,
linen napkin, wooden table surface, shallow depth of field, moody warm tones,
hyperrealistic photographic style, @thelittleplantation @_foodstories_ aesthetic,
no artificial studio lighting, artful composition, slight bokeh background,
warm earthy colour palette, high detail, professional food photography
```

**Important:** Instagram references (@thelittleplantation, @_foodstories_) are aesthetic references only. Do not reproduce their actual photographs. Use the style as a generation prompt target.

### 11.3 What is never used

- Flat stock photography (white tablecloth + overhead commercial style).
- Loose or painterly watercolour for finished dishes.
- Cartoon or illustrated food for any in-app surface.
- Clip art or generic food icons as substitutes for photography.
- Placeholder broken-image states — always provide a warm fallback (gradient, monogram, or styled placeholder).

### 11.4 Fallback hierarchy

When a recipe or meal has no image:

1. If a YouTube thumbnail exists: `{videoId}/maxresdefault.jpg` → `hqdefault.jpg`.
2. Warm gradient fallback: sage-to-card gradient (`#7C8466` → `#F6F5F2`) with a small pan/pot icon in sage `#7C8466` centred.
3. Terracotta monogram tile: recipe initial letter in Fraunces white on `#C2683E` at 60% opacity.

Never a broken image icon. Never a grey neutral placeholder.

---

## 12. Voice and copy rules

### 12.1 Tone

**Calm warm coach.** Encouraging, grounded in real numbers, never shaming or bubbly.

- **Grounded:** always cite the actual number. "You averaged 1,840 kcal" not "You're doing great!"
- **Hedged where honest:** "~N kcal", "approximately", "estimated", "may", "typically" — all intentional.
- **Never shaming:** no "you missed", "you failed", "broke your streak". Past tense for past events.
- **Never gamified:** no 🔥, no "crushed it!", no level-up language, no "Don't break your streak!"
- **Past tense for past:** "You logged 6 days last week." Present tense for live data: "You're at 1,200 kcal today."

### 12.2 Forbidden phrases (from `FORBIDDEN_TODAY_PHRASES`)

- "below maintenance / TDEE"
- "under/over budget" (use "remaining" / "over your target")
- "you went over"
- "don't break your streak"
- "streak lost", "broke your streak"
- "Today's meals" (use slot names: Breakfast, Lunch, Dinner, Snacks)
- Any phrase with `!` in coaching copy
- "crushed it", "amazing", "incredible", "powerful"
- 🔥 glyph in streak or motivation context
- "Level up", "power up", "bonus unlocked"

### 12.3 Trust posture (always applies)

- Nutrition is **always estimated**. "Estimated N kcal", "approximately", "based on available data."
- **No health claims.** Suppr is a tool, not a clinician. No "eat this to feel better."
- **Confidence is visible.** Low-confidence matches must be flagged or rejected. Never silently fill numbers.
- **The `~` tilde prefix** is mandatory on all estimated kcal values in the Plan surface and in the check-in.
- **Never fabricate a delta** — "+0.0 kg" for weight with insufficient data is not shown. Em-dash or suppress.

---

## 13. Accessibility standards

All components must meet:

- **Minimum 4.5:1 contrast** for all text on its background (WCAG AA). Exception: large text (>18pt or >14pt bold) requires only 3:1.
- **Minimum 3:1 for non-text UI elements** (icons, progress bars, chart lines, borders that convey information).
- **Amber `#C9892C` on white `#FFFFFF`:** ~3.5:1 — use amber only for non-text indicators (bars, dots, badge backgrounds). If amber appears as text, switch to `--foreground` ink on an amber tinted background.
- **Success green `#5E7C5A` on white `#FFFFFF`:** ~3.8:1 — passes as large text (≥18pt) and as a graphical element (ring fill, bar fill). For small body text, verify in the contrast-audit spec.
- **Terracotta `#C2683E` on white `#FFFFFF`:** ~3.5:1 — use for large text (≥18pt) or icon/non-text elements. Do not use as small body text on white.
- **Minimum 44×44pt touch target** on all interactive elements.
- **All gestures have a tap-accessible equivalent.** Long-press is never the only path to a feature.
- **`prefers-reduced-motion`:** all animations reduce to opacity-only (no translate, no spring). Charts: instant state swap.
- **Lucide icons carry `accessibilityLabel`** props. Never leave an icon without a label.
- **Colour is never the sole signal** — over-budget states have the amber colour plus a text indicator or icon.
- Screen reader announcement patterns per component are specified in individual surface specs.

---

## 14. Cross-platform parity rules

See `docs/.claude/agents/_project-context.md` §Cross-platform parity rules for the full list. Design system additions:

- Every visual token above must be implemented identically on both platforms. No platform-specific hex values except:
  - Today dark surface tone: mobile `#0a0a0f`, web `#101014` — intentional, documented carve-out.
- Fraunces must be loaded on both platforms:
  - Web: via `next/font` with `display: 'swap'` and Georgia sans-serif fallback.
  - Mobile: via `expo-font` with system serif fallback. Fallback must be verified in a sim capture before push.
- Feature-flag naming is identical across platforms. `isFeatureEnabled("flag-name")` on web; same string on mobile.
- Visual changes that ship on one platform must ship on the other in the same commit, unless the change is on the documented carve-out list.

---

## 15. Feature flag requirements

All visual or structural changes described in this design system ship behind a feature flag. See `CLAUDE.md` feature-flags section for the non-negotiable rule.

Relevant existing flags:
- `redesign_winmoment` — win-moment overlay, weekly check-in as inline card, plan bar reveal, 7/7 dot pulse.
- `redesign_motion` — ordinary log confirm haptic.
- `today-status-pills` (ENG-753) — hero status pills.
- `progress_redesign_v2` — Progress tab visual/structural changes.
- `habits_redesign_v2` — streak pip, missed-yesterday, check-in hero card, digest headline hierarchy.
- `weight_surface_redesign` — weight chart Trend/Scale toggle, multi-period table, source chips.
- Surface-specific flags: `paywall-card-v2`, `paywall-hero-v1`, `paywall-timeline-v2`, `paywall-matrix-v1`, `settings-membership-v2`, `recipe-import-redesign`, `progress_share_card`, `progress_tdee_windows`.

New surface-level redesign flags follow the pattern `{surface}-redesign-v{N}`. The old path stays alive in the `else` branch until the flag holds 100% for two weeks with no regression.

---

*This file is the single source of truth for the Suppr warm-coaching redesign design system. Per-surface specs in `docs/ux/redesign/*.md` apply this system; they do not override it. When a per-surface spec specifies a token that conflicts with this file, this file wins and the surface spec must be updated.*
