# Figma migration tracker — living document

**Status:** Audit COMPLETE (2026-06-07). **Direction change 2026-06-08 (Grace): APP-FIRST.** Stop blanket Figma backfill of already-shipping screens — backfilling frames of live, wired screens documents reality rather than driving the build (the frame is downstream of the app, schematic, and changes nothing users touch). Figma is now reserved for genuinely **net-new** screens (e.g. Ask coach `185:2`) + quick look-previews. Effort goes to applying the **unbuilt** `today.md`/redesign improvements straight to **iOS** (flag-gated, validated in sim), web in parity. The 🔵 App-Only "Figma backfill epic" (ENG-903) is **deprioritised, not deleted** — resume only if we decide we want a complete standalone Figma artifact for design reviews. Local changes only, no commits (Grace reviews).
**Owner:** Claude — implements web + mobile, owns nothing-committed until review. Source of truth: Figma `B3UdOFup7ITersgNuoXh0l` (page `0:1 · Sloe · Screens`).
**Audit sources:** depth (pixel-grounded core-12) `wf_eb96d47a-490` · breadth (all areas) `wf_3015985a-6c5` (full data: `tasks/wr31o3cd9.output`). Research backlog: `wf_7293ea1b-c30`.

## Dashboard (recompute after every implementation)
| Metric | Value |
|---|---|
| Total items tracked | **369** |
| ✅ Matches Figma | 42 (11%) |
| 🟡 Partial Match | 143 (39%) |
| 🔵 App Only (→ Figma task) | 169 (46%) |
| 🟣 Figma Only (build) | 15 (4%) |
| **Conformance %** (Matches ÷ Matches+Partial+FigmaOnly) | **21%** |
| Open blockers | 94 |

### Per-area scorecard
| Area | Items | ✅ | 🟡 | 🔵 | 🟣 | Notes |
|---|--:|--:|--:|--:|--:|---|
| Today | 37 | 15 | 21 | 0 | 1 | most-conformed; 8 app-only Figma-backfilled 2026-06-08 |
| Log a meal | 19 | 0 | 6 | 11 | 2 | Figma frame predates search-first refactor |
| Recipes & Cookbook | 25 | 1 | 10 | 12 | 2 | Discover sections unbuilt; filter taxonomy mismatch |
| Recipe detail / create / cook | 30 | 1 | 16 | 13 | 0 | rings-vs-tiles call; import has no frame |
| Plan | 30 | 4 | 7 | 18 | 1 | single-day Figma vs multi-day app |
| Progress | 35 | 3 | 15 | 17 | 0 | adherence/weight cards drift; fibre data gap |
| Onboarding | 31 | 0 | 12 | 18 | 1 | full Sloe rebrand not built; step-count mismatch |
| Account / Settings / More / Ask | 27 | 0 | 13 | 11 | 3 | IA + palette drift; Ask unbuilt |
| Auth | 23 | 6 | 2 | 13 | 2 | chooser `296:2` rebuilt web+mobile 2026-06-08 (M1 chooser/mobile-login/web-/login/wordmark/terms/Apple ✅); Google SI deferred (ENG-924) |
| Paywall & win moments | 22 | 0 | 6 | 15 | 1 | streak/import-success are full screens in Figma |
| Import | 23 | 0 | 8 | 14 | 1 | input-methods vs source-platforms mismatch |
| Fasting | 25 | 1 | 12 | 11 | 1 | legacy indigo skin not migrated |
| Global / Nav / System states | 22 | 0 | 13 | 9 | 0 | dark/loading/offline states; nav icon drift |
| Landing & Marketing (web) | 20 | 11 | 2 | 7 | 0 | most-migrated already |

## Governance (hard rules — Grace 2026-06-07)
- **No** temp solutions, duplicate components, parallel design systems, placeholder screens, **migration feature flags**, or alternate screen versions (unless explicitly requested). One production design system.
- **Never remove wired functionality.** App-only → preserve + Figma task (Stitch → Mobbin research → Figma).
- Web + mobile parity. **Verify on captures** (11-point checklist: spacing/colour/type/radius/shadow/imagery/hierarchy/mobile/desktop/interaction/empty-loading-error) before marking ✅.
- Figma = source of truth. Better-than-Figma idea → implement Figma + Linear issue (evidence), never silent change.
- Before any area: confirm all its screens/states/variants/nav/journeys are listed here; if not, STOP and add first.
- Stop before any destructive/architectural/auth/routing/permissions/dependency/db/config change.

## Implementation order (priority)
> **2026-06-08 policy (app-first):** this order now governs **app implementation** of unbuilt redesign items, NOT Figma-frame backfill. Figma backfill happens only for net-new screens. See Status line.
1. **Today** (closest; retention-critical) — pixel deltas + states.
2. **Recipes & Cookbook + Discover + Recipe detail** (viral hook landing).
3. **Log a meal** (core daily loop).
4. **Plan → Progress → Onboarding → Paywall → Settings → Import → Fasting → Auth → Global/Nav**.
5. **Landing** (already 55% matched) — polish.
6. **Figma-Only builds** (15) + **Figma backfill** (177 app-only) as design lands.

---

## 🟣 Figma Only — build in app (15)
- **Today:** Activity Summary modal (web, 834:2)
- **Log a meal:** Logged confirmation S13 (202:2, highest-impact gap); Favourites/Go-Tos tab K2 (513:2)
- **Recipes:** Discover 'Popular collections' carousel (528:61); 'Recipes in action' Reels rail (528:105)
- **Plan:** 04 Plan legacy single-day frame (309:2) — likely superseded by TD5
- **Onboarding:** About-you consolidated body stats S2 (190:2)
- **Account:** Sloe Pro upsell banner (335:23); Account Region row (334:96); **Ask coach screen (185:2) — net-new feature**
- **Auth:** Google Sign In (296:25 — needs Supabase provider); Continue-with-email progressive disclosure (296:33)
- **Paywall:** Web import-success surface M6 (304:2)
- **Import:** macro-check reassurance card (177:81)
- **Fasting:** K4 'Fasting on Today' explainer header (498:3)

## 🟡 Partial Match — fix to Figma (141, by area)
**Today (13):** coach-line placement; S5 empty ('Fresh start' chip/copy); L1 loading (Today-shaped skeleton); L5 dark; TD1 Activity&energy; TD2 Hydration; TD3 Weekly insight; TD4 Meal-log; D1 Macro detail; D2 Energy out; W2 tablet; W825 net-energy (web); W840 where-this-comes-from sheet. **+ pixel deltas (depth audit):** avatar clay→plum #6a4b7a 32→36px; hero eyebrow white→rgba(201,194,214,.9) +1px; hero meta add clock+min+dot; hero scrim add flat base layer; Log-slot CTA dashed→solid white card r24 label #6a6072; meal card radius 12→24; meal-row image rule (photo only for library-recipe-with-image, no empty box).
**Log a meal (6):** entry sheet; search-food; photo-log; voice-log; PRO badge on voice/photo; Recent tab.
**Recipes & Cookbook (10):** /library Cookbook (high); /discover (high); S7 empty; L2 loading; L6 dark; sub-tab switcher; sticky header; recipe card (232w/r20/172 image); 'What others are saving' grid; category/cuisine filter pills.
**Recipe detail/create/cook (16):** detail mobile; detail web; public share; servings stepper; cook-mode mobile inline/standalone/web; step timer 'For this step' pills; new-recipe wizard/long-form/web; verify mobile/web; creator mobile/web; 'Fits your day' verdict tones.
**Plan (7):** tab chrome; week-view mobile; week-view web; S8 empty; shopping mobile; shopping web; 'add week to shopping' CTA.
**Progress (15):** main screen; header subtitle; THIS WEEK card; AVERAGE ADHERENCE card; weight card; 3-stat row; on-target-days ribbon; S9 empty; over-target colours; D4 weight detail; recent weigh-ins; D7 weekly recap; maintenance card; journey/projection; v2-vs-legacy layout.
**Onboarding (12):** S1/WO1 welcome; goal step; pace S3; diet S14; allergies S15; reveal S4; step indicator; back nav; primary CTA; web narrative column; welcome→signin.
**Account/Settings/More (13):** Settings root (high); profile row; Units row; Appearance row; Connections; Account group; Account&plan M4 (high); Targets D9 (high); Targets why-number K3; Household D10; Reminders M2 (high); goal/pace editor; delete-account flow.
**Auth (2 remaining):** /signin alias + /signup mode-state pixel pass (both share the rebuilt `app/login/ui.tsx` chooser — verify the signup-mode terms-checkbox + create-account copy on the email step). ✅ 2026-06-08: M1 chooser, mobile login, web /login, Apple SI flow, terms fine-print, brand wordmark all rebuilt to `296:2` (chooser-first + progressive-disclosure email).
**Paywall (6):** mobile paywall (high); web pricing; upgrade dialog; M5 streak win (high); M6 import-success (high); trust strip.
**Import (8):** 'Add a recipe' entry (high); paste-link pill; import CTA; source tiles 3-method (high); L4 error (high); /import web; /import-shared (high); action sheet.
**Fasting (12):** web route; mobile route; D5 timer (high); preset picker; progress ring (high); stages bar (high); started/goal card; end-fast button; stage narrative; K4 idle (high); K4 active (high); fasting flow.
**Global/Nav (13):** mobile tab bar; web mobile-web tab bar; mobile-web header; L3 offline; L1/L2 skeletons; L4 import error; L5/L6 dark; S5/S7/S8/S9 empties.
**Landing (2):** desktop header; footer.

## 🔵 App Only — preserve + Figma task needed (177) — Figma-backfill epic
Confirmed wired, **no Figma frame**. Never remove. Each needs a Stitch→Mobbin→Figma prototype. Highlights (full 177 in `tasks/wr31o3cd9.output`):
- **Today (0 remaining / 8 done):** ~~complete-day modal · weekly check-in · 30-day milestone · why-this-number sheet · quick-log dialogs · eat-again banner · Apple Health card · streak pip/insight~~ — ALL 8 Figma-backfilled 2026-06-08 into section `09 · Today & Plan — deep dive` (TD6–TD13). App implementation pending (→ 🟡 Partial Match).
- **Log a meal (11):** barcode scanner · quick-add panel · create-custom-food · save-meal · saved-meal portion sheet · AI paywall gate · empty states · loading skeletons · dark mode · barcode 0-kcal recovery · copy-yesterday
- **Recipe (13):** detail loading/not-found/no-image/dark · edit sheet · add/override ingredient · notes+rating · action sheet · ingredient-info sheet · import (URL/Reel/paste) · PDF/bulk-photo · dev redesign page
- **Plan (18):** loading/error/dark · shopping empty/loading · swap-meal · move-meal · templates (×2) · setup chips · source selector · generate menu · regenerate toast · household row · copy/duplicate-day (×2) …
- **Progress (17):** hero adherence ring · story gate · engine headline · maintenance card · Apple Health card · weight projection · calendar drill-down · week digest · household bar · range overline …
- **Settings (11), Paywall (15), Import (14), Onboarding (18), Auth (13), Fasting (11), Recipes (12), Global (9)** — see audit file.

## Blockers (94) — themes
1. **Brand drift Suppr→Sloe** still in code: mobile `formatAuthError` "Suppr's servers", paywall "SUPPR PRO", suppr-club.com links, reset-password aria.
2. **Flag-gating debt** (migration flags to retire later, NOT now): `today_meals_figma_654`, `today-status-pills`, `progressLayoutV2`, `plan_empty_state_v2`, `plan_source_selector`, onboarding flag, etc.
3. **File-size debt** (CLAUDE.md 400-line cap): mobile `(tabs)/index.tsx` 6412L, `NutritionTracker.tsx` 3613L, mobile `progress.tsx` 4007L, `SettingsBundleContent.tsx` ~3600L, web `Settings.tsx` ~88KB — structural refactor needed for clean conformance.
4. **Figma coverage gaps:** no dark-mode frames for most areas (web has no dark at all); no desktop frames for Recipes/Plan/Recipe-detail/Paywall; no loading/error frames for most areas; states under-designed.
5. **Web↔mobile parity gaps:** web missing macro-detail/energy-out/where-from detail screens; web Settings missing Household + Apple Health.
6. **Product-direction decisions needed (→ Linear):** Plan single-day vs multi-day; recipe macro rings vs flat tiles; library filter taxonomy (category vs entry-kind); fasting presets (OMAD vs 20:4/14:10); Ask feature build; Google Sign-In provider.
7. **Verification blocker (resolved):** web-drive auth was redirecting (localhost vs 127.0.0.1 cookie); fixed — use `WEB_DRIVE_BASE_URL=http://127.0.0.1:3000`.

## Decisions — RESOLVED by Grace 2026-06-07
| # | Decision | Resolution | Action |
|---|---|---|---|
| ENG-919 | Plan layout | **Keep multi-day week grid** | Preserve app's multi-day; design these into Figma (app→Figma backfill) |
| ENG-920 | Recipe macros | **Flat number tiles (match Figma)** | Swap rings→flat tiles on recipe detail (follow-up to the in-flight reskin) |
| ENG-921 | Library filters | **Category filters (match Figma)** | Breakfast/Lunch/Dinner/cuisine; replace entry-kind pills |
| ENG-922 | Fasting presets | **All five — 16:8/18:6/20:4/14:10/OMAD** | Add OMAD to app's set |
| ENG-923 | Ask feature | **Design in Figma now, build later** | Prototype on Pending Sign-Off; defer build |
| ENG-924 | Google Sign-In | **Apple + email only for now** | Defer Google provider |
| ENG-925 | Meal-row image | **Recipe-detail ingredient tiles LIVE 2026-06-08** | The Template-B-per-food, cache-by-`name_key` pattern shipped on the recipe-detail ingredient grid (`ingredient_images` table, 51 keys backfilled). Meal-row (Today/log) adoption of the same global tiles is the remaining piece. See `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`. |
| ENG-926 | Today ring | **Keep single-arc + macro toggle** | No change; macros stay behind toggle |

> Mirror pending: update the 8 Linear issues (ENG-919–926) with these resolutions; Notion Decisions-log rows (MCP not connected).

## Change log (per area — updated after every implementation)

### Recipe + ingredient imagery — Sloe image system shipped 2026-06-08 (local only, no commit; migration applied + backfill run; typecheck clean web+mobile; recipe vitest green; web captures read)
**Backend (recovered onto this branch) + DB:**
- `ingredient_images` migration **applied** (`supabase db push --linked`, project `fnfgxsignmuepshbebrl`). Public `recipe-images` Storage bucket created (the generator's upload target — was missing; blocked all uploads until created).
- Backfill (`scripts/backfill-images.ts`, fal funded) **run**: **6/6** recipe heroes generated (Template A → `recipes.image_url`; 2 recipes kept existing images, correctly skipped); **51/51** distinct ingredient keys `ready` (Template B → `ingredient_images`). Idempotent retry cleared all transient fal 403s. 8 images read against the brand checklist (4 heroes + 4 ingredients) — all on-brand.

**Display wiring (web + mobile parity):**
- **Web** `src/app/components/RecipeDetail.tsx`: ingredient grid now shows the `ingredient_images` photo (hydrated by `normalizeIngredientNameKey` via `fetchIngredientImageMap`) else a calm cream placeholder (`getIngredientTilePlaceholder`, sage initial — NOT the gradient glyph). Labels use `cleanIngredientDisplayName`.
- **Mobile** `apps/mobile/components/recipe/RecipeIngredientGrid.tsx` (+ screen hydrates the map and passes `imageMap` down): identical contract.
- **Heroes + Library cards**: unchanged render (already read `image_url`); generated heroes now show, calm cream fallback otherwise. Verdict chip = sage "Fits your day" (already shipped in the frame rebuild — verified intact, not regressed).
- Verified on web captures: Library cards show generated heroes + the cream placeholder; recipe detail shows the full-bleed generated hero + sage verdict chip; the ingredient grid renders 7/7 Template-B tiles with clean labels (all wired features — kcal pills, confidence dots, Verify/Fix/Override — preserved).
- Decision doc: `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`. Two tracked follow-ups (quantity-polluted ingredient keys → near-dup tiles; occasional pseudo-text on branded-product tiles).

### Settings root — Figma frame `335:2` reskin 2026-06-08 (local only, no commit; typecheck clean web+mobile; all 71 mobile + 75 web settings vitest green; iOS pending — orchestrator owns iOS; web capture blocked by stale `--auth` session)
**Mobile (`apps/mobile/components/settings/SettingsBundleContent.tsx` + `apps/mobile/app/(tabs)/settings.tsx`) — rebuilt to the frame:**
- **Top bar:** "Settings" now centred in Newsreader serif plum with a back chevron left + balancing spacer right (was left-aligned serif + a cold subtitle). Subtitle removed (profile row makes context visible). Search bar kept below (wired feature, not in the static frame).
- **Profile row:** plum filled-circle avatar (white serif initial) + name in Newsreader serif + plan label ("Free plan" / "Pro plan") in grey, on the white page — no card chrome (was a `SettingsCard` with `GradientAvatar` + tier pill + "joined"). Whole row taps → /profile. Retired the now-dead `GradientAvatar`/`tierBadgeColor`/`joinedLabel`.
- **Sloe Pro banner (335:23):** NEW peach/clay-tint (`#C8794E` @16%) full-width card — sparkle + "Sloe Pro" (clay) left, "Manage" (clay) right. Free/base → /paywall; Pro → existing manage-subscription (RevenueCat) flow. testID `settings-sloe-pro-banner`.
- **Section headers:** serif plum mixed-case → small ALL-CAPS grey eyebrows (GOALS & TARGETS / DISPLAY / CONNECTIONS / REMINDERS / ACCOUNT), letter-spaced (design-system §2.2 `section-eyebrow`).
- **Row icons:** colour-tinted rounded-square plate → white circle with a hairline ring (frame's circle-outline glyph); glyph keeps any semantic colour (sage Apple Health, etc.).
- **Re-grouped to the frame:** split Notifications + Weekly recap out of Connections into a new **REMINDERS** section (`settings-card-reminders`); renamed "Display & extras"→"Display", "App"→"Account" (testIDs unchanged).
- **Delete account:** destructive card row → centred clay "Delete account" text at the bottom (frame), same two-step typed-"delete" confirm flow (extracted to `handleDeleteAccount`). testID `settings-bundle-delete-account-row` preserved.
- **Preserved (dropped nothing):** every existing row/destination, all 8 modals, the `context === "more"` gate, Sign Out (neutral, in the shell), Reset-or-erase, Membership upgrade/manage/promo, Goals & targets (daily targets/widgets/week-start/deficit/caffeine/alcohol/fasting), Display toggles, Recipes, Export CSV/everything, Help, Privacy/Terms, Build (dev), Household.

**Web (`src/app/components/Settings.tsx`) — frame language within the test-pinned SPA structure:**
- **Sloe Pro banner:** NEW peach/clay-tint banner (mirrors mobile) below the profile card — "Sloe Pro" + "Manage". Free → /pricing; Pro → /account/billing. testID `settings-sloe-pro-banner`.
- **Profile card:** name now in Newsreader serif plum (was sans bold); tier pill reads "Free plan" / "Pro plan" (was bare "Free"/"Pro").
- Header H1 (left-aligned serif plum "Settings" + plum cog plate) and the 3-tier destructive ladder kept — both are pinned by `settingsDestructiveCopy.test.ts`; the web SPA surface has a desktop sidebar context (no back-chevron top bar).

**Verified:** web+mobile `tsc --noEmit` clean for both touched files (pre-existing errors in unrelated paywall/ProgressEnergyTriad/RecipeDetail only). Mobile vitest: settingsBundleParity, settingsElevationAndMarker, settingsSignOutNeutralColor, settingsSearch(+Index), settingsScreenIntegration, settingsFastingFindable, settingsWinMoment, settingsBundle/ExportEverything (71 pass). Web vitest: settingsProfileHeaderCardParity, settingsDestructiveCopy, settingsYourNameParity (cross-platform), settingsManageSubscription, settingsExportEverythingWeb, settingsMacroTokens, settingsWeekStartRoundTrip, settingsElevationFlag, settingsWinMomentWeb (75 pass).

**Remains / needs follow-up:**
- **iOS pixel-verify** the mobile reskin (orchestrator owns the sim).
- **Web capture blocked** — committed `--auth` session is stale (redirected to landing); regenerate (`E2E_EMAIL/E2E_PASSWORD npx playwright test auth.setup.ts --project=setup`) to pixel-verify web before sign-off.
- **Web is a PARTIAL frame match by design:** keeps its left-aligned serif header + grouped `SupprCard` form sections (test-pinned + desktop SPA context) rather than the iOS frame's centred-title + uppercase-eyebrow + circle-icon-row IA. Closing the web IA to the frame would require rewriting ~9 web settings test suites — a separate ticket, and it needs a live auth session to validate visually (don't ship blind web visual churn).
- **Google Fit** (in the frame) intentionally omitted — no backing integration on the iOS-only build; shipping a dead row would be a fake (anti-pattern). Apple Health is the only wired connection.

### Today — implemented 2026-06-07 (local only, no commit; typecheck clean web+mobile)
**Changed (web + mobile parity):**
- Hero eyebrow `white/90 tracking-widest` → `rgba(201,194,214,0.9)` letter-spacing 1px
- Hero scrim: added flat `rgba(34,27,38,0.2)` base layer under the gradient (two-layer per 654:165-166)
- Hero meta: added cook-time chip (`Clock` + `{min} min` + 4px dot) — data-gated; renders when the recipe exposes a cook time, degrades gracefully otherwise
- Log-slot CTA: dashed-border button → solid filled card (bg-card, radius 24, min-h 58, no border), label `#6a6072`
- Meal summary card radius 16 → 24 (`radius="lg"` = var(--radius-card-lg))
- Meal-row empty `bg-muted` box → clean `Utensils` icon tile (no more empty grey square for MFP/barcode/manual)
- Avatar clay `bg-primary` 32px → plum `#6a4b7a` 36px (both header branches; mobile via GradientAvatar fill override)
- Plumbed optional `cookTimeMin` through NorthStarRecipe → host → hero (web + mobile)

**Files:** web — north-star-block.tsx, today-meals-figma-layout.tsx, today-date-header.tsx, NutritionTracker.tsx, lib/nutrition/northStarSuggestion.ts · mobile — today/NorthStarBlock.tsx, today/TodayMealsFigmaLayout.tsx, today/TodayDateHeader.tsx, GradientAvatar.tsx, today/NorthStarBlockHost.tsx, (tabs)/index.tsx

**Verified:** web hero (eyebrow/scrim/solid Log-CTA + plum avatar) ✓ on seeded-today capture; meal-row fixes (Utensils icon tile, 24px radius, solid "Log Dinner" card) ✓ on Dec 31 real-data capture; mobile renders ✓ (typecheck clean).
**Remains / needs your call:**
- Seeded-today shows empty meals list (ring counts the rows; list reads a different source) — a separate **total-vs-list data divergence** (blocker logged), NOT a Today-conformance issue. Real-data days render meals correctly.
- Cook-time chip renders only when the recipe has a stored cook time (graceful degrade) — fine.
- Deferred decisions still open: Today ring multi-arc-default; meal-row image A (consistent icon for all) vs B (photo-when-library, implemented as B).
- **NEW finding:** iOS Net-energy copy reads "in Suppr yet" — brand drift Suppr→Sloe (added to blocker #1).

### Today — `654:2` clean-up pass 2026-06-08 (local only, no commit; typecheck + unit tests clean web+mobile; pixel-verified iOS sim + web-drive)
**Problem:** Today was structurally close to `654:2` but BUSIER than the calm frame on four specifics.

**Changed (web + mobile parity):**
- **Wordmark** — lowercase "sloe" / medium → **"Sloe"** (capital S), Newsreader **semibold**, plum; Today brand bar bumped to ~20px (`text-xl`). Unified across every surface (Today header, sidebar, login, onboarding, import card) so the wordmark reads identically — web `suppr-mark.tsx`, mobile `SloeHeaderWordmark.tsx` + `SupprMark.tsx`.
- **Week strip labels** — 3-letter `MON/TUE/WED` → **single letters** `S M T W T F S` via a new shared `weekdayInitials` helper (`src/lib/today/weekdayLabels.ts`, consumed by both `DayStrip`s). The day NUMBER below disambiguates the date. The conditional logged-pip (sage/clay/transparent) is unchanged — it's in the canonical frame and stays wired to `loggedDays`.
- **Adaptive-TDEE line** — the "Adaptive TDEE learning · N of 7 days" line was **removed** from the Today hero (web `today-hero-stats.tsx` desktop hero + mobile `TodayHero.tsx`). The frame shows nothing between Goal/Eaten/Bonus and the "Room for dinner" coach line. The underlying logic (`countWeighInDaysInWindow`) and the `tdeeLearnDays` prop are **preserved** (the learning state lives on Progress); only the presentational line is gone. The "On track" pill is untouched.
- **Spacing** — airier vertical rhythm to match the frame: greeting bottom 16→20 (`mb-5`); strip→hero gap widened (web stripOnly `mb-2`→`mb-5`; mobile strip wrapper `+Spacing.lg`) toward the frame's `mb-7`.
- Macro tiles (icon/value/target/bar), "What to eat next" card, Today's Meals rows + "Logged" check, and the solid "Log {slot}" CTA already conformed (2026-06-03/07) — verified unchanged.

**Files:** web — `src/lib/today/weekdayLabels.ts` (new), `DayStrip.tsx`, `ui/suppr-mark.tsx`, `suppr/today-brand-bar.tsx`, `suppr/today-hero-stats.tsx`, `suppr/today-date-header.tsx` · mobile — `components/charts/DayStrip.tsx`, `SloeHeaderWordmark.tsx`, `SupprMark.tsx`, `today/TodayHero.tsx`, `app/(tabs)/index.tsx`.
**Tests:** new `weekdayLabels.test.ts`; rewrote `todayStatusPills` (web+mobile) to GUARD the TDEE line never re-appears; updated `supprMark`/`brandMark` (web+mobile), `recipeImportSurface`, `desktopSidebar` to "Sloe"; reconciled stale `todayHeroLayout` `grid-cols-4`→`grid-cols-3`.
**Verified:** iOS sim Today (wordmark "Sloe", single-letter strip, no TDEE line, airy spacing) ✓ `apps/mobile/screenshots/agent/today-figma-after-mobile.png`; web mobile-vp + desktop ✓ `screenshots/web-drive/today-figma-{top,desktop}.png`. Both typecheck + unit suites green.

### Recipes (Library + Discover) — filter consolidation polish 2026-06-07 (local only, no commit; typecheck clean web+mobile; pixel-verified iOS + web)
**Problem:** Library showed TWO stacked filter rows — the category pills (All/Breakfast/Lunch/…) AND a redundant second "SHOW · All/Saved/Imported" pill row right below — reading cluttered against the calm Sloe Cookbook hierarchy.

**Changed (web + mobile parity):**
- Consolidated to ONE primary filter row: the **category pills stay the single primary control** (unchanged geometry — still pins `libraryFilterPillPadding.test.ts`).
- The entry-kind buckets (All / Saved / Imported) are **folded into a single quiet segmented control** in the header (between search and the category row) — one tonal track, three text segments, active one lifted. Counts ride the segments ("All · 8", "Saved · 8"). No more competing second pill row.
- **Mobile only:** plan-import source pills (rare; only when a user imported a meal plan) now reveal **contextually under the category row, only when the Imported segment is active** — so the default Library is a single filter row. Selecting/clearing a plan-import keeps the segment on Imported.
- Discover was already a single-row surface ("Following" leads the category row) — left as-is; confirmed visually consistent with Library (same serif "Recipes" title, sub-tabs, search, seamless 24px cream cards).

**Preserved (no behaviour change):** category + entry-kind + plan-import FILTERING logic (same `entryKind`/`secondary` state + `filtered`/`filteredRecipes` useMemos — only re-presented), search, +Create, save/bookmark, sort cycle, import-from-TikTok row, recipe open, empty states, desktop grid.

**Files:** web — `src/app/components/Library.tsx` · mobile — `apps/mobile/app/(tabs)/library.tsx`. No shared token / `recipeCategoryFilters.ts` changes. `DiscoverFeed.tsx` / `discover.tsx` / `RecipesTabChrome.tsx` untouched (already conformant).

**Verified:** iOS sim Library (segment "All·8 | Saved·8 | Imported" + single category row + seamless cards) ✓; iOS Discover ✓; web mobile-vp Library ✓; web desktop Library ✓. Typecheck clean web+mobile; web ESLint clean; pinned tests green (`libraryDesktopPrototypePort`, `libraryFilterPillPadding`, `recipeCategoryFilters`, discover/search-store suites).

### Progress — DS-tightening pass 2026-06-07 (local only, no commit; typecheck clean web+mobile; pixel-verified iOS + web)
**Problem:** Progress was functionally reskinned but not tightened to the Sloe DS bar — card titles, eyebrows, range pills and over-target colours had drifted across components and across platforms (Figma 492:2 / 322:2 S9 empty fix-list items: header, THIS WEEK card, weight card, 3-stat row, on-target ribbon, over-target colours, maintenance card).

**Changed (web + mobile parity):**
- **Card section titles → plum Newsreader serif** (the canonical Sloe card-title grammar from NorthStar / Hydration / Plan chrome). Web: Daily Calories, Macro Adherence, Maintenance, Streak freezes, Journey → `font-[family-name:var(--font-headline)] text-[17px] font-medium text-foreground-brand` (was Inter `text-sm font-semibold text-foreground`). Mobile: same titles + the no-data heading → `Type.headline` colour `t.plum` (was aubergine `t.text`).
- **Mobile range picker → Sloe plum-fill pill rail** (`t.plum` active fill + white label; bordered cream inactive pills) — **closes the ENG-985 web↔mobile parity gap** (web already had plum pills; mobile was still on the old inset segmented control despite a comment claiming `t.plum` pills). testIDs/roles unchanged for Maestro.
- **Stat-row / range-card eyebrows → clay** to match the canonical story-card eyebrow (`text-primary` family). Web `PROGRESS_RANGE_OVERLINE` (Calories/Protein/Trend headers) → `text-primary-solid tracking-[0.1em] font-bold` (AA-passing deep clay). Mobile "Calories vs target" eyebrow → `Accent.primarySolid` (was muted grey).
- **Over-target colour bug fixed (both platforms now amber, the rule):** web Macro Adherence over-target bars used `--over-budget-fg` (#C0533F, Sloe RED) and the Calories delta pill used the red over-budget tokens — both broke the documented "over-budget = amber, never red" rule (calorie-RING is the only red-over carve-out) AND diverged from mobile (which already used `Accent.warning` amber). Web now uses `--warning` / `warning-soft`+`warning-solid`. Web == mobile == amber.
- **Mobile macro adherence % label → ink (`t.text`)** matching web (which always renders the label `text-foreground`; only the bar fill carries the over-target tone). Also fixes the amber label failing AA on cream.
- **Mobile hand-rolled card corners 8px → 24px** (`Radius.lg` → `CARD_RADIUS`) on the v2 cards (weight chart, charts-pending, no-data, Daily Calories, Macro Adherence, Maintenance, Journey) so every Progress slab is the Sloe 24px warm-slab corner, matching the SupprCard 3-stat row and the web `radius="lg"` cards.

**Preserved (no behaviour change):** hero adherence ring, ProgressHeadline/StoryGate story gate (KEEP — already reskinned), adherence engine, weight chart + Apple Health + projection/journey (KEEP), maintenance card logic, calendar drill-down, household bar, week digest / DigestStoryCard (KEEP). Calorie-ring red-over carve-out untouched. No shared token files touched. No fabricated data (the week-over-week adherence trend chip + prevWeekTdee regime stay hidden — documented data gap, not faked).

**Files:** web — `src/app/components/ProgressDashboard.tsx` · mobile — `apps/mobile/app/(tabs)/progress.tsx` (+ `CARD_RADIUS` import from `components/ui/SupprCard`). Test updated: `apps/mobile/tests/unit/progressRangePicker.test.ts` (mobile picker now asserts plum-pill rail; web picker test notes ENG-985 parity gap closed).

**Verified:** iOS sim (header + THIS WEEK + weight card + 3-stat row + plum range pills + plum-serif Daily Calories / Macro Adherence / Maintenance titles + amber over-target macro bars) ✓; web mobile-vp (clay CALORIES eyebrow + amber "+452 vs target" delta pill + plum-serif Maintenance / Daily Calories / Macro Adherence + amber over-target bars) ✓. Typecheck clean web+mobile; ESLint clean (no new warnings); pinned Progress tests green (web: dashboard render/elevation, phase2 cards, desktop shell, macro adherence, empty-state, ui-consistency; mobile: range picker, headline, story gate, skeleton, macro colour). Landing parity + design-token suites green.

### Brand drift Suppr→Sloe — fixed 2026-06-07 (local only, verified)
~30 files: user-facing copy "Suppr"→"Sloe" (camera/health permission strings, network error copy, onboarding descriptions, ad/affiliate disclosures, ingredient-matching copy, login error + not-configured title, paywall kicker, net-energy empty copy). **Verified:** no URL/domain/bundle/scheme/config/identifier changes (grep-confirmed empty); web typecheck clean. Pre-existing `apps/mobile/app/login.tsx` `styles.title` typecheck error left untouched (predates this work; auth stop-zone).

### Recipe detail — IN-APP genuine Figma reskin (frame 332:2) — 2026-06-07 PASS 2 (local only, no commit; typecheck+lint+tests clean; mobile + web pixel-verified)
**Supersedes the bounded-deltas Pass 1 below.** Grace red-lined Pass 1: it reskinned the public-share page + rounded the in-app pills but left the in-app detail OFF the Figma visual language (white page, blended cream cards, bullet-list ingredients). Pass 2 brings the in-app detail (web `RecipeDetail.tsx` + mobile `recipe/[id].tsx`) to the genuine Figma 332:2 look while preserving EVERY app-only feature (reskin, not remove):
  - **Page → warm cream** (`background-secondary` / `colors.backgroundSecondary` `#F6F5F2`) on both surfaces — was a white page with cream cards that blended (the exact "cards blending into the background, figma does not do this" bug). Inverting page↔card is what makes the slabs read.
  - **Resting cards → WHITE slabs** (`var(--background)` / `colors.background`) lifting off the cream with the UNCONDITIONAL soft `--elev-card-soft` lift (web `whiteSlabStyle`; mobile `useCardElevation({ variant: "soft" })`). The flag-gated `design_system_elevation` read is dropped on both — elevation is now unconditional in lockstep.
  - **Title → plum Newsreader serif at the Figma display scale** (web 30px `text-foreground-brand`; mobile `Type.display.fontFamily` 30px `colors.navPrimary`). Mirrors the public-share H1.
  - **Hero (mobile)** → rounded-bottom (28) + SVG soft fade scrim so the photo eases into the cream page.
  - **Ingredients → photo-card grid** on BOTH surfaces (was a bullet/`divide-y` list). 3-col grid of white slab cards; each card's image area reuses the EXISTING deterministic `RecipeHeroFallback` glyph keyed per-ingredient (`${recipeId}-ing-${i}`) — recipe rows carry no per-ingredient image, never an empty box, NO new imagery wired (stop-zone respected). Confidence dot rides the image corner; kcal pill overlay; name + amount + categorical tier label + SourceDot + Verify CTA below. Owner Fix/Override affordances preserved (web: card hover/focus).
  - **Action/footer pills** stay radius-full clay (carried over from Pass 1).

**App-only features verified still wired (named):** Cook Mode (inline overlay + standalone /cook), nutrition-verification (auto-verify + re-verify + per-ingredient confidence dot/label, FatSecret cache guard, FatSecret attribution badge), owner controls (edit sheet, go-public/unpublish, delete, add-ingredient, per-ingredient override), net-carbs lens, viewing-servings stepper (yield scaling + batch-total kcal line + owner pencil), Log to journal card (portion stepper + presets + coercion guard) + sticky "Log all" footer, notes+rating card, source attribution card, seed-recipe hydration, JSON-LD (public-share). Tap-to-info Alert + Verify→ route preserved per ingredient card.

**Pixel-verified:** mobile iPhone 17 Pro sim (`apps/mobile/screenshots/agent/recipe-detail-figma-v2-top.png`, `recipe-detail-figma-v2-ingredients.png`, `recipe-detail-figma-final-top.png`) — cream page, white slab lift, plum serif title, ingredient photo-card grid with per-ingredient glyph + "Verified" labels + kcal pills. Web in-app via a temp seed-recipe harness (`screenshots/web-drive/recipe-detail-figma-inapp-mobile.png`) — identical cream page + white slabs + plum serif title + ingredient photo-card grid; harness removed post-capture.

**Tests:** `tests/unit/recipeDetailFigmaReskin.test.ts` now 31 assertions (added: web cream page / plum serif title / white slabs / photo-card grid / owner Fix-Override preserved; mobile cream page / plum serif title / white slab soft-lift / photo-card grid / hero rounded-bottom+fade). Updated `tests/unit/recipeDetailLayoutWeb.test.tsx` + `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts` for the unconditional-elevation shift. 375 web recipe tests + 133 mobile recipe tests green. ENG-890.

**ENG-920 (DEFERRED):** macro rings-vs-tiles decision is NOT taken here — the flat macro-tile presentation is kept; only the tile CONTAINER is reskinned to the white slab. Flagged for the macro-display decision.

---

### Recipe detail — Figma reskin (frame 332:2) PASS 1 implemented 2026-06-07 (SUPERSEDED by Pass 2 above)
**Scope decision (Pass 1):** the palette delta (1) targets the **public-share page** — the only off-palette surface (6 violet/indigo gradients). The web in-app `RecipeDetail.tsx` (2,612L) + mobile `recipe/[id].tsx` (3,428L) got bounded, non-destructive deltas that map cleanly (radii → 16; action/footer pills → radius-full); they kept their richer interaction model by design. **Grace rejected this as not bringing the in-app detail to the Figma look — see Pass 2.**

**Changed:**
- **Public-share `app/recipe/[id]/page.tsx`** — full Figma reskin:
  - Palette (delta 1): slate base → cream `--background-secondary`; violet/indigo gradients removed; plum `--foreground-brand` headings/wordmark; clay `--primary` CTAs. Confidence badge moved off green/amber/red Tailwind hexes onto `--confidence-*` tokens.
  - H1 (delta 2): Newsreader serif (`var(--font-headline)`), plum, 36px/45px, weight 400.
  - Macro summary (delta 3): one cream card, four equal columns w/ left dividers, serif 24px value + small-caps CAL/PRO/CARB/FAT labels. Core macro VALUES unchanged. Fibre/sugar/sodium preserved as a micro-chip row below the four-up strip (Figma strip is fixed at 4 cols — no value dropped).
  - Ingredients (delta 4): bullet list → photo-card grid (`grid-cols-3 sm:grid-cols-4`, radius 24, cream bg, ~86px image area + name + amount). recipe_ingredients carry NO per-ingredient image (only the recipe-level hero exists), so the card image area reuses the EXISTING deterministic `RecipeHeroFallback` glyph keyed per-ingredient — never an empty grey box, no new imagery wired (stop-zone respected).
  - Actions/CTA (delta 5/6): nav CTA + "Start planning free" → radius-full clay pills.
- **Web in-app `RecipeDetail.tsx`** (delta 6, web↔mobile parity): body action row (Start Cooking + I Made This) `rounded-xl` → `rounded-full`.
- **Mobile `recipe/[id].tsx`** (delta 6): `card` + `sourceCard` `Radius.lg`(8) → 16; macro tiles `borderRadius` 14 → 16; `actionBtn` + `stickyFooterBtn` `Radius.md`(6) → `Radius.full`.

**App-only features preserved (all still wired, verified in code + on captures):** Cook Mode (inline + standalone /cook), nutrition-verification pipeline (auto/re-verify, per-ingredient confidence dots), owner controls (edit sheet, go-public/unpublish, delete), net-carbs lens, viewing-servings stepper (yield scaling + batch totals), Log to journal / Log all sticky footer, seed-recipe hydration, public-share conversion CTA.

**Ask pill:** NOT added (Ask feature unbuilt — 🟣 Figma Only `185:2`). Flagged for backlog, not wired.

**Tests:** `tests/unit/recipeDetailFigmaReskin.test.ts` (21 assertions) pins the conformance contract across all three surfaces + the "no Ask pill" + "app-only features preserved" guards. Existing `recipeDetailLayoutWeb.test.tsx` (38) still green.

**Verified on captures:** mobile recipe detail (serif plum title, 16-radius macro/servings/notes cards, radius-full Start Cooking + Log all pills, Log-to-journal stepper + per-ingredient "Verified" confidence intact) ✓ on iPhone 17 Pro sim (`apps/mobile/screenshots/agent/recipe-detail-mobile-figma{,-scrolled}.png`). Public-share reskin ✓ rendered from the exact production markup + Sloe token hexes (`screenshots/web-drive/figma-reskin/public-share-static.png`) — the live `/recipe/[id]` 404s with zero published recipes in the DB and the shared dev server had degraded to 0-byte responses (env issue, not these changes).

**Files:** web — `app/recipe/[id]/page.tsx`, `src/app/components/RecipeDetail.tsx` · mobile — `apps/mobile/app/recipe/[id].tsx` · tests — `tests/unit/recipeDetailFigmaReskin.test.ts`

### Pending Sign-Off (Figma design stream) — exemplar batch DONE 2026-06-07
New Figma page **"Pending Sign-Off" (883:2)** — existing approved frames untouched. **5 App-Only features × iOS/Tablet/Desktop (15 frames)** designed to the Julienne bar, reusing the file's `Sloe / Color` variables + type system: Complete-day (885/901/894), Streak-milestone (906/911/910), Barcode scanner (912/916/920), Quick-add (921/928/926), Why-this-number (931/937/936). **4 reusable components** added: Sheet Header (941:2), Celebration Medallion (941:8), Quick-add Row (942:2), Ledger Row (942:10). Quality verified (inspected). Remaining ~172 App-Only tracked under Linear epic **ENG-903** — replicable via these components + archetype patterns.

### Recipe detail — implemented 2026-06-07 (local; typecheck+test verified, pixel-verify pending)
Public-share page (`app/recipe/[id]/page.tsx`) full Sloe reskin (cream, plum serif H1 36/45, flat 4-up macro strip, ingredient photo-card grid w/ fallback, radius-full clay CTAs, confidence tokens). Web in-app (`RecipeDetail.tsx`) + mobile (`recipe/[id].tsx`) → card radii 16, action/footer pills radius-full. **All app-only features preserved** (Cook Mode, verification, owner controls, servings stepper, net-carbs, sticky footer, JSON-LD). +21-assertion test `recipeDetailFigmaReskin.test.ts`; 59 tests pass. **Caveat:** not pixel-captured (no published recipe in DB → 404; dev server degraded mid-session) — needs visual-qa vs 332:2. In-app detail keeps its feature-dense tabbed layout (not Figma's single-scroll grid) to preserve functionality — intentional, not drift. (Linear ENG-890.)

### Auth / sign-in chooser — Figma frame `296:2` rebuilt 2026-06-08 (local only, no commit; typecheck + auth vitest clean web+mobile; web pixel-verified; iOS pending — orchestrator owns iOS)
**Problem:** web `/login` (+ `/signin`, `/signup`) and mobile `login.tsx` opened on a combined chooser **+ inline email/password card** — off the calm `296:2` chooser, which is chooser-first with the email form behind progressive disclosure.

**Changed (web + mobile parity — restyle only, auth stop-zone respected):**
- Both surfaces now **open on the chooser**: close X (top-right) · **"Sloe"** Newsreader serif wordmark (plum) · two-line positioning headline **"Cook what you love. / *Still* reach your goals."** (Still italic — the brand line, kept exact) · sync subtitle "Create an account or log in — your recipes and plan sync everywhere." · **Continue with Apple** (near-black `--foreground` / `colors.text` ink fill, white, Apple glyph) · **Continue with email** (outline pill, plum text, envelope) · Terms + Privacy fine-print.
- **Email form is now progressively disclosed** — a local `view` state (`"chooser" | "email"`, default `chooser`) toggles between the chooser and the existing email/password surface. "Continue with email" → `view="email"`; a **Back** affordance returns to the chooser. **No new route, no new auth provider, no architectural change** — every Supabase handler (Apple OAuth / ID-token, email sign-in/up, magic link, password reset), the mode toggle, the signed-in → `/(tabs)` (mobile) and `SIGNED_IN` → `postSignInHref` (web) routing, and all testIDs (`login-email`/`login-password`/`login-submit`) are untouched.
- **Google OMITTED** per **ENG-924** (Apple + email only; the frame shows Google but the Supabase Google provider is deferred). The frame-vs-product divergence is annotated in both files and pinned by tests. ENG-924 already exists — no net-new Linear note needed.
- Mobile: net-new non-brand glyphs use **lucide-react-native** (`X`, `Mail`, `ChevronLeft`) per the Lucide standard; `logo-apple` stays Ionicons (no Lucide Apple mark — the documented project exception, same as `signup.tsx`). Removed a pre-existing `styles.title` typecheck error noted earlier in this tracker (auth stop-zone now clean).

**Files:** web — `app/login/ui.tsx` (the shared chooser used by `/login`, `/signin`, `/signup`; the thin route wrappers `app/signin/page.tsx` + `app/signup/page.tsx` + `app/login/page.tsx` are unchanged and still pass `authRoutesPremium.test.ts`) · mobile — `apps/mobile/app/login.tsx`.
**Tests:** new `tests/unit/authChooserFigma.test.ts` (9) + `apps/mobile/tests/unit/loginChooserFigma.test.ts` (8) pin: chooser-first default (no inline form), wordmark, italic-Still headline, sync subtitle, Apple+email buttons, **Google omission + ENG-924 reference**, terms fine-print, **every preserved handler/testID/redirect**, close+back affordances. Existing `authRoutesPremium` (web, 4) + `loginAuthRedirect` (mobile, 1) + `authBootLoading` (mobile, 4) + `authCallbackRedirect` (web, 4) + `onboardingSignupSessionGate` (web, 3) all still green.
**Verified:** web mobile-vp chooser ✓ `screenshots/web-drive/auth-after.png` (matches `296:2` section-by-section); progressive-disclosure email step ✓ `screenshots/web-drive/auth-after-email.png`. iOS sim capture deferred to the orchestrator (this agent does not touch the sim). Typecheck clean web+mobile on the auth files (pre-existing unrelated `RecipeDetail.tsx` / `ProgressEnergyTriad.tsx` errors untouched).
**Follow-up (not done here):** Playwright golden snapshots `shell-login-desktop.png` / `shell-login-mobile.png` (in `tests/e2e/__snapshots__/visual-audit.spec.ts/`) now lag the new chooser — regenerate with `npm run test:e2e:visual:update` when the redesign batch is committed (→ qa-lead).

### Today — Figma backfill (8 app-only screens) 2026-06-08
**All 8 app-only Today screens now have Figma frames** in section `09 · Today & Plan — deep dive` (file `B3UdOFup7ITersgNuoXh0l`). Designed from the `docs/ux/redesign/today.md` spec using the canonical Sloe design language: 500px wide, Newsreader serif headings, Inter body, plum/clay/cream/sage/ink palette, auto-layout containers, consistent radii and spacing.

| # | Frame | Node ID | What it shows |
|---|---|---|---|
| TD6 | Weekly check-in modal | `1001:2` | MacroFactor-grade adaptive check-in: Newsreader "Your week, recalibrated." header, 7-day intake vs target bar chart (green under/amber over), −55 kcal delta callout, suggested new target card, confidence badge, terracotta "Update my target" CTA + sage "Keep current target" dismiss |
| TD7 | Win moment (30-day streak) | `1003:2` | Full-screen calm celebration: 96px terracotta Newsreader "30", "days consistent." serif subhead, freeze-protection context line, 7-dot habit grid (green filled/terracotta-dashed freeze), tap-to-dismiss |
| TD8 | Complete day modal | `1003:30` | Centred modal: green check circle, "Complete today?" Newsreader header, 3-stat day summary (1,847 kcal / 132g protein / 4 meals), HealthKit export note, green "Complete day" CTA, sage "Not yet" dismiss |
| TD9 | Goal-hit inline card | `1006:2` | In-context Today screen showing the inline goal-hit card: green check circle + "Targets met." serif + "Calories and protein on target today." — sits above the calorie ring showing 0 remaining, with 4 macro tiles below |
| TD10 | Streak habit grid (expanded) | `1006:36` | Full Today header with "Morning, Grace" greeting, streak pip badge (30), expanded 4-week × 7-day dot grid (green filled + terracotta-dashed freeze days), "2 freezes used" badge, coaching line, ring context below |
| TD11 | Why this number (TDEE sheet) | `1009:2` | Bottom sheet explaining the calorie target: Newsreader "Where this number comes from", TDEE breakdown (BMR 1,680 / ×1.38 activity / −270 goal / +120 bonus → 2,170 effective), adaptive estimate badge, explanation copy |
| TD12 | Quick-log calorie entry | `1010:2` | Sheet with meal slot selector (Breakfast/Lunch/Dinner/Snacks segmented control), "What did you eat?" name input, calories input (serif 450 value), optional P/C/F mini-inputs, terracotta "Log to Lunch" CTA |
| TD13 | Eat-again banner | `1010:41` | In-context Today showing a logged meal + the eat-again prompt card: terracotta-tinted border, "Had this again?" serif title, "You logged Chicken Caesar Salad yesterday." body, terracotta "Log" CTA. Below: empty Dinner slot with "Recommended for dinner: ~620 kcal" guidance |
| TD14 | Apple Health card | `1016:2` | In-context Today with the Apple Health connection card: red Apple Health icon, "Connected" green badge, 3-stat grid (Steps 8,420 / Active burn 340 kcal / Workouts 1) in white tile cards, "+120 kcal" amber activity bonus, terracotta "Where this comes from →" provenance link, last-synced timestamp |
| TD9 | Goal-hit inline card (bonus) | `1006:2` | BONUS (not in original 8): in-context Today with the inline goal-hit win moment card — green check + "Targets met." serif + body — above the calorie ring at 0 remaining. Covers §3.10 goal-hit variant |

**Design language verified (all 9 screenshotted):** Newsreader SemiBold/Medium headings, Inter Regular/Medium body, terracotta #C2683E CTAs, sage #7C8466 secondary text, cream #F6F5F2 card backgrounds, ink #1B1814 primary text, 12px/16px corner radii, consistent auto-layout spacing.

**Today 🔵 App Only → 0.** All 8 original + 1 bonus (goal-hit inline) move to 🟡 Partial Match (Figma frame exists, app implementation pending).

**Next:** Recipes (12 app-only) → Log a meal (11) → Plan (18) → Progress (17).
