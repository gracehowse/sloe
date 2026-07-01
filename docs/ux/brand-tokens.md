# Brand colour tokens (web + mobile)

Single reference for **accent roles** so colours do not drift between the Next.js web app and Expo mobile app.

**Sloe palette (2026-06-03):** Phase 0 token-foundation re-skin —
`docs/ux/redesign/phase-0-token-foundation-dossier.md`.

> **Note:** Phase 0 (2026-06-03) re-skinned the whole app from the blue
> "8-slot lock" to the warm **Sloe** family — **token NAMES are unchanged,
> only the hex VALUES moved**. The six Sloe hues, by role: **plum `#3B2A4D`**
> (chrome / brand / calorie ring), **clay `#C8794E`** (primary / CTA / carbs),
> **sage `#5E7C5A`** (success), **amber `#C9892C`** (warning / fat), **damson
> `#6A4B7A`** (win / celebration), **teal `#4A7878`** (fiber / water / snack).
> The smaller palette is intentional (dossier D-4) — distinguishability is by
> icon + label + position, not 8 saturated hues. Any remaining blue
> (`#588CE4`) or magenta (`#DF5EBC`) references below the marketing-gradient
> note are stale and should be read against `src/styles/theme.css`.

## Accent palette

Many accents carry a darkened `*-solid` / `*Solid` variant for text/icon use on
light surfaces (the base fill clears the 3:1 graphical bar but not 4.5:1 text);
see `src/styles/theme.css` / `apps/mobile/constants/theme.ts` for the computed
contrast ratios.

| Role | Hex (canonical) | Mobile token | Web CSS variable | Usage |
|------|-----------------|-------------|-----------------|--------|
| **Primary (content CTA)** | `#C8794E` (light) / `#D58A5E` (dark) | `Accent.primary` / `Colors.*.tint` | `--accent-primary` / `--primary` | Inline content CTAs (Save, Log Dinner, Start Cooking), selected states, links, tab active label/icon — Sloe clay |
| **Primary solid (text/icon)** | `#A0552E` (light) / `#C8794E` (dark) | `Accent.primarySolid` | `--accent-primary-solid` | Clay as small text / icon / link on light (AA-safe) |
| **Primary light** | `#D58A5E` | `Accent.primaryLight` | n/a | Dark-mode primary, selected tabs |
| **Nav / brand primary** | `#3B2A4D` (light) / `#815E91` (dark) | `Colors.*.navPrimary` | `--sidebar-primary` (web mirror) | Nav + brand chrome — the centre Log **FAB** (mobile), wordmark, page titles. Plum. Distinct from clay `tint` (locked Grace 2026-06-04: plum = nav/brand, clay = content CTAs). |
| **Brand heading ink (text)** | `#3B2A4D` (light) / `#A98CB8` (dark) | `MacroColors.calories` (mobile, light only — see ENG-886) | `--foreground-brand` (`text-foreground-brand`) | Newsreader **card titles** ("Steps & activity", "Hydration", "Planned", …) — the plum hue as TEXT (AA-safe: 11.9:1 light, 5.4:1 dark). The text variant of the plum/nav hue; dark uses the lighter `#A98CB8` lift, NOT the `#815E91` fill-lift (only 2.99:1 as text). Web card titles previously (wrongly) used clay `text-primary` — ENG-885. |
| **Body ink** | `#221B26` (light) / `#F5F3F4` (dark) | `Colors.*.text` | `--foreground` | Aubergine ink — headlines and body copy, not button fill |
| **brandBlue alias** | `#C8794E` | `Accent.brandBlue` | n/a | Legacy alias — now clay; same as `Accent.primary` |
| **Success** | `#5E7C5A` (light) / `#83A57E` (dark) | `Accent.success` | `--accent-success` / `--success` | Confirmations, calorie-ring at/under-target signal, positive states — Sloe sage |
| **Success solid (text)** | `#466046` (light) / `#83A57E` (dark) | `Accent.successSolid` / `Accent.successSolidDark` | `--accent-success-solid` | Sage as small text — the light `#466046` collapses to 2.43:1 on a dark card, so the dark scheme lifts to `#83A57E` (read scheme-resolved via `useAccent()`). The "added" Badge label + Today streak headline use this (ENG-1275) |
| **Warning** | `#C9892C` (light) / `#D6A24A` (dark) | `Accent.warning` | `--accent-warning` / `--warning` | Approaching limits — Sloe amber. **Not** over-budget (that is red, D-2); **not** activity bonus (that owns honey) |
| **Warning solid (text)** | `#956619` | `Accent.warningSolid` | `--accent-warning-solid` | Amber as small text on light (AA-safe) |
| **Carbs** | `#C8794E` (light) / `#D58A5E` (dark) | `Accent.carbs` | `--macro-carbs` | Carbs (+ sugar) macro track — Sloe clay (same hue family as primary) |
| **Activity** | `#D6A24A` (light) / `#E0B25E` (dark) | `Accent.activity` | `--activity` | Activity / burn / earned-bonus — Sloe honey, distinct from amber warning + red over-budget. **FILL-ONLY** — honey is 2.3:1 even on white, so it can never be text (any size) |
| **Activity solid (text)** | `#8A5A14` (light) / `#E0B25E` (dark) | `Accent.activitySolid` / `Accent.activitySolidDark` | `--activity-solid` (`text-activity-solid`) | Deep honey for burn-detail "Bonus earned" value + workout-kcal TEXT (AA-safe: 4.9:1 on the honey tint, 5.9:1 on white). Added ENG-885 |
| **Fiber** | `#4A7878` (light) / `#6FA3A3` (dark) | `Accent.fiber` | `--macro-fiber` | Fibre macro — Sloe teal |
| **Carbs light** | `#D58A5E` | `Accent.carbsLight` | `--macro-carbs` (dark) | Dark-mode carbs tint |
| **Destructive** | `#C0533F` (light) / `#DC6B55` (dark) | `Accent.destructive` | `--accent-destructive` / `--destructive` | Errors, dangerous actions, **and over-budget** (D-2) — Sloe warm brick |
| **Destructive solid (text)** | `#9E3F2E` | `Accent.destructiveSolid` | `--accent-destructive-solid` | Brick as small text on light (AA-safe) |
| **Damson / win** | `#6A4B7A` (light) / `#9A7BAA` (dark) | `Accent.purple` / `Accent.win` | `--accent-win` / `--accent-info` | Streaks, milestones, Pro accent, dinner slot, caffeine, win landmark — Sloe damson |
| **Teal (alias)** | `#4A7878` | `Accent.cyan` / `SlotColors.snack` | `--macro-water` / `--slot-snack` | Water tracking, **Snacks meal-slot tint** — Sloe teal (legacy `cyan` alias) |
| **Cyan/teal solid (text)** | `#3C5F6B` (light) / `#7FAAB8` (dark) | `Accent.cyanSolid` / `Accent.cyanSolidDark` | `--macro-water-solid` | Teal as small TEXT — the raw `cyan` #4A7878 is only 4.14:1 (light) / 2.98:1 (dark) on its own 14% tint (AA FAIL). The freeze/info Badge label + Today freeze-earned "Got it" ghost-link use this, scheme-resolved via `useAccent()` (ENG-1275, mirrors web `--macro-water-solid`) |
| **Amber (alias)** | `#C9892C` | `Accent.orange` / `Accent.magenta` | `--macro-sodium` / `--macro-fat` | Sodium + fat macro — Sloe amber (legacy `orange` / `magenta` aliases) |
| **Info** | `#6A4B7A` (light) / `#9A7BAA` (dark) | `Accent.info` | `--accent-info` | Informational accents — Sloe damson |

## Macro colours

Fixed across all screens. Never hardcode — always reference `MacroColors` (mobile) or `--macro-*` (web).

| Macro | Colour | Hex (light / dark) | Web CSS variable |
|-------|--------|--------------------|------------------|
| Calories | Plum (the calorie ring) | `#3B2A4D` / `#815E91` | `--macro-calories` |
| Protein | Olive-sage | `#7C8466` / `#A2AE88` | `--macro-protein` |
| Carbs | Clay | `#C8794E` / `#D58A5E` | `--macro-carbs` |
| Fat | Amber | `#C9892C` / `#D6A24A` | `--macro-fat` |
| Fiber | Teal | `#4A7878` / `#6FA3A3` | `--macro-fiber` (distinct from calories plum) |
| Sugar | Clay (follows carbs) | `#C8794E` / `#D58A5E` | `--macro-sugar` |
| Sodium | Amber (follows fat) | `#C9892C` / `#D6A24A` | `--macro-sodium` |
| Water | Teal | `#4A7878` / `#6FA3A3` | `--macro-water` |

## Meal-slot colours

Per-slot tint applied to the slot-header icon wrapper on Today's meal section and the slot-header column on Plan. **Never use macro tokens here** — slot tints are a separate role from macro tints, and reusing one for the other creates a 1:1 colour collision (the Snacks-slot vs Fat-macro bug fixed 2026-05-01, ui-critic P2 #10).

| Slot | Light | Dark | Mobile token | Web CSS variable |
|------|-------|------|--------------|------------------|
| Breakfast | `#C9892C` (amber) | `#D6A24A` | `SlotColors.breakfast` | `--slot-breakfast` |
| Lunch | `#5E7C5A` (sage) | `#83A57E` | `SlotColors.lunch` | `--slot-lunch` |
| Dinner | `#6A4B7A` (damson) | `#9A7BAA` | `SlotColors.dinner` | `--slot-dinner` |
| Snack(s) | `#4A7878` (teal) | `#6FA3A3` | `SlotColors.snack` | `--slot-snack` |

Each slot also exposes a `--slot-<name>-soft` variant (`12` alpha suffix in light, `15` in dark) for tinted backgrounds (chip pills, icon wrappers).

> **Breakfast (amber) shares the warning + fat hue family.** They live in
> different namespaces — `--slot-breakfast` (meal slot) vs `--warning` /
> `--macro-fat` — and the slot is differentiated by its breakfast icon +
> position, so the shared amber is not a collision. Snack (teal) stays
> collision-free with every macro hue (dossier D-4).

_Sloe Phase 0 (2026-06-03) remapped slots to amber / sage / damson / teal. The
original 2026-05-01 fix (ui-critic P2 #10) that moved `Snacks` off
`MacroColors.fat` still holds — snack is its own `SlotColors.snack` (teal),
never a macro token. Source-grep + render parity tests live at
`apps/mobile/tests/unit/slotColorTokensParity.test.ts` and
`apps/mobile/tests/unit/todayMealsSectionSlotColors.test.tsx`._

## Stimulant tracker colours

Used exclusively by the Hydration & Stimulants card (Batch 2.5). Not macro roles — caffeine has its own violet tone; alcohol uses an amber that rhymes with the warning accent because "approaching weekly limit" is the same semantic category.

| Stimulant | Colour | Hex (light / dark) | Mobile token | Web CSS variable |
|-----------|--------|--------------------|--------------|-----------------|
| Caffeine | Damson | `#6A4B7A` / `#9A7BAA` | `StimulantColors.caffeine` | `--stimulant-caffeine` |
| Alcohol | Amber | `#C9892C` / `#D6A24A` | `StimulantColors.alcohol` | `--stimulant-alcohol` |
| Alcohol solid (text) | Warm clay / honey | `#9C5228` / `#D6A24A` | `Accent.alcoholSolid` / `Accent.alcoholSolidDark` | `--stimulant-alcohol-solid` |

The amber alcohol FILL is only 2.61:1 as TEXT on the quick-add chip's `backgroundSecondary` surface in light (AA FAIL) — the alcohol chip LABEL inks with the scheme-resolved `alcoholSolid` (warm clay `#9C5228` light, 5.07:1 on the chip surface; bright honey `#D6A24A` dark, 7.82:1) via `useAccent()`. A touch warmer than `warningSolid` so alcohol ≠ generic warning. The raw amber stays the fill/dot/bar. (ENG-1275, mobile twin of the web `--stimulant-alcohol-solid` ENG-1266 fix.)

_Added 2026-04-18 (audit M9) — replaces the hardcoded hex values previously duplicated across `src/app/components/suppr/hydration-stimulants-card.tsx` and `apps/mobile/components/HydrationStimulantsCard.tsx`._

## Surface colours

| Role | Light | Dark | Mobile token |
|------|-------|------|-------------|
| Background | `#FBF8F3` (oat) | `#19181C` | `Colors.*.background` |
| Background secondary | `#F2EFEA` | `#232126` | `Colors.*.backgroundSecondary` |
| Ring empty track | `#EDEAF1` (frost-mist) | `#372F44` | `Colors.*.ringTrack` / `--ring-bg` |
| Card | `#FFFFFF` | `#232126` | `Colors.*.card` |
| Card elevated | `#F6F5F2` | `#2A2730` | `Colors.*.cardElevated` / `--card-elevated` |
| Card border | `#E8E2EC` (Sloe line) | `#35323A` | `Colors.*.cardBorder` |
| Border | `#E8E2EC` (Sloe line) | `#35323A` | `Colors.*.border` |
| Input background | `#F2EFEA` | `#232126` | `Colors.*.inputBg` |
| Overlay | `#00000088` | `#000000aa` | `Colors.*.overlay` |
| Brand-mark ring | `#3B2A4D` (plum) | `#ffffff` | `Colors.*.brandMarkRing` / `--brand-mark-ring` |
| Brand-shell text | `#efe9f2` (frost-bright) | — | `Accent.frostBright` |

> **Brand-shell text (`Accent.frostBright`, #efe9f2 — ENG-1013):** the near-white
> plum-tinted PRIMARY text on the deep-plum brand ground (`Accent.primaryDeep`
> `#241733`). Used by the cook-mode V3 shell (`app/cook.tsx`,
> `app/recipe/[id].tsx`) for the step headline; one step brighter/warmer than the
> muted `Accent.frost` (`#c9c2d6`) divider/tagline and than the dark-scheme body
> ink `Colors.dark.text`. Route cook/brand-shell primary text here, never a raw
> `#efe9f2`.

## Shadow tokens

`shadowColor` on a drop shadow is a token too. Two bases, matching what the
`Elevation.*` tokens already cast from:

| Role | Value | Mobile token | Used by |
|------|-------|-------------|---------|
| Sheet / toast / float cast | `#000` | `ShadowColor.cast` | bespoke toast/sheet/modal shadows + `Elevation.sheet` / `Elevation.float` |
| Card ink cast | `#221B26` (aubergine ink) | `ShadowColor.ink` | resting cards + `Elevation.cardSoft` / `Elevation.cardHairline` |

> Prefer spreading an `Elevation.*` token when the whole recipe matches. When a
> surface needs a bespoke opacity/radius/offset (a one-off toast or tooltip),
> route just `shadowColor` through `ShadowColor.cast` / `ShadowColor.ink` — never
> a raw `#000` / `#221B26` (ENG-1013).

> **Sloe Phase 0 (2026-06-03):** the page is **oat `#FBF8F3`**, cards are pure
> white, the warmth lives in the **aubergine ink** (`--foreground` `#221B26`)
> and the hairline **Sloe line** border `#E8E2EC`. Dark mode is a warm
> aubergine graphite (ivory ink, not cool slate).

## Text colours

| Role | Light | Dark |
|------|-------|------|
| Primary text | `#221B26` (aubergine ink) | `#F5F3F4` |
| Secondary text | `#6A6072` | `#B7B2BA` |
| Tertiary text | `#9B93A3` | `#857F8B` |

## Where it lives in code

- **Mobile:** `apps/mobile/constants/theme.ts` — `Accent`, `MacroColors`, `Brand`, `Colors.light` / `Colors.dark`, `Spacing`, `Radius`, `ShadowColor`, `Elevation`.
- **Web:** `src/styles/theme.css` — CSS custom properties. When adding a new surface, use existing tokens. Do not introduce new hex values without updating this doc.

### Raw-hex lint guard (the ENG-811 lanes)

A raw hex literal in a component is a finding, caught at write time:

- **Web:** `eslint.config.mjs` `SUPPR_RAW_COLOUR_SYNTAX` (`no-restricted-syntax`) — raw hex + raw-Tailwind-palette utilities, `warn`.
- **Mobile (ENG-811 mobile lane, added with ENG-1013):** `apps/mobile/eslint.config.js` `SUPPR_RAW_HEX_SYNTAX` (`no-restricted-syntax`, `warn`), scoped to the ENG-1013-migrated screen tree (`app/(tabs)/*.tsx` + `components/today/**` + `app/recipe/[id].tsx`). The token file `constants/theme.ts` is the only legal home for a literal hex and is outside the scope. The Apple-HIG `#000`/`#fff` on `app/login.tsx` + onboarding `signup.tsx` are a brand carve-out, outside the scope.
- **Test gate:** `apps/mobile/tests/unit/hexTokenSweepCensus.test.ts` walks the whole target tree and fails if ANY raw hex reappears (comment-stripped, source-grep).

## Spacing tokens

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 20px |
| `xl` | 24px |
| `xxl` | 32px |
| `xxxl` | 40px |

## Radius tokens

_Canonical 2026-05-22 lock — tighter ladder (Linear / Stripe / Things 3 tier)._

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4px | Chips, badges, small buttons |
| `md` | 6px | Inputs, standard buttons |
| `lg` | 8px | Cards (canonical card radius) |
| `xl` | 12px | Large cards, modals |
| `full` | 9999px | Pills, circular badges |

## Rules

1. **No hardcoded hex values in components.** All colours must come from theme tokens or `useThemeColors()`.
2. **One primary per screen region.** Do not mix `primary` and `primaryLight` as competing accents.
3. **Macro tokens are reserved for the Macro tile row** — never use `MacroColors.fat` / `--macro-fat` (amber) as a meal-slot tint (the Snacks slot uses `SlotColors.snack` / `--slot-snack`, teal).
4. **Four-role colour law (Sloe, refined Grace 2026-06-04).** NAV/BRAND = plum (`navPrimary` — the centre Log FAB, wordmark, page titles; nav chrome only); PRIMARY = clay CTA (the one inline "do it" content action per region — Save, Log Dinner, Start Cooking); SUCCESS = sage (calorie ring at/under-target + macro identity); WIN = damson (landmark celebration only — not a CTA, not a state, not a macro). The plum/clay split is load-bearing: the FAB is plum so it reads as nav chrome, never "just another clay content CTA".
5. **Over-budget = destructive red (`#C0533F`), not amber (dossier D-2).** Fat now owns amber, so the over-budget signal moved to red. The calorie ring is plum under-target and gets a red overage when over.
6. **Macro colours are immutable.** They must not change per-screen or per-context.
7. **Use the `*-solid` / `*Solid` variant for accent TEXT/ICON on light.** The base clay / amber / sage / honey fills clear the 3:1 graphical bar but not 4.5:1 text — switch to the darkened solid token for small text or icons. Corollaries (ENG-885, verified by `tests/unit/sloeContrastTokens.test.ts`):
   - **Honey `--activity` is fill-only** — it's 2.3:1 even on white, so it can NEVER be text at any size. Use `--activity-solid` / `Accent.activitySolid` for burn/bonus text.
   - **White text on an accent fill needs the `-solid` fill** (white on clay `#C8794E` is only 3.33:1). The global `Button` (`bg-primary-solid`) and the net-energy state chip (`NET_ENERGY_CHIP_BG` in `src/lib/nutrition/netEnergyBalance.ts`) both follow this. The vivid base fill stays correct for large headlines (≥18.66px bold / ≥24px, 3:1 bar) and graphical marks.
   - **Card titles use plum `--foreground-brand`, not clay.** Headings are nav/brand chrome (plum), not content CTAs (clay).

## Fonts (Sloe Phase 0)

- **Headlines / display / hero numerals → Newsreader** (editorial serif).
  Web: `next/font/google` `--font-newsreader` (`app/layout.tsx`), applied to
  `h1–h3` + `.font-display` + `font-[family-name:var(--font-headline)]` in
  `src/styles/theme.css`. Mobile: `@expo-google-fonts/newsreader` loaded via
  `useFonts` in `apps/mobile/app/_layout.tsx`;
  `Type.display/title/headline/ringValue/heroValue` point at Newsreader.
  **Big standalone numeric HERO values are serif** — calorie ring, macro tiles,
  kcal/kg targets, big stat numbers, the prominent number on a card (SLOE
  Phase 0 / ENG-997; the consistency pass landed 2026-06-08, see
  `design-system.md` › "Hero numerals are serif" + `heroNumeralSerif.test.ts`).
- **Body / labels / captions → Inter** (sans), AND **unit suffixes** (kcal, kg,
  g, ml, %) beside a serif hero numeral + the small inline macro callouts on the
  saved-meal portion / ingredient sheets (`Type.macroValue`) — those stay Inter
  tabular for tight digit alignment. Web `--font-inter`; mobile
  `@expo-google-fonts/inter` (`Inter_400/500/600/700`). `tnum` + `ss01`
  preserved for numerics.

## Visual QA checklist

When changing accents, spot-check: Discover header, tab bar (light + dark), tracker macro chips, paywall header, calorie ring, burn detail, and one settings row. Verify both light and dark mode.
