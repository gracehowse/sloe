# Handoff: Sloe — Calorie & Meal-Planning App (Mobile + Web)

## Overview
Sloe is a calm, premium nutrition app for people who want to "cook what they love and hit
their goals anyway." It covers daily food logging, a weekly meal plan, honest progress
trends, a recipe cookbook, and discovery — across **two form factors**:

- **Mobile** — a single-scroll iOS app (tab bar + center FAB).
- **Web** — a desktop dashboard (left sidebar nav + two-column content grid).

Both platforms share the same data model, the same brand system, and the same core
visual components. They intentionally differ only in *layout* (phone scroll vs. desktop
grid), not in information, cards, or numbers.

---

## About the Design Files
The files in this bundle are **design references created in HTML** — a high-fidelity,
interactive prototype that demonstrates the intended look, copy, and behavior. **They are
not production code to copy directly.** The prototype is one large React-via-in-browser-Babel
file with inline mock data and no build step or backend.

Your task is to **recreate these designs in the target codebase's existing environment**
(React, Vue, SwiftUI, native iOS, etc.) using its established components, state, and data
layers. If no app environment exists yet, choose the most appropriate framework for the
project and implement the designs there. Treat the HTML as the source of truth for visual
spec and interaction intent; wire it to real data and navigation in your stack.

`Sloe-App.html` is the **canonical, self-contained master** — open it in a browser to
explore every screen. Use the in-app **Tweaks** panel (floating button, bottom-right) to
switch Device (Mobile/Web), Theme (Light/Dark), Calm mode, Macros style, the demo "Day"
scenario, the Progress "new user" demo state, and to jump directly to any screen via the
**Screens** tab.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, motion, and copy are
all specified below and embedded in the HTML. Recreate the UI faithfully using your
codebase's libraries and patterns; pull exact values from the token tables here or from the
`:root` block at the top of `Sloe-App.html`.

---

## Design Tokens
All tokens are defined in the `:root` block at the top of `Sloe-App.html`. Light theme is
default; a full Dark theme palette is defined under `.dark, [data-theme="dark"]`.

### Typography
| Role | Font | Usage |
|---|---|---|
| Wordmark / logo ONLY | **Fraunces** (serif) | The "sloe" wordmark and brand splash only — never body |
| In-app serif | **Newsreader** | Headlines, screen titles, recipe/meal names, hero numerals |
| Data / UI sans | **Inter** | Body, labels, dense UI, buttons, captions, all numbers/data |

> Font system is deliberately locked to these three. Loaded from Google Fonts.

**Type scale** (base 15px): `xs 11px` · `sm 13px` · `base 15px` · `lg 18px` · `xl 22px` ·
`2xl 24px` · `3xl 28px` · `display 36px` (hero numbers, tabular).

**Weights:** regular 400 · medium 500 · semibold 600 · bold 700 · heavy 800 (hero numbers).
**Line heights:** tight 1.2 · heading 1.3 · body 1.5 · relaxed 1.6.
**Letter spacing:** display −0.03em · heading −0.02em · wide +0.1em (uppercase overlines).

Numbers use tabular figures (`font-variant-numeric: tabular-nums`, class `.tnum`).
Uppercase grey "overline" labels (class `.overline`): Inter, 11px, 600, color `--fg-muted`,
+0.1em tracking, uppercase — this is the standard card-section heading.

### Color — Light (default)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#ffffff` | App canvas (pure white in-product) |
| `--bg-marketing` | `#fbf8f3` | Oat — marketing/landing/paywall ONLY |
| `--bg-secondary` | `#faf9f7` | Faint warm wash for grouped sections |
| `--card` | `#ffffff` | Card surface |
| `--border` | `#e8e2ec` | Hairline (a whisper of plum) |
| `--muted` | `#edeaf1` | Frost Mist fill |
| `--fg` | `#221b26` | Ink — body text |
| `--fg-secondary` | `#6a6072` | Secondary text |
| `--fg-tertiary` / `--fg-muted` | `#9b93a3` | Captions, numerals, placeholder, overlines |
| `--primary` | `#3b2a4d` | Sloe plum — wordmark, primary buttons, mark |
| `--primary-deep` | `#241733` | Sloe Deep — dark surfaces |
| `--primary-active` | `#6a4b7a` | Damson — active/pressed, gradient stop |
| `--accent-frost` | `#c9c2d6` | The "bloom" — soft dividers, inactive ring track |
| `--accent-frost-mist` | `#edeaf1` | Cool wash surface |
| `--clay` | `#c8794e` | Warm CTA / Pro pill / encouragement accent |
| `--clay-soft` | `#f4e2d2` | Peach tint surface |
| `--success` | `#5e7c5a` | Sage — under budget / on track |
| `--success-soft` | `#e3eadd` | |
| `--warning` | `#cf6e3c` | Burnt orange — macro over (never the ring) |
| `--destructive` | `#c0533f` | Ring over-budget only; errors |

**Macro colors (fixed across all surfaces, never reassigned):**
protein `#3b2a4d` (plum) · carbs `#c9892c` (amber) · fat `#b25d7a` (berry rose) ·
fiber `#5e7c5a` (sage) · sugar `#6a4b7a` (damson) · sodium `#c8794e` (clay) ·
water `#5a8a99` (muted teal). Each has a `-soft` 12%-alpha variant.

**Brand gradient** (hero/paywall/onboarding/empty ring/app-icon ONLY — never core chrome):
`linear-gradient(135deg, #6a4b7a 0%, #3b2a4d 70%, #c9c2d6 140%)`.

**Daily ring:** empty = brand gradient/frost bloom; under-budget = Sage gradient
(`#4d7a50→#93c08c`); over = Destructive→warm (`#c0533f→#e08a5f`). Track = Frost Mist `#edeaf1`.

### Radius
base 6 · sm 4 · md 8 (chips/badges) · lg 12 (inputs/buttons) · card 16 ·
**card-lg 24 (canonical resting card)** · xl 20 (sheets) · full 9999 (pills).

### Spacing — 4px grid
xs 4 · sm 8 · dense 12 · **md 16 (card padding, primary rhythm)** · lg 20 · xl 24 ·
xxl 32 · xxxl 40.

### Shadow
`card` `0 1px 3px rgba(36,23,51,.05)` · `md` `0 2px 8px …` · `lg` `0 8px 24px …` ·
`elevated` `0 4px 12px rgba(36,23,51,.10)`. White-ground app prefers the hairline border
+ light `card` lift over heavy shadows.

### Motion
Primary easing `--ease: cubic-bezier(0.22,1,0.36,1)` (snappy in, gentle out). Spring
`cubic-bezier(.34,1.56,.64,1)` for the FAB / tabs / add-food. Durations: sm 120ms ·
base 150ms · md 250ms · lg 350ms. Honor `prefers-reduced-motion`.

---

## Navigation Shells

### Mobile
- Fixed top app bar: "sloe" wordmark (Fraunces) left; calendar + notifications + avatar right.
- Bottom **tab bar**: Today · Plan · **[+ FAB, center, plum circle]** · Cook · Progress.
- Content is a single vertical scroll (`.screen-scroll`), 390px-class device frame, scales to viewport.
- Overlays (log, recipe, settings, detail screens) push or sheet over the tab content.

### Web
- Fixed left **sidebar** (~280px): wordmark, a primary "Log food" button, then nav —
  Today · Plan · Progress · Cookbook · Discover, and an Account group — Profile ·
  Settings · Notifications.
- Right content area is a **two-column grid** (`.w-grid` → `.w-col`) on a faint grey ground.
- Modals (`WebModal`) for flows like Billing, Import, Cook mode.

---

## Screens / Views

> The HTML is the exact spec for every measurement. Below is the structure, purpose, and
> the cards each screen must contain so **mobile and web stay at content parity**.

### Today
Purpose: the day at a glance — how many calories left, what's logged, what to eat next.
Shared cards/components on BOTH platforms:
- **Daily ring** (`DailyRing` / `RingHero`) — big tabular numeral ("kcal left"/"over"),
  Sage when under budget, Destructive when over, brand gradient when empty. Watch-dial
  graduated ticks; animated draw on mount.
- **Macros** (`MacroSection`) — switchable layout: **Tiles** (2×2, default), **Bars**
  (slim 5px horizontal tracks, serif-free values), **Rings** (three small dial rings).
  Protein/Carbs/Fat/Fibre with fixed macro colors.
- **Activity & energy** section — three cards, each titled with the uppercase grey overline:
  1. **Steps & activity** — Steps vs 10,000 goal with progress bar; divider; Active energy (kcal).
  2. **Net energy** — hero deficit/surplus numeral + DEFICIT/MAINTENANCE/SURPLUS pill, a
     diverging slider, and a Burned / Eaten / Maintenance stat row, then "calorie goal today".
  3. **Burn so far** — tappable row (flame, "N kcal burned so far", Active/Resting), → Activity summary.
  4. **7-day rolling summary** — avg daily deficit / weekly deficit / projected weekly loss.
- **Today's meals** by slot (Breakfast/Lunch/Dinner/Snack), **Quick add** chips, hydration,
  "what to eat next" recipe, and deeper rows (all nutrients, complete day).

**Burn model (must match on both platforms):**
`resting = round(1430 × 0.66 /10)×10` (≈ time-of-day basal) · `active = round(steps × 0.05) + Σ workout kcal` ·
`burnedSoFar = resting + active` · `maintenance = goal + 270` (TDEE) ·
`netDeficit = burnedSoFar − eaten`. Net energy is **deficit** when burn > eaten.

### Plan
Purpose: a week of meals balanced to the user's targets.
- Header with verdict ("Hits your targets 5 of 7 days"), Adjust / Templates / Generate week.
- **Week-health strip** (per-day status) + week stats (dinners, avg kcal, avg protein, est. shop).
- Household banner (when enabled): who's eating, servings, scaling note.
- **Meal filter** chips: All meals / Breakfast / Lunch / Dinner / Snack. "All" shows each day
  (Mon–Sun) with **all four slots** and a per-day **calorie band** (day total / 1,830 goal,
  Sage under, Burnt-orange over); a specific filter shows that meal **across the week**
  ("Lunch · this week — N of 7 planned").
- Right column: **Smart suggestions** and **Shopping list** (by aisle, check items, → grocery).
- **Empty state** ("No plan for this week yet" → Generate my week / Import a plan / Build it
  myself) and **Generating state** (spinner + skeletons) exist on both platforms.
- The week meal data is a single shared source (`window.SloePlanWeek`) so both render the
  exact same meals.

### Progress — ENG-1525 hierarchy (ratified 2026-07-16)
Purpose: honest trends — "wins, not streaks." A **story, not a dashboard**: five
prioritised sections replace the old ~13 equal-weight cards. Global period control
**D / W / M / 6M / Y** drives §1's chart window and §3's averaging window; **§2 always
pins to the current week**.

1. **Trajectory (THE hero — the screen's only tinted card).** `--hero-tint` ground +
   `--hero-tint-border` hairline, radius `card-lg 24`, no shadow. 40px serif weight
   numeral · direction-aware rate line (sage toward goal, amber away — derived from
   `sign(rate) × sign(goal delta)`, never the raw sign) · smoothed trend line
   (`--primary`) with ONE emphasised endpoint dot · dashed goal line labelled at the
   axis + faint sage target band · dashed projection continuation · axis labels come
   from the chart window (no fake centered month string). Projection leads with
   **distance** ("4.4 kg to go"), hedges the date ("at this pace ~early October — an
   estimate, not a promise"). Trend/Scale toggle retained. **Goal-conditional:** Calm /
   weight-opt-out users get NO trajectory hero — §2 promotes into the hero slot.
2. **This week (pinned to the current week).** Demoted, reconciled headline ("5 of 7
   days in your calorie range · macro adherence averaged 79%") · quiet **Week score**
   chip (weekly nutrition-quality composite, ENG-992) · Mon–Sun calorie bars (today
   boxed; sage under / amber over — **never red**) with dashed goal reference · macro
   label·value·bar rows · streak microrow (flame + "12-day logging streak · 2 freezes
   available" — freezes reachable via the recap, per delta 7).
3. **Energy.** The deficit is the ONE number; the equation is support and reads
   **maintenance − intake = deficit** (arithmetic correct). Direction-aware verdict
   ("on plan for your cut"). Confidence = bare sage overline, not a pill. Subordinate
   expenditure sparkline with a confidence band that widens as confidence drops.
   "How maintenance works" collapsible retained.
4. **Body composition.** User-owned readings (body fat, lean mass from the smart
   scale) are **always free** — only the 90-day trend chart + analysis is the Pro
   layer (blurred teaser + lock + ghost CTA). Never mask data the user already owns.
5. **Your week.** ONE slimmed recap: serif verdict sentence + one net-new texture
   line + ghost Share. (The old duplicate story-card is gone.)

**Empty / new-user state:** the hero slot keeps the trajectory grammar — tinted card,
"No weigh-ins yet", and a **filled "Log your first weigh-in" CTA (the screen's one
filled CTA)**; "This week" shows "A little more to go". Body-neutral (Calm) mode hides
numeric aims throughout and promotes §2 (serif verdict, trends-only sage bars).

### Cook / Cookbook (Recipes)
Editorial recipe hero, your cookbook grid, recipe detail (ingredients as list or tiles,
steps, servings stepper, batch cook, cook mode with working timers). Recipe photos in
`/assets`; no-photo recipes fall back to plum-family tints.

### Discover
Featured editorial recipe, trending grid, cuisine cards, creators. Photo-led.

### Profile / Settings
Profile: avatar, created recipes. Settings: profile row, **Sloe Pro** band → paywall, and
grouped rows — Account (Goals & targets, Body details, Apple Health, Household, Billing),
Preferences (Dietary & allergies, Units & appearance, Notifications, Nutrition sources),
Your data (Import, Export, Delete account), Sign out. Billing has active / past-due / ending
states.

### Onboarding
Brand splash ("Cook what you love. Hit your goals anyway."), then a stepped flow (goal,
about-you, activity, diet, allergens, motivation) computing an honest daily target. Separate
mobile and web onboarding components.

---

## Interactions & Behavior
- **Tab / sidebar nav** swaps the main screen; overlays push (mobile) or open as modals (web).
- **Daily ring** animates its arc draw on mount; numerals count up.
- **Macros** layout is user-switchable (Tiles/Bars/Rings) — persist the choice.
- **Plan**: lock a meal (keeps it through Regenerate); Generate triggers the generating→ready
  transition; meal-filter switches between per-day and across-week views.
- **Loading**: import/photo/voice flows have intro → capturing → analysing → review phases;
  Plan has a generating skeleton state.
- **Empty states**: Plan (no plan) and Progress (new user) on both platforms.
- **Calm / body-neutral mode** (a global toggle) hides calorie aims and over/under deltas and
  shows trends-only progress — keep this path intact; it's an ED-recovery-safe affordance.
- Toasts for confirmations; respect `prefers-reduced-motion`.

## State Management
Global app state (see `App()` in the HTML): `device` (mobile/web), `theme`, `accent` (plum),
`tab`, `onboarded`, navigation `stack` / web `webModal`, `planState` (`ready`|`empty`|`generating`),
`progressState` (`full`|`empty`), `scenario` (the demo "Day": fresh/breakfast/midday/over/
nohealth/offline), macro layout, ring style, `calm` (body-neutral), `netCarbs`, household.
Per-screen local state handles filters, toggles, locked meals, etc. In production these map
to real user data, the day's logged entries, the generated plan, and HealthKit/Health
Connect activity.

## Assets
- **Fonts:** Fraunces, Newsreader, Inter — Google Fonts (swap for your bundled equivalents).
- **Icons:** a single inline-SVG icon set (the `Ic` component, ~1.75px stroke, rounded caps).
  Reproduce with your icon library at matching weight/size.
- **Recipe photos:** `/assets/*.png` (frittata, meatballs-orzo, oats, porridge, potato-salad).
  No-photo recipes use plum-family tint placeholders. A `hero` image is referenced as a
  fallback background (`assets/hero.jpg`) — supply your own food photography.
- No third-party brand assets are used; "sloe" is the product's own wordmark.

## Screenshots
Reference captures live in `/screenshots` (mobile = single-scroll phone; web = desktop
dashboard). They show the same data at content parity across form factors:
- `mobile-today.png` / `web-today.png` — Today (ring, macros, activity & energy)
- `mobile-plan.png` / `web-plan.png` — Plan (week, meal filter, per-day calorie band)
- `mobile-progress.png` / `web-progress.png` — Progress (trends, energy balance, adherence)

These are static references — the live `Sloe-App.html` is the source of truth for exact
spacing and interaction.

## Files
- `Sloe-App.html` — the canonical, self-contained master prototype (all screens, mobile +
  web, light + dark, all flows). **Start here.** Open in a browser; use the Tweaks panel
  (bottom-right) to switch device/theme and jump to any screen.
- `assets/` — recipe photography used by the prototype.
- `screenshots/` — reference captures of the key screens (mobile + web).

> Other `redesign/v3/*.html` and `proto-*.jsx/.css` files in the project are earlier or
> modular explorations; `Sloe-App.html` supersedes them and is the agreed source of truth.

---

## Changelog — 2026-07-16 · backlog end-state deltas

The prototype now shows the app **as it will look once the open design backlog is
executed**. Each delta maps to a Linear ticket; conformance (ENG-1247) should treat
these as the target, not as app drift.

- **ENG-1525 — Progress hierarchy v1** (ratified; building behind
  `progress_hierarchy_v1`): full 5-section rebuild of Progress on both platforms —
  see the Progress section above. New tokens `--hero-tint` / `--hero-tint-border`
  (light + dark) added to `:root`; the hero uses `--radius-card-lg` (24). The old
  ~13-card stack and its now-dead CSS (`prog-narr`, `prog-statrow`, `prog-balance`,
  `prog-win`, `prog-adh-big`, Apple-Health rows, `prog-proj`, old `prog-hero*`,
  `prog-legend`) were removed.
- **ENG-992 — Week score**: quiet weekly nutrition-quality chip in §2 This week
  (hidden in Calm mode). Naming is placeholder — composite spec is the ticket's scope.
- **ENG-1518 — Barcode manual path**: "Enter barcode or details manually" affordance
  under the scan frame, visible before any failed scan (also the design answer to the
  hard-denied-camera dead-end).
- **ENG-1535 — Seeded creators labelled**: Discover creator rail retitled
  "Collections curated by the Sloe kitchen"; every seeded profile carries a
  "Sloe Kitchen" caption (option (a) of the ticket — honest house-curation labelling).
- **ENG-1274 — Est. cost per serving (Pro)**: "≈ £1.60 / serving" + clay PRO pill in
  the recipe-detail hero meta row.
- Housekeeping: `.link` / `.w-ch-more` gained proper button resets (they rendered
  with browser default chrome); web week-bars target label moved left to stop
  colliding with Sunday's value.

> `screenshots/mobile-progress.png` and `screenshots/web-progress.png` predate the
> ENG-1525 hierarchy — the live `Sloe-App.html` is the source of truth for Progress
> until those captures are regenerated.
