# TestFlight feedback — master tracker

The single source of truth for every TestFlight submission received, what we did (or tried to do) about it, and where the detail lives. Pairs with **[resolved.md](./resolved.md)** (narrative per-incident log) — this file is the ledger; resolved.md is the diary.

Purpose:
- **Right now:** see what is truly outstanding without re-reading every commit.
- **If we ever restart the product or rebuild from scratch:** a concise reading of what early users complained about, which fixes stuck, which were dead ends, and what recurring problems deserve architectural consideration up front.

Data source: `docs/testflight-feedback/data/feedback-YYYY-MM-DD.json` (deduped ASC pull). Refresh via `npm run testflight:feedback` — see [README.md](./README.md).

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shipped in prod and confirmed resolved (by tester, tests, or code inspection) |
| 🟡 | Fix shipped but pending tester re-verification on a later build |
| 🔄 | Actively being fixed in the current in-flight build |
| 🟠 | Partially addressed — known follow-up work remaining |
| ⏳ | Open, not yet scheduled |
| 🔍 | Unverifiable from available evidence (insufficient data from tester) |

## Snapshot (2026-04-21, build-14 submitted)

| Total | ✅ | 🟡 | 🔄 | 🟠 | ⏳ | 🔍 |
|-------|----|----|----|----|----|----|
| 77    | 52 | 14 | 0  | 0  | 10 | 1  |

Build 14 covers:
- **G-7** Apple Health native @try + main-queue flip → closes both AHSTS2YR7k-l + ACwDKGBhb897 (🟡 pending tester verify).
- **F-21** image-rotation fallback → closes AKhHD-Uv1JWd + ABTpne3YnbHm + AGr4EisM3BOC (🟡).
- **F-22** correction-form field labels → closes AJlhpO020UK- (🟡).
- **F-23** recipe detail calories-hero shrink → closes AIf4Z6q1KL2j (🟡).
- **F-24** weight sparkline trimmed domain → closes AOCd89_asuNA (🟡).
- **F-25** deficit banner hidden on empty day → closes AJ2q4OgYYXE7 (🟡).

Open after build 14 (⏳):
- **OpenAI 401 in prod** (AIoBkBBn3bgh, AIe-YzITIaTX) — infrastructure, not code. Key missing/invalid on the Vercel production env. Action: rotate `OPENAI_API_KEY` in Vercel → Settings → Environment Variables → redeploy.
- **Weight 3M arrow direction + x-axis span** (AGOlc2wi1UZD) — "+0.9 kg" arrow UP reads wrong when goal is to lose; x-axis shows ~57 days not 90.
- **Plan regenerate missing + household card drift** (AAtQgwFWaQTF) — prototype parity.
- **HealthKit permission-denied alert copy** (AG-5oy-1vqo7) — expected fallback; G-7 fixes the underlying crash, but copy could be friendlier.

All H-tracks committed:
- **H-1** household `.single()` → regression tests pinned invariant; fix originally in build-11 `ef2a9f4`
- **H-2** per-serving headline → new shared `resolveFoodSearchHeadline` helper (both platforms)
- **H-3** Today Maintenance column → regression tests locked the F-3 runtime fix
- **H-4** Progress tab perf → skeleton-first paint + deferred `getDailyTargets` + one-frame chart mount
- **H-5** Plan day-total vs goal → new shared `dayTotalVsGoal` helper (both platforms)
- **H-6** import `source_url` → previously shipped in build-11 F-5 (`normaliseSource` SSOT)

All six move to 🟡 pending tester re-verification once build-13 installs. The one **🔍** (`AN8GJ1Dr3M` steps/burn "wrong for this day") stays unverifiable without the tester's raw HealthKit snapshot for that date.

## Lifecycle

```
TestFlight submission
    │
    ▼
npm run testflight:feedback  (fetches ASC API → data/*.json, gitignored by default)
    │
    ▼
This tracker (ledger)  +  resolved.md (diary)   ← update both after every fix
    │
    ▼
Commit referencing the ASC ID in the message
    │
    ▼
Next build uploaded → tester verifies → status flips to ✅
```

Ship rules:
- **Never** mark a ticket ✅ without either a tester re-verification, a regression test pinning the fix, or a code-level argument showing the failure mode can no longer occur.
- **Never** delete a row from the ledger — even dead-end attempts stay here with a status note. Churn is a feature, not a bug, for this file.
- **Always** tag the ASC ID in the commit message that fixes it (`"closes AIIm60n"`) so `git log --grep` can cross-reference.

## Ledger

| Date | ID | Type | Status | Fix / track | Complaint |
|------|-----|------|--------|-------------|-----------|
| 2026-04-21 | `AGOlc2wi1UZD…` | screenshot | ⏳ | pending — 3M weight arrow + x-axis | "This is incorrect" (weight chart ↑ 0.9 kg despite loss goal; 3M span reads ~57 days) |
| 2026-04-21 | `AOCd89_asuNA…` | screenshot | 🟡 | build-14 F-24 (trimmed sparkline domain) | Weight for all time too scrunched up |
| 2026-04-21 | `AAtQgwFWaQTF…` | screenshot | ⏳ | pending — Plan regenerate + household drift | Regenerate section missing and household doesn't match prototype |
| 2026-04-21 | `AKhHD-Uv1JWd…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Library — all recipes showing same photo |
| 2026-04-21 | `AIoBkBBn3bgh…` | screenshot | ⏳ | infra — rotate `OPENAI_API_KEY` in Vercel prod | OpenAI API 401 on Instagram import |
| 2026-04-21 | `AIf4Z6q1KL2j…` | screenshot | 🟡 | build-14 F-23 (calories hero shrink) | Calories section is too big (recipe detail) |
| 2026-04-21 | `AJ2q4OgYYXE7…` | screenshot | 🟡 | build-14 F-25 (hide deficit on empty day) | Middle section cluttered with 3 prompts (Today) |
| 2026-04-21 | `AG-5oy-1vqo7…` | screenshot | 🟡 | build-14 G-7 (native @try) | HealthKit permission alert in production |
| 2026-04-19 | `AIe-YzITIaTX…` | screenshot | ⏳ | infra — rotate `OPENAI_API_KEY` in Vercel prod | Import error (OpenAI 401) |
| 2026-04-19 | `ABTpne3YnbHm…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Placeholder photos instead of imported photos |
| 2026-04-19 | `AGr4EisM3BOC…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Placeholder meals (Plan Day 1) |
| 2026-04-19 | `AJlhpO020UK-…` | screenshot | 🟡 | build-14 F-22 (correction-form labels) + follow-up micros | Correction form fields unlabeled; can't correct full nutrition label |
| 2026-04-21 | `ACwDKGBhb897…` | crash      | 🟡 | build-14 G-7 (native @try + main-queue) | Apple Health crash "Again" (build 13) |
| 2026-04-19 | `AHSTS2YR7k-l…` | crash      | 🟡 | build-14 G-7 (native @try + main-queue) | "Same apple health crash" (build 12) |
| 2026-04-18 | `AF0btCuj90Ab…` | screenshot | ✅ | see `AF0btCuj9…` in resolved.md | Can't save alcohol limit |
| 2026-04-18 | `AISAWnLgU9cj…` | screenshot | ✅ | see `AISAWnLgU…` in resolved.md | Not intuitive (Progress tab) |
| 2026-04-18 | `AAegi1DJEisc…` | screenshot | ✅ | see `AAegi1DJE…` in resolved.md | Nothing happens when I try to create a household |
| 2026-04-18 | `AH8csBqtZsBJ…` | screenshot | 🟡 | build-13 H-5 (`dayTotalVsGoal` SSOT) | Plan doesn't tell me how close it is to my macro targets |
| 2026-04-18 | `AEe5QKJqkPPx…` | screenshot | ✅ | pre-build-10 (auto-generate modal) | Grocery list should regenerate when plan regenerates |
| 2026-04-18 | `APU2FBCjLALm…` | screenshot | ✅ | see `APU2FBCjL…` in resolved.md | Could not load templates (supabase related) |
| 2026-04-18 | `AJHZNp8NHTiF…` | screenshot | ✅ | see `AJHZNp8NH…` in resolved.md | Numbers here seem wrong (MFP carbs inflated) |
| 2026-04-18 | `AOI9xgY88Dx-…` | screenshot | ✅ | see `AOI9xgY88…` in resolved.md | Unclear if Edamam is integrated |
| 2026-04-18 | `AAtW7dYcCBPy…` | screenshot | ✅ | see `AAtW7dYcC…` in resolved.md | Lost clarity around total burn / projected burn |
| 2026-04-18 | `AEb7NcjnvK4P…` | screenshot | 🔄 | build-12 H-4 | Progress page takes a while to load |
| 2026-04-18 | `AD6_JNUaEjoJ…` | screenshot | ✅ | see `AD6_JNUaE…` in resolved.md | 0 steps today inaccurate vs today page |
| 2026-04-18 | `AF7bS2DQrH_w…` | screenshot | ✅ | see `AF7bS2DQr…` in resolved.md | Weight section not helpful nor accurate |
| 2026-04-18 | `APdpODtJDL8q…` | screenshot | ✅ | see `APdpODtJD…` in resolved.md | Notifications don't appear to be working |
| 2026-04-18 | `AMsdTaWai1sJ…` | screenshot | ✅ | see `AMsdTaWai…` in resolved.md | Not sure if this feature is working at all |
| 2026-04-18 | `AO4NtyNBpP4F…` | screenshot | ✅ | see `AO4NtyNBp…` in resolved.md | Instructions placeholder /n |
| 2026-04-18 | `AFE6h9Tlq0bU…` | screenshot | ✅ | see `AFE6h9Tlq…` in resolved.md | None of the trial / payments stuff is hooked up |
| 2026-04-18 | `AOjQg5DGBZqS…` | screenshot | ✅ | see `AOjQg5DGB…` in resolved.md | Notifications keep popping up but don't work |
| 2026-04-18 | `AOHTbpXsKXz9…` | screenshot | ✅ | see `AOHTbpXsK…` in resolved.md | Caption pulled in as recipe title + notes error |
| 2026-04-18 | `AHgJ5AK6VQow…` | screenshot | ✅ | see `AHgJ5AK6V…` in resolved.md | Could not load notes |
| 2026-04-18 | `ADpfDkX8c-Ke…` | screenshot | ✅ | see `ADpfDkX8c…` in resolved.md | Can't save ratings (same notes error) |
| 2026-04-18 | `AFdtq8z_FmWR…` | screenshot | ✅ | see `AFdtq8z_F…` in resolved.md | Unsure how TDEE compares to today numbers |
| 2026-04-18 | `ALkK-XrcMz_V…` | screenshot | ✅ | see `ALkK-XrcM…` in resolved.md | "Set to gain weight" logic wrong |
| 2026-04-18 | `AIIm60nKi_sT…` | screenshot | ✅ | see `AIIm60nKi…` in resolved.md | Where did 1900 maintenance come from |
| 2026-04-18 | `ABwH6OVJ-kJx…` | screenshot | ✅ | see `ABwH6OVJ-…` in resolved.md | Imported wrong (dupe Dinner/Snacks numbers) |
| 2026-04-18 | `AMAxKVVxPZtU…` | screenshot | ✅ | see `AMAxKVVxP…` in resolved.md | Need a source section at the bottom |
| 2026-04-18 | `AGzhQaCDvrZa…` | screenshot | 🟡 | Supabase dashboard Apple provider config | Apple login not working |
| 2026-04-18 | `AKvgjnbEOcb4…` | screenshot | 🔄 | build-13 H-2 (`resolveFoodSearchHeadline`) | Everything defaults to 100g rather than actual portions |
| 2026-04-19 | `ACEH_IlshzpR…` | screenshot | ✅ | see `ACEH_Ilsh…` in resolved.md | Imported recipes missing source section / link |
| 2026-04-19 | `AHCSYMATSHht…` | screenshot | ✅ | see `AHCSYMATS…` in resolved.md | Maintenance still showing at 1900 which it's not |
| 2026-04-19 | `AJFZ1hiEPo29…` | screenshot | 🟡 | Supabase dashboard Apple provider config | Apple sign in error |
| 2026-04-19 | `APo0qS9vcFvm…` | screenshot | ✅ | see `APo0qS9vc…` in resolved.md | Everything still 100g rather than proper servings |
| 2026-04-19 | `AE52_fIRZ-ZI…` | screenshot | ✅ | see `AE52_fIRZ…` in resolved.md | Add custom food needs more detail (mfp / lose-it style) |
| 2026-04-19 | `AEXP_nvFy4c7…` | crash | ✅ | build-12 G-1 (ObjC @try/@catch) | Crashes every time I try to connect Apple Health |
| 2026-04-19 | `AHhgUl6i1lax…` | crash | ✅ | build-12 G-1 | Crashed (Apple Health connect) |
| 2026-04-19 | `AB75VswCeXvj…` | screenshot | 🟡 | build-11 `ef2a9f4` (maybeSingle + unique migration) | Can't create a household |
| 2026-04-19 | `AC0AeyMF3Ehh…` | crash | ✅ | build-12 G-1 | Keeps crashing trying to connect to Apple Health |
| 2026-04-19 | `AN8GJ1Dr3MAd…` | screenshot | 🔍 | — | Steps and total burn are wrong for this day |
| 2026-04-19 | `ADFYpDgEEb0Q…` | screenshot | ✅ | see `ADFYpDgEE…` in resolved.md | TDEE / maintenance numbers don't align, not explained |
| 2026-04-19 | `AI-CNKcmy7y3…` | screenshot | 🟡 | build-11 `ef2a9f4` (F-5 `normaliseSource` SSOT) | "Esther Clark" source not clickable |
| 2026-04-19 | `AO2jdncS2Gxy…` | screenshot | ✅ | see `AO2jdncS2…` in resolved.md | Unsave vanishes recipe completely from library |
| 2026-04-19 | `AC2JP5CG8xLA…` | screenshot | ✅ | `9a9a2fd` (landing honest-claims SSOT) | Landing page says we don't do streaks etc. |
| 2026-04-19 | `ACoMvhUoe_ri…` | screenshot | ✅ | see `ACoMvhUoe…` in resolved.md | Weight chart 3/6/9 mo buttons don't change months shown |
| 2026-04-19 | `AOOBv-1OwtDI…` | screenshot | ✅ | see `AOOBv-1Ow…` in resolved.md | Use icons not emojis |
| 2026-04-19 | `AA63DQ7xd2gR…` | screenshot | ✅ | see `AA63DQ7xd…` in resolved.md | Score seems irrelevant — make it relevant or remove |
| 2026-04-19 | `AAHS7CjeXNC-…` | screenshot | ✅ | see `AAHS7CjeX…` in resolved.md | Defaults to recipes that don't exist |
| 2026-04-19 | `AMXSjeaXJeCf…` | screenshot | ✅ | see `AMXSjeaXJ…` in resolved.md | Pre-populated shopping list before user creates plan |
| 2026-04-19 | `APO0Nk_bre7h…` | screenshot | ✅ | see `APO0Nk_br…` in resolved.md | Portions / meal-plan-to-macros needs to be smarter |
| 2026-04-19 | `AJ1AeYJ--fFF…` | screenshot | ✅ | see `AJ1AeYJ--…` in resolved.md | Share only dinner / dinner & lunch / not macros etc. |
| 2026-04-19 | `AEyOuUJrB4lT…` | screenshot | ✅ | see `AEyOuUJrB…` in resolved.md | Plan retroactively changed past goals |
| 2026-04-19 | `AHEeeC9a4-lK…` | screenshot | ✅ | see `AHEeeC9a4…` in resolved.md | "Not moving on starting weight" is not 3% progress |
| 2026-04-19 | `APGJJlglIgFL…` | screenshot | 🔄 | build-13 H-2 (`resolveFoodSearchHeadline`) | Lots of foods still defaulting to 100g |
| 2026-04-19 | `AHnI_fIc7SKb…` | screenshot | ✅ | see `AHnI_fIc7…` in resolved.md | Pagination + mixed image / no-image rows |
| 2026-04-19 | `ABs9n0AyFkA8…` | screenshot | ✅ | see `ABs9n0AyF…` in resolved.md | Scan barcode layout sloppy |
| 2026-04-19 | `ADACe4M-PsjN…` | screenshot | ✅ | see `ADACe4M-P…` in resolved.md | Back button not working (meal detail) |
| 2026-04-19 | `AIOek8w6GKW5…` | screenshot | ✅ | see `AIOek8w6G…` in resolved.md | Barcode correction only accepts per-100g |
| 2026-04-19 | `AIjmgrBMmY-M…` | screenshot | ✅ | see `AIjmgrBMm…` in resolved.md | Can't add multiple items to one meal |
| 2026-04-19 | `AIIUzBeKpng0…` | crash | ✅ | build-12 G-1 | Still crashing on Apple Health connect |
| 2026-04-19 | `AGC7oEKypuMA…` | screenshot | ✅ | see `AGC7oEKyp…` in resolved.md | Apple Health issues persist |
| 2026-04-19 | `AJKHqJeCi83s…` | screenshot | ✅ | build-12 G-5 | Household feature — what are the numbers it's showing? |
| 2026-04-19 | `ALU8hrB1I9Sn…` | screenshot | ✅ | build-12 G-2 | Shopping list still has stale items from old plan |
| 2026-04-19 | `ALcwMFPjfmJv…` | screenshot | ✅ | build-12 G-4 | TDEE / maintenance still not explained well enough |
| 2026-04-19 | `AGJmliHTxnmt…` | screenshot | ✅ | build-12 G-3 | Graphs still not working properly |
| 2026-04-19 | `AC4oDEnQ0SuP…` | screenshot | ✅ | build-12 G-6 | JSON export — shouldn't it be CSV? |

## Recurring themes — architectural continuity / restart guide

These are the patterns that showed up across multiple tickets — the ones worth holding a shape for if this app (or the next) rebuilds from scratch.

### 1. Nutrition display honesty — "per 100 g" is always wrong for a consumer

Eight separate tickets (`APo0qS9v`, `AKvgjnb`, `APGJJlg`, `AIOek8w6`, `AE52_fIR`, `ABwH6OVJ`, `AJHZNp8N`, `AF7bS2DQ`) hit the same failure mode: we stored nutrition per-100 g (USDA convention) and defaulted to displaying that, while users mentally expect per-serving. Every time we "fix" one surface (barcode correction, search row, custom food), another surfaces the same mismatch.

**Architectural lesson:** per-100 g is the correct *storage* unit; per-serving is the correct *display* unit. The display layer should never render raw per-100 g without an explicit per-serving resolution step first. Treat "which unit is in this number?" as a type-system obligation, not a string label.

### 2. Source-of-truth drift between Today tab and the rest of the app

`AAtW7dYcCBP`, `AFdtq8z_FmWR`, `ADFYpDgEE`, `AHCSYMATS`, `AIIm60n`, `ALcwMFPjf` all report some variant of "the number on Today doesn't match the number on Progress / Maintenance / Plan". Maintenance TDEE, goal calories, total burn, all diverge between surfaces.

**Architectural lesson:** one resolver (`resolveMaintenance`, similar for goals and daily totals) should be the only function that produces each of these numbers. Every surface calls it; nothing recomputes. Caching per-day snapshots avoids the timing divergence we keep hitting.

### 3. Onboarding / settings changes must not backdate history

`AEyOuUJrB4` ("updating my plan has retroactively changed my goals so days where I hit my goal I'm now over my goal amounts") — any self-edit of goals / activity level / plan was backdating across all historical days.

**Architectural lesson:** user goal + activity level + plan must be stored as time-scoped records (effective-from date), and every read of "was I on target on day X" must use the record live on day X. This is a data-modelling bug, not a UX bug. Design for it from day one.

### 4. Apple Sign-in / native-bundle audience config is invisible until it isn't

`AJFZ1hi`, `AGzhQaCDvr` — after rebranding bundle ID `com.platemate.*` → `com.supprclub.supprapp`, Supabase's Apple provider still expected the old audience. Tester hit `Unacceptable audience in id_token`.

**Architectural lesson:** maintain a "rebrand checklist" that explicitly includes every external system that knows your bundle ID or Services ID (Apple Developer, Supabase OAuth, RevenueCat, OneSignal, Sentry release tags, App Store Connect). Bundle-ID drift manifests late and looks unrelated.

### 5. Relative URLs in React Native silently fail

`AAegi1DJ` (household creation doing `fetch("/api/household")`) — React Native has no origin, so relative URLs resolve to garbage. Compounded by a surrounding `try/catch` that swallowed the failure.

**Architectural lesson:** (a) ESLint rule banning relative URL strings in `fetch()` in mobile code; (b) never wrap network calls in silent `try/catch` — surface errors visibly or not at all.

### 6. `.single()` is a landmine unless you control the row count

`AB75VswCe` — PostgREST `.single()` throws when 0 or >1 rows. The moment you allow partial state (user leaves a household without cleaning `household_members`, user joined from two devices racing, etc.), `.single()` becomes a user-blocking error dialog.

**Architectural lesson:** default to `.maybeSingle()` with explicit null handling; reserve `.single()` for joins on a unique key that is enforced at the database level. Pair with a DB unique constraint.

### 7. Icons vs. emojis — cheap-looking by default

`AOOBv-1Ow` — emoji icons ship fast but look amateur and inconsistent across platforms (emoji fonts differ iOS vs. Android vs. web).

**Architectural lesson:** have an explicit icon registry (lucide for web, vector iconset for mobile) and never use string emojis in product chrome. Emojis are OK in user-generated content, not in our own UI.

### 8. Copy drift between landing and app

`AC2JP5CG8x` — landing page claimed "no streaks" while the app shipped streaks.

**Architectural lesson:** landing copy should be generated from (or tested against) product constants whenever possible — feature names, tier gates, nutrition source list, numeric thresholds. We now do this via `src/lib/landing/content.ts` — keep it as a hard rule, not an optional one.

### 9. Health data integrity reporting is hard to validate

`AN8GJ1Dr3M` ("steps and total burn are wrong for this day"), `AD6_JNUaE` ("0 steps inaccurate vs today page"), `AJHZNp8N` ("numbers way higher than actual"). Testers report "wrong" without a reference.

**Architectural lesson:** include a visible "source of this number: HealthKit → type X → range Y → Z samples" pane behind an info chevron on every derived fitness/nutrition number. If the user can see provenance, they can tell you which assumption to fix.

### 10. Progress / Analytics tabs punish cold loads

`AEb7NcjnvK` — Progress tab spinner-only on cold load because it eagerly computes 180 days of chart data on the sync render path.

**Architectural lesson:** any tab with derived analytics must render a skeleton immediately and defer heavy derivation. Budget every tab at first-meaningful-paint <1 s warm, <2 s cold. Enforce with a perf regression test, not a promise.

### 11. Native crashes from third-party patches need defensive try/catch at the boundary

`AIIUzBeK`, `AC0AeyMF`, `AHhgUl6i`, `AEXP_nvFy`, `AGC7oEKyp` — all same crash: `react-native-health` HKCorrelation enumeration threw `NSException` on iOS 26.5, taking the app down before any JS-side guard could catch it.

**Architectural lesson:** every native patch for a third-party library must wrap enumerator callbacks (HealthKit, CoreBluetooth, AVFoundation, etc.) in `@try/@catch` + log. Don't rely on JS-side `try/catch` around a bridge call — bridge calls are asynchronous and the native exception has already unwound by the time JS hears about it.

### 12. Partial fixes that only address half a surface

`APo0qS9v` fixed per-serving metadata in the search subline but left the big kcal number per-100g (caught later as `AKvgjnb` / `APGJJlg`). `AAegi1DJ` fixed household create via the REST route but missed that the iOS error dialog came from a different `.single()` call (later surfaced as `AB75VswCe`).

**Architectural lesson:** when closing a ticket, walk every callsite of the affected data path before marking ✅. Tests should pin not just the happy path but the sibling surfaces.

## Build → IDs map

Quick reverse-lookup: which IDs were closed by which shipped build.

- **build-10** (`e2c2884`): early E-tracks. IDs covered by sub-entries E-1..E-*.
- **build-11** (`ef2a9f4`): 17 F-tracks. Includes F-1 (JS-only HealthKit guard), F-5 (recipe `normaliseSource` SSOT — closes `AI-CNKcmy`, `ACEH_Ilshz`, `AMAxKVVxP`), F-17..F-20 (Today/barcode polish — closes `AIjmgrBMm`, `ABs9n0AyF`, `ADACe4M`, `AIOek8w6`), plus household `.maybeSingle()` + unique-member migration (closes `AB75VswCe`).
- **landing fix** (`9a9a2fd`): honest-claims SSOT — closes `AC2JP5CG8x`.
- **build-12** (`515124d`): G-tracks. G-1 (ObjC `@try/@catch` for HealthKit crashes — closes all four crash IDs), G-2 (shopping stale-items + dedupe — closes `ALU8hrB1I`), G-3 (weight chart y-axis + range — closes `AGJmliHT`, `ACoMvhUoe`), G-4 (maintenance chain explainer — closes `ALcwMFPjf`), G-5 (household per-member number labels — closes `AJKHqJeCi`), G-6 (CSV export — closes `AC4oDEnQ0`).
- **build-12 H-tracks** (in flight): H-2 per-serving headline number, H-3 Today Maintenance column parity, H-4 Progress perf, H-5 Plan day delta. Will close `AKvgjnb`, `APGJJlg`, `AEb7NcjnvK`, `AH8csBqt`, and the still-latent half of `AAtW7dYcCBP`.

## Related files

- **[resolved.md](./resolved.md)** — narrative per-incident log (what, why, the fix, verification).
- **[../planning/testflight-followups-2026-04-19.md](../planning/testflight-followups-2026-04-19.md)** — prioritised backlog of work still to do (B-tracks).
- **[README.md](./README.md)** — how to pull feedback from App Store Connect.
- **`data/`** — gitignored raw + deduped pulls (`feedback-YYYY-MM-DD.json`).
- **`scripts/fetch-testflight-feedback.mjs`** — the pull script.
- **`CHANGELOG.md`** at repo root — shipped-build history; every entry should link back to the IDs it closed.
