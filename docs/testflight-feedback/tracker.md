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

## Snapshot (2026-04-22, build 29 live; 2026-04-22T21:00Z ASC pull)

| Total | ✅ | 🟡 | 🔄 | 🟠 | ⏳ | 🔍 |
|-------|----|----|----|----|----|----|
| 132   | 55 | 66 | 0  | 5  | 4  | 2  |

**Action-round plan:** per-cluster next steps in [../planning/testflight-2026-04-22-action-plan.md](../planning/testflight-2026-04-22-action-plan.md).

**2026-04-22 pilot-round action shipped (8 F-tracks):**
- **F-56** Trend-tile stale-data guard (>14 day recency) — closes `AOVuCyOCNB1p…`.
- **F-57** HealthKit dietary-perm-denied recovery — closes `AEzcUFvXt…` + 3 siblings (Open Health deeplink + post-sync Alert when body moves but dietary returns empty).
- **F-58** Plan tab Pro→Free downgrade guard + `ensurePurchasesUser` — closes `ADpuHU6O` + 2 siblings. Pure helper `resolveNextTier` pinned with 7 test cases.
- **F-59** Discover cache poison fix — closes `AEwoLmeE` + 2 siblings. Never persist or return cached empty array; prod has 20 discoverable seeded recipes per direct Supabase query.
- **F-60** Today hero shrink (Ring 160→140, Number 56→44) — closes `AB6WOylB` + 1 sibling.
- **F-61** Discover "More ideas" now renders hero-style cards (uniform social-feed density) — closes `AEq5NTi0n…`.
- **F-62** Import empty-state split (denied vs already-own vs genuinely-empty) — closes `ABG0cZzo` + 1 sibling.
- **F-63a/b/d/e** Plan day-card density, Library filter pill clip, Household Settings duplicate header, Recipe ingredient kcal clip — closes 6 C9 submissions.
- **C10** `AHS6xzyU…` closed ✅ as duplicate of `AA63DQ7xd…` (score already removed everywhere).
- **C11** `ANfXXs6H…` ✅ — ops fix applied 2026-05-01: Grace regenerated the Edamam keys in the developer portal and updated Vercel env vars (`EDAMAM_APP_ID` / `EDAMAM_APP_KEY`). `searchEdamam` resumes returning results; no code change required.
- **C9c** (`AIC05bpyu…`) 🟠 — Health Sync permission style; routed to ui-product-designer.
- **C5** Household Netflix-model — brief delivered, saved at [../planning/2026-04-22-household-netflix-model-spec.md](../planning/2026-04-22-household-netflix-model-spec.md). Routes next: ui-product-designer, data-integrity, journey-architect, executor.
- **C6-chart** Weight chart redesign — brief delivered, saved at [../planning/2026-04-22-weight-chart-redesign-brief.md](../planning/2026-04-22-weight-chart-redesign-brief.md). Executor can pick up with the specified file list (WeightChart/WeightRangeToggle/WeightSparseState + shared weightTrend.ts).
- **C9c** Health Sync redesign — brief delivered, saved at [../planning/2026-04-22-health-sync-redesign-brief.md](../planning/2026-04-22-health-sync-redesign-brief.md). Three new components + one decision doc + web parity pass.
- **F-64** Recipe image upscale — parser prefers og:image; 12 of 20 prod rows backfilled; 4 new regression tests pinned.

**2026-04-22 build-29 action shipped (5 F-tracks):**
- **F-65** Health connected state now persisted in AsyncStorage — tapper no longer needs to re-grant on every app launch. Closes `AI3j3W0pb4KXOeHpfSb_4bg`.
- **F-66** Import API: always return parsed ingredient amounts/units even when `verifyIngredients` throws — fixes all-zero kcal on difficult recipes. Closes `AFFLASGiZtipiNIVNStLAxM`.
- **F-67** Recipe Verify screen: tap any ingredient → expanded row now shows a Remove button (confirm dialog → deletes from DB + removes from local state). Closes `AMp-9LdEySJR-4b3FoO5zI0`.
- **F-68** Recipe detail: cook/prep times ≥60 min now format as `Xh` or `Xh Ym` (mobile + web). Closes `AEnCdLrqNCk8S5IbqYD-ma8`.
- **F-69** Discover hero cards now show `{P}g P · {C}g C · {F}g F` instead of protein-only. Web parity applied in same commit. Closes `AE2MdvYfJVQL298eoF_fps4`.

**Build-29 new submissions (9) — triage:**
- `AI3j3W0pb4KXOeHpfSb_4bg` — 🟡 C1 repeat (HealthKit); F-65 shipped (persist connected state).
- `AFFLASGiZtipiNIVNStLAxM` — 🟡 0 kcal ingredients; F-66 shipped.
- `AMp-9LdEySJR-4b3FoO5zI0` — 🟡 Can't delete ingredients; F-67 shipped.
- `AEnCdLrqNCk8S5IbqYD-ma8` — 🟡 360m not formatted; F-68 shipped.
- `AE2MdvYfJVQL298eoF_fps4` — 🟡 Discover cards protein-only; F-69 shipped.
- `AD3qa1g9ZI7Co3tvazH-yUQ` — 🟠 C11 repeat (Edamam keys returning 401 — ops: regenerate keys in Edamam portal + update Vercel).
- `AHjCqNMXhdrnnUIikNRWdW0` — 🟡 F-70 shipped: plan algo was storing fit multiplier as `portionMultiplier`; `dayPlanTotalsFromMeals` then double-applied it (e.g. 1,667 kcal plan displayed as 5,421 kcal). Fix: fit mult baked into `calories`, never set as `portionMultiplier`.
- `AEVC-WdrU9sw9ql6rDR62e8` — ⏳ F-70 weight chart crosshair/zoom (covered by weight chart redesign brief).
- `AK91aaRcQ6ILWgQIvCatZXI` — 🟡 C5 repeat (household invite in wrong place; Netflix-model brief covers it).

All tracker rows now have IDs mapped to an F-number, a routing verdict, or a design brief with a concrete executor path.

**2026-04-22 pilot-round pull delta (+34 new rows):** grouped into 11 clusters — **C1** Apple Health still broken (×4), **C2** Pro→Free on Plans (×3), **C3** recipes not seeded (×3), **C4** calorie hero still massive (×2), **C5** household prototype drift (×4), **C6** weight graph (×3), **C7** Discover feed cards (×2), **C8** import "no meals" bug (×2), **C9** layout/spacing/prototype mismatch (×7), **C10** score removal repeat (×1), **C11** Edamam status (×1). Plus 1 meta (✅ Confirming build) + 1 🔍 (no comment).

**2026-04-22 delta (builds 23 → 27):**
- **F-37..F-42** (build 23): HealthKit init split, household create success Alert, multi-item meal modal stays open, recipe `/n` regex widened, recipe source name clickable, notes `recipe_id` uuid guard.
- **F-43..F-46** (build 23): RC+promo reconcile on Plan mount (fixes Pro-shown-as-Free); HK nutrition + body lookback 120/366 → 730 days; fit-% pill removed on Discover (web + mobile).
- **F-47..F-48** (build 23): Today hero calorie section shrunk (Number 80→56, Bar 44, endpoint row killed, gesture caption dropped); household card caption clarified ("Your remaining calories and macros for today. Members' targets are private.").
- **F-49** (build 26): visible build-stamp in **More → Build** — tester can screenshot "MARKER F49-2026-04-22" to confirm which binary is installed.
- **F-50** (build 27): **HealthKit single-init** consolidation (reverts F-37 split — iOS was silently skipping the second sheet so dietary perms were never granted → "Connected but no meals"). Also: seed-script `author_id` fix (was `null`, hidden by `.not("author_id","is",null)` Discover filter) + one-shot DB backfill for 20 existing seeded rows.
- **Build 27 marker** in place — new ledger rows from 2026-04-22 15:03–15:07Z are confirmed against build 26 or 27 via Grace's `ALQ5grg…` "Confirming correct version" screenshot.

Build 17 adds (for the 5 new items that came in after build-15 install):
- **F-33** Library card grey-band overlay removed (AH96GSgB4pjq).
- **F-34** Recipe import — LLM prompt rule + defensive `stripSectionPrefix` helper kill "For the creamy cucumber salad:" duplicate prefix on every ingredient row (ANmFiVpOfYEN).
- **F-35** HealthKit alert gains a "if Suppr isn't listed" fallback paragraph that tells the user to force-quit + relaunch so the auth sheet re-presents (AAUjI8ZWEQKi).
- **F-36** Library filter pills get `maxFontSizeMultiplier={1.2}` so iOS Dynamic Type stops stretching them to absurd widths (AAOBOOX-2zyX).
- **Build 15 → 16 install lag** (AKL4IQ_aQ2bX) — not a code fix. Grace shot this on build 15 (F-29 Regenerate is visible, F-32 avatars aren't). Build 16 auto-installs and closes it.

Build 14 covers:
- **G-7** Apple Health native @try + main-queue flip → closes AHSTS2YR7k-l + ACwDKGBhb897 (🟡 pending tester verify).
- **F-21** image-rotation fallback → closes AKhHD-Uv1JWd + ABTpne3YnbHm + AGr4EisM3BOC (🟡).
- **F-22** correction-form field labels → closes AJlhpO020UK- labels half (🟡).
- **F-23** recipe detail calories-hero shrink → closes AIf4Z6q1KL2j (🟡).
- **F-24** weight sparkline trimmed domain → closes AOCd89_asuNA (🟡).
- **F-25** deficit banner hidden on empty day → closes AJ2q4OgYYXE7 (🟡).

Build 15 adds:
- **F-26** softer HealthKit permission-denied alert copy → closes AG-5oy-1vqo7 (🟡).
- **F-27** weight delta label — "since {firstKey}" when actual data < 70% of nominal range → closes AGOlc2wi1UZD span half (🟡).
- **F-28** correction form fiber field — DB already supported, just exposed (🟡).
- **F-29** Plan Regenerate button in header, always visible when plan exists → closes AAtQgwFWaQTF regenerate half (🟡).
- **F-30** correction form sugar / sodium / satfat — migration `20260430100000_user_foods_micros.sql` adds `sugar_g`, `sodium_mg`, `saturated_fat_g` columns; form + `submitFoodCorrection` + `BarcodeProduct` type all wired → closes AJlhpO020UK- micros half in full (🟡).
- **F-31** weight delta tone — goal-aligned color (progress = green, regress = amber) on the range delta magnitude while keeping the arrow factual → closes AGOlc2wi1UZD arrow half (🟡).
- **F-32** household card prototype language — overline typography (11/700/1.1) + coloured circular initials avatar + audit-aligned spacing → closes AAtQgwFWaQTF drift half (🟡).
- **Infra** `OPENAI_API_KEY` rotated in Vercel prod by Grace 2026-04-21 → closes AIoBkBBn3bgh + AIe-YzITIaTX (🟡 pending re-test with a reel URL).

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
| 2026-04-22 | `AEzcUFvXt-ux…` | screenshot | 🟡 | **F-57** — health-sync gains (a) always-visible "Open Health app · Manage permissions" deeplink that opens `x-apple-health://`, (b) post-sync Alert when body data moved but dietary returned empty AND no Suppr-owned samples (proxy for silent dietary-read-denied). Root cause: iOS silently suppresses re-prompt for dietary perms after prior split-init had asked | "Apple health still doesn't work this is urgent it used to work perfectly" |
| 2026-04-22 | `AEWQ5gs3vyvs…` | screenshot | 🟡 | sibling of F-57 | "Apple health still not fixed" |
| 2026-04-22 | `AAcIj2Vc1D60…` | screenshot | 🟡 | sibling of F-57 — 730-day lookback was already shipped (F-44); new alert explains why dietary is empty when body syncs fine | "Apple health successfully synced but it has not pulled in historical meals like it used to (from lose it mfp etc)" |
| 2026-04-22 | `AGZq4O-Z9qZX…` | screenshot | 🟡 | sibling of F-57 (assumed "still happening" = HealthKit) | "Still happening" |
| 2026-04-22 | `ADpuHU6O7jEY…` | screenshot | ⏳ | cluster **C2** — Pro entitlement drift on Plans surface | "Also thinks I'm free but I'm on pro" |
| 2026-04-22 | `AIryDu7i28Rl…` | screenshot | ⏳ | cluster **C2** | "On pro but plans thinks I'm on free" |
| 2026-04-22 | `AIm3KPwBYlA1…` | screenshot | ⏳ | cluster **C2** | "Im on pro but plan still thinks im on free" |
| 2026-04-22 | `AEwoLmeE5w47…` | screenshot | 🟡 | **F-59** — prod Supabase confirmed: 20 published+authored seeded recipes exist + RLS allows read. Root cause is a poisoned empty-array AsyncStorage cache from an earlier broken build — new build flash-paints "No recipes yet" before network resolves. Fix: never cache `[]`, and treat cached empty arrays as "no cache" on read | "Recipes still not seeded" |
| 2026-04-22 | `AKcZwsipNdSx…` | screenshot | 🟡 | sibling of F-59 | "Recipes still aren't seeded" |
| 2026-04-22 | `AJr60qsyVUcM…` | screenshot | 🟡 | sibling of F-59 | "Recipes still not seeded" |
| 2026-04-22 | `AB6WOylB6-Qz…` | screenshot | 🟡 | **F-60** — Ring size 160→140 (+ card paddingY xl→md); Number fontSize 56→44 / lineHeight 64→52 / paddingY 20→16 for parity with Bar. All three hero variants now share one kcal number size | "Calorie section still massive" |
| 2026-04-22 | `ADt-4U9u_9NE…` | screenshot | 🟡 | sibling of F-60 | "Cals still too big hasn't been fixed" |
| 2026-04-22 | `ALpppRnGzIx9…` | screenshot | ⏳ | cluster **C5** — household still doesn't match prototype post-F-32 | "Still doesn't look like the prototype for households" |
| 2026-04-22 | `ALQQyjCHjzbt…` | screenshot | ⏳ | cluster **C5** | "Household sections still doesn't make much sense and doesn't match the prototype for this page" |
| 2026-04-22 | `AKQGhg8wc6FZ…` | screenshot | ⏳ | cluster **C5** | "I don't really know what the household section is telling me right now" |
| 2026-04-22 | `AGpLe8GO99nQ…` | screenshot | ⏳ | cluster **C5** | "Household still not updated" |
| 2026-04-22 | `AKuLcrQUR7pf…` | screenshot | ⏳ | cluster **C6** — weight graph still wrong post-F-24/F-27/F-31 | "Weight graph still wrong" |
| 2026-04-22 | `AGM9xRpzTLnD…` | screenshot | ⏳ | cluster **C6** | "Weight graph either not accurate or not clear" |
| 2026-04-22 | `AOVuCyOCNB1p…` | screenshot | 🟡 | **F-56** — `computeWeightTrendCopy` now returns `{delta: null, copy: "Log weight to see trend"}` when most recent weigh-in is >14 days old (test pinned) | "Up 0.9 this week is not correct as I have not logged weight in about a month" |
| 2026-04-22 | `AEq5NTi0ncnZ…` | screenshot | 🟡 | **F-61** — Discover "More ideas" section now renders hero-style cards (same layout/image treatment/kcal+macro row as the top 2), 12px stack gap. Uniform social-feed density across the whole feed | "All recipes should render like the first 2 (bigger feed like)" |
| 2026-04-22 | `APpAKhhRSuv0…` | screenshot | 🟡 | **F-64** — parser now prefers og:image / twitter:image over JSON-LD thumbnails (social meta tags are 1200×630+ by convention; JSON-LD frequently ships a 225×225 thumbnail). Plus a URL upscaler that strips WP `-WxH` suffixes and Photon `fit/resize/w/h` params. One-shot backfill `scripts/reseed-recipe-images.mjs` ran against prod: 12 of 20 seeded rows upscaled, 8 already correct | "Images are here but they are terrible" |
| 2026-04-22 | `ABG0cZzoaaeJ…` | screenshot | 🟡 | **F-62** — sync-status copy now distinguishes three empty-states: (a) truly empty → F-57 denied-perm Alert fires, (b) all samples were Suppr-authored → "N samples skipped (already logged in Suppr)", (c) nothing new → generic "No new meals" | "Says no new meals but there are" |
| 2026-04-22 | `AELbM8VJ40Jl…` | screenshot | 🟡 | sibling of F-62 | "Says no meals to import but there are meals to import" |
| 2026-04-22 | `AIC05bpyuit_…` | screenshot | 🟠 | cluster **C9c** — screenshot = Health Sync screen (`apps/mobile/app/health-sync.tsx`). Apple Health permission rows render empty circles vs prototype toggles. Requires design brief — route to ui-product-designer | "This page doesn't match prototype" |
| 2026-04-22 | `AERuv07KITiH…` | screenshot | 🟡 | **F-63a** — Plan day-card: "Day total · X/Y kcal · P/C/F" wrap row removed; calorie target promoted into the day header line in tonally-coloured (neutral/amber/red) form. Macro state continues to flow through the existing delta-pill row below. Test updated | "Day totals section is overcrowded looks messy" |
| 2026-04-22 | `AJ8Fk6ud6Dl1…` | screenshot | 🟡 | sibling of F-63a | "Macro section is confusing and spacing is off" |
| 2026-04-22 | `AAUNtlDI0VvV…` | screenshot | 🟡 | **F-63b** — Library filter pills were clipped vertically on iOS when the horizontal ScrollView had no explicit row style. Added `style={{ flexGrow: 0, minHeight: 44 }}` + `alignItems: "center"` + `paddingTop: Spacing.xs` on the content container | "Format layout still terrible on this page" |
| 2026-04-22 | `ALvjyW7wHU7K…` | screenshot | 🟡 | sibling of F-63b | "Layout still messed up" |
| 2026-04-22 | `AHitOL0RmJmQ…` | screenshot | 🟡 | **F-63d** — Household Settings rendered two stacked titles: the auto router header ("Household Settings") + the in-content header ("Household"). `<Stack.Screen options={{ headerShown: false }} />` removes the auto header so the content starts 80pt higher | "Spacing a little off move up" |
| 2026-04-22 | `AAtwbwVxlQ70…` | screenshot | 🟡 | **F-63e** — Recipe detail ingredients row: long ingredient names were pushing the kcal column off-screen (e.g. rendering as "0 kc"). `ingredientName` now gets `flex: 1, flexShrink: 1`; `ingredientCalories` gets `flexShrink: 0`; row aligns `flex-start` with 8px gap | "Cals and macros and the coloured line not showing here" |
| 2026-04-22 | `AHS6xzyUumrl…` | screenshot | ✅ | duplicate of `AA63DQ7xd…` (already resolved). Verified 2026-04-22: `grep -r "score" apps/mobile/**/*.tsx` returns no product surfaces — tester's screenshot must predate or cache from an older build | "Score doesn't mean anything remove" |
| 2026-04-22 | `ANfXXs6H1qPP…` | screenshot | 🟠 | cluster **C11** — ops check required: web route `/api/edamam/search` returns 503 if `EDAMAM_APP_ID`/`EDAMAM_APP_KEY` unset on Vercel prod; mobile silently falls back to empty. Either (a) set keys in Vercel, OR (b) remove "Edamam" from `apps/mobile/app/nutrition-sources.tsx`. See action plan C11 | "Not sure if edamam is still connected as restaurant foods not showing" |
| 2026-04-22 | `AJNcZdalctgg…` | screenshot | ✅ | meta — tester self-verification ("Confirming build"); no code action | "Confirming build" |
| 2026-04-22 | `AEaTIZJodtNQ…` | screenshot | 🔍 | no comment — no actionable context | (no comment) |
| 2026-04-22 | `AKAyzCHqEBAE…` | screenshot | 🟡 | build-28 **F-52** — Discover hero + More-ideas row now render `image_url` when present (RN `Image` with gradient fallback) | "Recipes have finally come in but they don't have images on this page" |
| 2026-04-22 | `AJgeWQvRSt1v…` | screenshot | 🟡 | build-28 **F-55** — More-ideas rows gained 56×56 thumbnail; chef-hat box only on image-less rows (social-feed parity) | "Should all be like the two at the top with a pic etc. the more you might like is wrong" |
| 2026-04-22 | `ABMrc96mPkNp…` | screenshot | 🟡 | sibling of F-52 — Discover hero now uses the real image, not the gradient fallback | "Terrible image quality" |
| 2026-04-22 | `ABCjwJb4cU5U…` | screenshot | 🟡 | build-28 **F-51** — recipe-detail calorie hero shrunk (34→26, single-line composition, tighter padding) | "Cals section is huge and still wrong" |
| 2026-04-22 | `AA44j8pjh8tZ…` | screenshot | 🟡 | build-28 **F-53** — recipe-detail falls back to recipe-level totals when every ingredient has 0-nutrition (seeded recipes only carry recipe-level totals) | "None of the cals and macros are pulling in" |
| 2026-04-22 | `ALQ5grg-65Rh…` | screenshot | ✅ | meta — F-49 MARKER confirmed installed on build 26; no code action | "Confirming correct version before sending more feedback" |
| 2026-04-22 | `APUA9ZBFPysH…` | screenshot | 🟡 | build-27 **F-50** — HealthKit single-init (was splitting into two sheets; iOS skipped the second → no dietary perms → "Health access needed" dialog on every sync). Tester on build 26 screenshot, build 27 ships the fix | "Getting this error again" (HealthKit "Health access needed" dialog) |
| 2026-04-21 | `AKL4IQ_aQ2bX…` | screenshot | 🟡 | no code fix — build-16 install lag (F-32 avatars land there) | "Still not fixed" — Plan tab household card |
| 2026-04-21 | `AAOBOOX-2zyX…` | screenshot | 🟡 | build-17 F-36 (clamp Dynamic Type on pills) | "Pills are whether scrunched or huge" (Library filter row) |
| 2026-04-21 | `AH96GSgB4pjq…` | screenshot | 🟡 | build-17 F-33 (kill grey-band overlay) | "Images on this page look weird why are the grey half" |
| 2026-04-21 | `AAUjI8ZWEQKi…` | screenshot | 🟡 | build-17 F-35 (alert gains "not listed" fallback) | Suppr not listed under Settings → Health |
| 2026-04-21 | `ANmFiVpOfYEN…` | screenshot | 🟡 | build-17 F-34 (prompt + stripSectionPrefix) | "Duplicate unnecessary wording" (Verify ingredient prefixes) |
| 2026-04-21 | `AGOlc2wi1UZD…` | screenshot | 🟡 | build-15 F-27 (since-date label) + F-31 (goal-aligned tone) | "This is incorrect" — span + arrow-colour both addressed |
| 2026-04-21 | `AOCd89_asuNA…` | screenshot | 🟡 | build-14 F-24 (trimmed sparkline domain) | Weight for all time too scrunched up |
| 2026-04-21 | `AAtQgwFWaQTF…` | screenshot | 🟡 | build-15 F-29 (Regenerate) + F-32 (household card drift) | Regenerate + prototype language both addressed |
| 2026-04-21 | `AKhHD-Uv1JWd…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Library — all recipes showing same photo |
| 2026-04-21 | `AIoBkBBn3bgh…` | screenshot | 🟡 | infra — `OPENAI_API_KEY` rotated in Vercel 2026-04-21 | OpenAI API 401 on Instagram import |
| 2026-04-21 | `AIf4Z6q1KL2j…` | screenshot | 🟡 | build-14 F-23 (calories hero shrink) | Calories section is too big (recipe detail) |
| 2026-04-21 | `AJ2q4OgYYXE7…` | screenshot | 🟡 | build-14 F-25 (hide deficit on empty day) | Middle section cluttered with 3 prompts (Today) |
| 2026-04-21 | `AG-5oy-1vqo7…` | screenshot | 🟡 | build-15 F-26 (softer copy) + G-7 (crash) | HealthKit permission alert in production |
| 2026-04-19 | `AIe-YzITIaTX…` | screenshot | 🟡 | infra — `OPENAI_API_KEY` rotated in Vercel 2026-04-21 | Import error (OpenAI 401) |
| 2026-04-19 | `ABTpne3YnbHm…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Placeholder photos instead of imported photos |
| 2026-04-19 | `AGr4EisM3BOC…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Placeholder meals (Plan Day 1) |
| 2026-04-19 | `AJlhpO020UK-…` | screenshot | 🟡 | build-14 F-22 (labels) + build-15 F-28/F-30 (fiber + sugar/sodium/satfat via migration 20260430100000) | Correction form fields unlabeled; can't correct full nutrition label |
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
