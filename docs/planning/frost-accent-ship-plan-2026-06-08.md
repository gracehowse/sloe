# Frost Accent Ship Plan — Direction D (Damson/Frost) · ENG-997

Read-only plan (design-system-enforcer audit, 2026-06-08). Complete the `brand_frost_secondary` migration so flag-ON moves every clay CTA/active/link/accent-fill/tint to **Damson `#6A4B7A`** (+ Frost lilac chrome), web + mobile lockstep, leaving carbs/sugar/status/honey/nav/slots/dots warm. Decision: `docs/brand/2026-06-07-secondary-colour-exploration.md` (DECIDED Direction D).

## Verdict + headline numbers
- **Mobile is the cost:** ~**714** `Accent.{primary,primaryLight,primarySolid,…}` occurrences across ~140 files → after carve-outs, **~95–110 files** to migrate to the flag-aware `useAccent()`. The dominant work.
- **Web is near-done via the `.flag-frost` CSS cascade** — standard `var(--accent-primary*)` / Tailwind `bg-primary*` consumers flip automatically, **zero per-consumer migration**. Only **one live literal bypass**: `src/app/components/suppr/today-meals-figma-layout.tsx:183` uses `text-[var(--clay,#C8794E)]` and `--clay` is undefined → stays clay flag-on (also a web↔mobile parity break). Plus a win-gradient SVG asymmetry at `daily-ring.tsx:324`.
- **Carbs/sugar guardrail: PASS** — `--macro-carbs`/`--macro-sugar`/`--chart-3` (web) + `MacroColors.carbs`/`Accent.carbs` (mobile) hold their own clay literal and do NOT alias the accent; both `.flag-frost`/`AccentFrost` leave them out; both regression guards assert it.
- **Ramp posture: PASS** — `brand_frost_secondary` is NOT in `REDESIGN_DEFAULT_ON`; flip is a **PostHog ramp**, not a code change.
- **Drift found:** decision doc claims 4 mobile consumers migrated; really 3 + **`TodayMealsSection` "Add food" is HALF-done** (binds `useAccent()` at L595 but the CTA at L792–793 still uses static `Accent.primary` — dead binding + uncovered CTA). Fix in Phase 0.

## The migration, by tier (mobile → `useAccent()`)
Mechanical per file: import `useAccent`, `const accent = useAccent()`, replace in-scope `Accent.primary*` CTA/active/link/tint reads with `accent.primary*`. **Main friction:** colours built inside module-level/`useMemo` `StyleSheet.create` can't read a hook → lift to inline `style={{ backgroundColor: accent.primary }}` (pattern: `TodayPlannedMealsCard`).
- **Tier A — Today daily loop** (do first, highest visibility): `TodayMealsSection` (finish), `(tabs)/index.tsx`, `TodayAddFoodForm`, `LogSheet`, `TodayWeekView`, `WeeklyCheckinBanner`, `NorthStarBlock`, `WeeklyInsightCard`, `TodayActivityBonusCard`, nudges, steppers… (~20 files).
- **Tier B — logging/search/barcode/voice/photo sheets** (`barcode.tsx` ×15, `FoodSearchPanel` ×17, `BarcodeScannerModal` ×25, `QuickAddPanel`, sheets…).
- **Tier C — recipes/cook/import** (`recipe/[id]` ×13, `cook.tsx` ×19, `verify.tsx` ×17, `import-shared` ×23, wizards…).
- **Tier D — plan/shopping/household** (`planner` ×21, `shopping`, `household-settings` ×19, move/copy sheets…).
- **Tier E — progress/weight/fasting** (`fasting` ×10, weight, trajectory, recap…).
- **Tier F — onboarding** — migrate `scaffold.tsx` FIRST (one file flips every step's accent), then `mobile-flow` + per-step files. (Welcome copy divergence untouched.)
- **Tier G — paywall/settings/misc** (`SettingsBundleContent` ×21, `health-sync` ×19, `paywall`, `targets`, `profile`…).

**EXCLUDE everywhere (stay clay/warm):** `MacroColors.*`/carbs/sugar, status (success/warning/destructive/over-budget), honey/activity, plum nav/wordmark/brand-mark, the **Log FAB** (plum by design), confidence/source/slot dots, `Accent.win` static.

## Web
The `.flag-frost` cascade covers standard consumers. Fixes: (1) `today-meals-figma-layout.tsx:183` → `text-primary-solid` (closes the bypass + parity break); (2) `daily-ring.tsx:324` win-gradient mid-stop → flag-aware damson (parity with mobile `WinMomentPlayer`). Other `#C8794E` literals (macro-carbs/sugar/chart-3, netEnergyBalance surplus) are correct — leave clay.

## Ramp mechanics
Flip = **PostHog ramp** of `brand_frost_secondary` 0→100% (web `FrostFlagToggle` + mobile `ThemeProvider` re-read live on `onFeatureFlags`, no deploy). Do NOT add to `REDESIGN_DEFAULT_ON` (breaks the rollout-posture guard). Sim often can't reach PostHog → **validate flag-on on web**; on-device via the dev Settings runtime override. Hold 100% two weeks, then a cleanup PR removes the flag + collapses `AccentFrost`/`.flag-frost` into base tokens.

## Phased execution (land AFTER the in-flight Today/Recipe builds merge — they edit the same files)
- **Phase 0 (tiny, first):** web `today-meals-figma-layout:183` → `text-primary-solid`; mobile `TodayMealsSection` finish the half-done CTA; web `daily-ring:324` win-gradient → flag-aware. *Makes flag-on visibly correct on the Today hero without the 100-file tail.*
- **Phase 1:** Tier A (Today) + verify web parity; before/after (flag off vs on) on Today empty/under/over.
- **Phase 2:** Tier F (onboarding via `scaffold` first) + Tier B (logging sheets).
- **Phase 3:** Tiers C/D/E/G — one PR per tab (respect the 3-open-PR cap).
- **Phase 4:** add a consumer-side regression guard (assert key CTAs resolve damson flag-on — neither guard covers this today); update the decision-doc migrated-consumer list; PostHog ramp; cleanup PR.
Each PR: `npm run ci`; before/after captures **iOS sim first, web second**; flag-off path stays byte-identical to clay.

## Open questions for Grace
1. **Calories accent** (`macro-detail.tsx:27` maps calories→clay; the ring uses plum) — leave clay now + reconcile calories→plum in a follow-up (recommended), or fix in this ship?
2. **Web celebration win-gradient** (`daily-ring.tsx`) — flip its mid-stop to damson under the flag to match mobile (recommended, consistent), or keep the celebration spectrum clay everywhere?

## Handoff
`executor` (Phases 0–3 swaps + StyleSheet lifts) · `sync-enforcer` (per-surface web↔mobile parity) · `design-system-enforcer` (Phase 4 guard + calories reconciliation + a separate Ionicons→lucide sweep, out of scope here) · `brand-manager` (validate applied result) · `docs-keeper`/`product-memory` (correct the decision-doc migrated list).
