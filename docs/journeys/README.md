# User journeys

Narrative **entry → action → result** docs for QA, PM, and engineering.

Organized **loop-first**: a "loop" is a complete, repeatable journey a user
actually takes, usually starting from a specific entry point and ending back
on Today, Progress, or another loop. Journeys don't stand alone — a recipe
import only matters because it feeds Plan and Today; a paywall gate is only
reachable because a real feature limit was hit. This structure mirrors
[`docs/product/overview.md`](../product/overview.md) § Product loops
(loops 1-15) — read that file for the narrative "why this loop exists," this
file for "which doc, read in what order."

Each journey doc is self-contained; cross-links go to Maestro / Playwright /
Vitest where automation exists. A secondary A-Z index for readers who already
know the doc name is below the loops.

## Loops

### 1. Onboarding → First Log (Activation Loop)
The front door. A new user goes from brand-new install to their first logged
meal on Today, picking up computed targets and a seeded library along the
way. This is the loop the whole activation metric (`firstLog.ts`) is
instrumented against.

**Reading path:** [`onboarding-to-first-log.md`](./onboarding-to-first-log.md) → [`food-tracking.md`](./food-tracking.md) (where the first log lands)

### 2. Import → Verify → Save → Cook/Log (Recipe Capture Loop)
The founder's headline loop: share a recipe from Instagram/TikTok/a blog/a
photo, get it parsed and nutrition-verified, save it to the library, then
cook or log it so it feeds the macro spine. The primary viral/retention
wedge.

**Reading path:** [`import-recipe.md`](./import-recipe.md) → [`verify-ingredients.md`](./verify-ingredients.md) → [`discover-and-library.md`](./discover-and-library.md) → [`food-tracking.md`](./food-tracking.md)
**Siblings (other capture entry points, same verify/save pipeline):** [`create-recipe.md`](./create-recipe.md) (from scratch), [`import-cookbook.md`](./import-cookbook.md) (PDF batch)

### 3. Plan the Week → Shop → Cook (Meal Planning Loop)
Generate a macro-fitted plan from the user's library/Discover pool, adjust it
(lock, swap, move, distribute-around-anchor), turn it into a shopping list
that stays in sync as the plan changes, then shop and cook.

**Reading path:** [`meal-planning.md`](./meal-planning.md) → [`shopping-list.md`](./shopping-list.md) → [`discover-and-library.md`](./discover-and-library.md) (Cook Mode / Batch Cook) → [`food-tracking.md`](./food-tracking.md) (log servings eaten)

### 4. Discover → Save → Cook (Browse & Build Library Loop)
The browse-first path into the recipe system: a user with no library yet (or
looking for inspiration) explores Discover, saves recipes into their
personal Library, organizes them into collections, and cooks from Recipe
Detail.

**Reading path:** [`discover-and-library.md`](./discover-and-library.md) → [`food-tracking.md`](./food-tracking.md) (log after cooking)

### 5. Daily Logging Loop (Log a Meal)
The core, highest-frequency retention loop: open Today, log something via the
single canonical Log sheet (search/scan/voice/photo/quick-add), see the
macro spine update, repeat.

**Reading path:** [`food-tracking.md`](./food-tracking.md) → [`log-sheet.md`](./log-sheet.md)

### 6. What to Eat Next (North-Star / Coach Loop)
The differentiating moment: the product tells the user what to eat next from
their own saved library, ranked against the macros they have left — first as
an always-on Today block, then as a fuller `/coach` destination screen
(behind `coach_screen_v1`, default-ON) with a grounded day narrative and
bounded Q&A.

**Reading path:** [`what-to-eat-next.md`](./what-to-eat-next.md) → [`discover-and-library.md`](./discover-and-library.md) (tap a suggestion → Recipe Detail) → [`food-tracking.md`](./food-tracking.md) (log or cook closes the loop)

### 7. AI-Assisted Logging & Trust Loop (barcode / voice / photo)
A user logs by scanning a barcode, speaking a meal, or snapping a photo.
Every path routes through the same verify/plausibility trust pipeline before
it's allowed to touch the macro spine, and every low-confidence result is
surfaced, never silently guessed.

**Reading path:** [`log-sheet.md`](./log-sheet.md) → [`food-tracking.md`](./food-tracking.md) → [`monetisation-and-paywall.md`](./monetisation-and-paywall.md) (Free/Base tiers hit an in-context paywall on most AI paths)

### 8. Weekly Review & Adaptive Re-Target Loop (Progress)
A week of logging feeds a weekly check-in and recap, which re-tunes the
adaptive TDEE and daily targets from the user's own real intake + weight
data rather than a fixed formula.

**Reading path:** [`food-tracking.md`](./food-tracking.md) (the week of logging) → [`progress.md`](./progress.md) (check-in, recap, re-target)

### 9. Weight → Trajectory → Goal Loop
A user logs a weigh-in, sees their trend and projected goal date, and that
same weight signal feeds back into maintenance/adaptive-TDEE calculations
used across Today, Progress, and Coach.

**Reading path:** [`progress.md`](./progress.md)

### 10. Household Sharing Loop
A household sets up granular meal/day sharing so members see what's on the
table (never each other's weight/targets/nutrition logs), which then threads
into the shared meal plan and a live, attributed shopping list.

**Reading path:** [`settings-and-control.md`](./settings-and-control.md) §7 (entry point) → [`household-sharing.md`](./household-sharing.md) (setup, presets/grid, privacy boundary) → [`meal-planning.md`](./meal-planning.md) → [`shopping-list.md`](./shopping-list.md) (household-aware, live-shared)

### 11. Monetisation / Paywall Loop
A user hits a real feature gate (AI logging, multi-day plan, photo/cookbook
import, saves cap), sees a factual in-context paywall, checks out on the
platform-appropriate rail, and the entitlement reconciles back to a single
canonical tier column that every surface reads.

**Reading path:** [`monetisation-and-paywall.md`](./monetisation-and-paywall.md) (the gate can be reached from [`log-sheet.md`](./log-sheet.md), [`meal-planning.md`](./meal-planning.md), [`import-recipe.md`](./import-recipe.md), [`import-cookbook.md`](./import-cookbook.md), or [`discover-and-library.md`](./discover-and-library.md)'s save cap)

### 12. Creator & Social Loop
A user follows a creator from a recipe byline or the Discover creator rail,
sees more of their recipes in the Following feed, and — separately — every
imported third-party recipe carries attribution, a link back, and a
takedown/report path.

**Reading path:** [`discover-and-library.md`](./discover-and-library.md) (creator byline / rail) → [`creator-platform.md`](./creator-platform.md) → [`import-recipe.md`](./import-recipe.md) (attribution/legal on imported recipes)

**Read the Open risk section of `creator-platform.md` first:** the live
creator platform is populated only by seeded launch-partner personas with
zero real recipes — there is no real-creator publish path yet.

### 13. Cross-Device Entry Loop (Shortcuts, Widgets, Deep Links)
Power-user entry points that skip the app UI entirely — Siri Shortcuts /
Action Button / Focus automations trigger a logging action via a `suppr://`
URL scheme, landing directly on Today with the mutation already applied.

**Reading path:** [`shortcuts-and-widgets.md`](./shortcuts-and-widgets.md) → [`food-tracking.md`](./food-tracking.md) (where the mutation lands)

### 14. Marketing → Signup Loop (top of funnel)
A visitor lands on the public web surfaces (landing, `/pricing`, `/roadmap`,
`/whats-new`, or a referral link), forms trust and pricing intent, and
converts into the Onboarding → First Log loop.

**Reading path:** [`marketing-to-signup.md`](./marketing-to-signup.md) → [`onboarding-to-first-log.md`](./onboarding-to-first-log.md)

### 15. Settings & Control Loop (the trust/control plane)
Not a single linear funnel but the loop every other loop depends on: a user
edits their targets, units, notifications, connections, or data
export/deletion in Settings, and that change propagates back into Today,
Plan, Progress, and Coach on next read.

**Reading path:** [`settings-and-control.md`](./settings-and-control.md) (branches to [`household-sharing.md`](./household-sharing.md) for Connections → Household, and [`monetisation-and-paywall.md`](./monetisation-and-paywall.md) for Membership)

---

## A-Z index (quick lookup)

| Journey | Doc | Automated coverage |
|---------|-----|--------------------|
| Marketing → signup (landing, `/pricing`, referral `/g/<code>`, `/roadmap`, `/whats-new`, trust/meta pages) | [marketing-to-signup.md](./marketing-to-signup.md) | Playwright `tests/e2e/screenshots/web-public-routes-after.spec.ts`; Vitest `tests/unit/landingParity.test.tsx`, `tests/unit/referralClient.test.ts`, `tests/unit/referralInviteParity.test.ts`, `tests/unit/referralLandingFlagGating.test.tsx` (ENG-1541 — `/g/<code>` promise copy + capture/redemption no-op when `referral_invite_loop_v1` is off) |
| Onboarding → first log (Welcome through completion, plus login/auth) | [onboarding-to-first-log.md](./onboarding-to-first-log.md) | Maestro `09_onboarding`, `00c_onboarding_v2_steps`, `00c0_onboarding_welcome_capture`, `00c1_onboarding_signup_preauth_guard`, `30_login_auth`, `28_notifications_prompt`; Vitest `onboardingPersist.test.ts`, `selectOnboardingSeeds.test.ts`, `useOnboardingGate.test.ts` (see doc for full list) |
| Food tracking (Today, quick add, logging) | [food-tracking.md](./food-tracking.md) | Maestro `02_today_screen`, `33_meal_journal`, `32_food_search_modal`; Playwright `journeys/today-authenticated.spec.ts` (Today shell) |
| Log sheet (canonical log entry point — search, scan, voice, photo, LogHub quick actions) | [log-sheet.md](./log-sheet.md) | Maestro `32_food_search_modal`; Vitest `tests/unit/logSheetPhase3.test.tsx` + `apps/mobile/tests/unit/logSheetPhase3.test.tsx` + `tests/unit/logSheetWebMobileParity.test.ts` (web↔mobile parity) |
| What to eat next (North-Star Today block + full `/coach` destination screen) | [what-to-eat-next.md](./what-to-eat-next.md) | Vitest `tests/unit/northStarSuggestion.test.ts`, `northStarBlockPhase3.test.tsx` (web + mobile), `todayAboveMealsCap.test.ts`; **no dedicated Maestro/Playwright coverage yet for `/coach`** — gap |
| Meal planning | [meal-planning.md](./meal-planning.md) | Maestro `03_meal_plan` |
| Shopping list | [shopping-list.md](./shopping-list.md) | Maestro `16_shopping`, `00e4_shopping_populated`; Playwright `tabs-shopping-*` visual snapshots |
| Household sharing (setup, presets/grid, privacy boundary, threads into Plan + Shopping) | [household-sharing.md](./household-sharing.md) | Vitest `householdPrivacyRls.test.ts`, `householdSharingGrid.test.ts`, `householdSharingGridStorage.test.ts`, `householdJoinDisclosureCopy.test.ts`, `householdClient.test.ts`, `shoppingHouseholdParity.test.ts` (mobile); no dedicated Maestro flow yet — see doc's Open questions |
| Recipe import | [import-recipe.md](./import-recipe.md) | Maestro `25_import_shared` |
| Recipe create (from scratch) | [create-recipe.md](./create-recipe.md) | Maestro `21_create_recipe` (single-screen form); wizard at `/recipe/create` covered by `apps/mobile/tests/unit/createRecipeWizard.test.ts` |
| Cookbook import (PDF, batch) | [import-cookbook.md](./import-cookbook.md) | No dedicated Maestro/Playwright/Vitest coverage — a known gap |
| Ingredient verify | [verify-ingredients.md](./verify-ingredients.md) | Maestro `26_recipe_verify` (manual suite — gated) |
| Discover & Library (browse, save, Recipe Detail, Cook Mode, Batch Cook) | [discover-and-library.md](./discover-and-library.md) | Maestro `12_library`, `11_discover`, `05_recipe_detail`, `00e1_recipe_detail`, `17_cook_mode`, `00e3_cook_active`; no dedicated Batch Cook Maestro flow — see doc's Open questions |
| Creator & Social loop (creator profile, follow/unfollow, import legal attribution, DMCA/report) | [creator-platform.md](./creator-platform.md) | No dedicated Maestro flow yet. **Read the Open risk section first: the live creator platform is entirely fabricated seed personas with no real-creator write path.** |
| Progress / recap (includes weight, trajectory, goal) | [progress.md](./progress.md) | Maestro `07_progress`, `27_progress_metric` |
| Shortcuts & widgets | [shortcuts-and-widgets.md](./shortcuts-and-widgets.md) | Partial — see doc |
| Monetisation / paywall loop (trigger → checkout → webhook → entitlement → manage/cancel) | [monetisation-and-paywall.md](./monetisation-and-paywall.md) | Maestro `19_paywall`; Vitest `tests/unit/stripeCheckoutRoute.test.ts`, `tests/unit/entitlementReconcileJob.test.ts`, `apps/mobile/tests/unit/pollUntilEntitled.test.ts`, `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx` |
| Settings & control loop (hub + search, Personal name split, `/profile` + `/targets` editing, Membership entry, Preferences/units, Notifications & reminders, Connections, Danger zone, privacy/analytics consent ask + Settings mirror) | [settings-and-control.md](./settings-and-control.md) | Maestro `31_settings_hub`, `04_profile_settings`, `34_profile_targets`, `00d6_targets_edit`, `00d1_settings_destructive`, `00d2_settings_delete_account`, `24_health_sync`, `20_notifications`, `28_notifications_prompt`; Vitest `tests/unit/settingsYourNameParity.test.ts`, `tests/unit/weighInReminderFlagParity.test.ts`, `tests/unit/editorialProfileBlock.test.ts`, `tests/unit/redesignDefaultOnParity.test.ts`, `tests/unit/cookieConsent.test.ts`, `tests/unit/cookieConsentRender.test.tsx`, `apps/mobile/tests/unit/analyticsConsentSurfaces.test.tsx`, `apps/mobile/tests/unit/analyticsConsentGate.test.ts` |

**Known gaps (no dedicated journey doc yet):** Health Sync (`24_health_sync`)
has only its Settings entry point documented, in
[`settings-and-control.md`](./settings-and-control.md) §7 — the sync
mechanics themselves live in
[`../integrations/apple-health.md`](../integrations/apple-health.md) rather
than a journey doc. Plan Import (paste/PDF/screenshot from the Plan tab) has
a spec at [`../planning/plan-import-linear-program.md`](../planning/plan-import-linear-program.md),
but [`meal-planning.md`](./meal-planning.md) doesn't yet link to it. See
[`docs/qa/SCREEN_TEST_MATRIX.md`](../qa/SCREEN_TEST_MATRIX.md) for full
screen ↔ flow traceability.

Household sharing and the weight tracker each have their own journey doc
([`household-sharing.md`](./household-sharing.md),
[`progress.md`](./progress.md) § Weight → Trajectory → Goal).

## Retired / renamed docs (redirect stubs — confirm content moved before deleting)

Four dated, point-in-time journey docs were merged into evergreen replacements
on 2026-07-18/19. Three of the old paths still hold a short redirect stub
rather than being deleted outright, so a bookmark or external reference
pointing at the old path still resolves to the current doc. The fourth,
`north-star-2026-04-27.md`, was later removed outright — its row below is
kept so anyone with an old bookmark still finds the replacement:

| Old path | Redirects to | Merge verified |
|---|---|---|
| `log-sheet-2026-04-27.md` | [`log-sheet.md`](./log-sheet.md) | Yes — full phase history through 2026-06-27 moved verbatim |
| ~~`north-star-2026-04-27.md`~~ (removed 2026-07-19) | [`what-to-eat-next.md`](./what-to-eat-next.md) | Yes — scorer/gate/branch/CTA/tests content merged verbatim, plus new `/coach` coverage. File deleted via `git rm`; this row kept for anyone with an old bookmark |
| `progress-2026-04-27.md` | [`progress.md`](./progress.md) | Yes — superseded, content folded into progress.md's Design history section |
| `onboarding-final-step-2026-04-27.md` | [`onboarding-to-first-log.md`](./onboarding-to-first-log.md) | Yes — the "Pick 5 recipes" step it described was cut 2026-05-30; current flow documented in the target |

Unrelated dated audit docs (`gluten-depth-2026-04-27.md`,
`recipe-transitions-2026-04-27.md`, `tab-collapse-2026-04-27.md`,
`trust-posture-2026-04-27.md`) are point-in-time audit snapshots, not part of
this rename cycle — left as-is.
