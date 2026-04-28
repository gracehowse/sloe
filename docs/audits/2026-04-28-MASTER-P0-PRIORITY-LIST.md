# Phase 6 — MASTER P0 PRIORITY LIST

**Aggregated from 9 deep audits across every surface.** All 3 platforms (mobile native, mobile-web, desktop-web) + onboarding + landing + emails.

This is the **single ranked action list** for executor sprints. Audits are on disk under `docs/audits/2026-04-28-*.md`.

---

## P0 — Trust failures + write-path divergences + broken core flows

### Group A — Onboarding broken
1. ✅ **MV-01 — Mobile v2 has NO completion handler.** **SHIPPED Batch 6 (5d02771).** `mobile-flow.tsx#handleComplete` mirrors web; persistOnboardingV2 → resolveSeedsToRecipeIds → buildFirstWeekFromSeeds → router.replace.
2. ✅ **MV-02 — Mobile v2 Signup is FAKE AUTH.** **SHIPPED Batch 12 (f8ca723).** Real `expo-apple-authentication.signInAsync` + `supabase.auth.signInWithIdToken` with sha256(rawNonce); iOS-only via Platform.OS gate.
3. ✅ **WEB-01 / MV-03 — V2 state does NOT persist.** **SHIPPED Batch 6 (5d02771).** localStorage hydration on web; AsyncStorage on mobile; cleared on completion.
4. ✅ **AU-01 — `/onboarding/v2` may not persist on completion.** **SHIPPED Batch 2 (1e62e24).** Stale comment removed; persistence wired.
5. ✅ **ML-01 / X-03 — Legacy mobile Skip writes FICTIONAL targets flagged as user-set.** **SHIPPED Batch 2 (1e62e24).** Skip path now writes `target_calories_source: "onboarding_skip"`; CHECK constraint widened by migration `20260503111000`.

### Group B — Logging trust failures
6. ✅ **VL-01 — Voice log silently fails on Safari + Firefox.** **SHIPPED Batch 2 (1e62e24).** Mic button only renders when `webSpeechSupported === true`; Safari/Firefox get text-input-only with honest copy.
7. ✅ **PL-01 — Photo log AI estimate commits as if verified nutrition.** **SHIPPED Batch 4 (b512718).** Sparkles + "Includes N AI-estimated meal{s}" pill below Today hero (web + mobile).
8. ✅ **HS-01 — Apple Health "Connected" persists after iOS revoke.** **SHIPPED Batch 1 (d11ef00).** `probeHealthAccess()` via `useFocusEffect` clears stale `health_sync_apple_connected` AsyncStorage key.
9. ✅ **VR-01 — "Confirm All" promotes low-confidence rows to `is_verified=true`.** **SHIPPED Batch 1 (d11ef00) + deepened in Batch 16/17/18.** `allRowsVerified` gate; per-row write gated on confidence threshold; per-ingredient confidence hydrated end-to-end.

### Group C — Plan / Shopping write-path
10. ✅ **F1 — "Generate Shopping List" unreachable on mobile after regenerate.** **SHIPPED Batch 3 (dc9196b).** Extracted `generateShoppingListFromPlan` callback; reachable from summary card when count is 0.
11. ✅ **F2 — Web Planner is ~30% of mobile's surface.** **SHIPPED — all 11 structural sub-batches done:**
    - ✅ F2-A Snacks slot + slot icons (batch 23, `02b3b41`)
    - ✅ F2-B day-count picker 1/3/7 (batch 23)
    - ✅ F2-C Free-tier lock — closes F5 (batch 23)
    - ✅ F2-D start-date picker Today/Tomorrow/Next-week (batch 29, `8baf9cb`)
    - ✅ F2-E per-meal portion badge + day-totals row (batch 24, `8d7fd2e`)
    - ✅ F2-F week summary card with worst-short-day diagnosis (batch 25, `d11836f`)
    - ✅ F2-G named-slot switcher UI (batch 30, `5419e38`)
    - ✅ F2-H slot toggles (batch 32, `6de582c`)
    - ✅ F2-I add-slot-back chips (batch 31, `0fcc5ff`)
    - ✅ F2-J leftover badge display (batch 26, `d2a4fb8`)
    - ✅ F2-K leftover distribution at generation time (batch 27, `e4ad639`)
    - ✅ F2-L household bar (batch 33, `54856d9`)
    - ✅ F2-M log-today action on meal rows (batch 28, `bf1f80a`)
    - **Remaining F2 follow-ups (gated on product-lead, not on this audit):**
      - Templates (save / apply / delete) — needs Free-vs-Pro design call
      - Portion stepper modal — needs design call (bottom-sheet vs inline +/-)
      - Day summary strip — needs decision on whether the 7-column grid serves the same purpose
12. ✅ **F3 — Web Shopping list missing baseline interactions.** **SHIPPED Batch 37 (commit fe60e57)** as a hybrid per `docs/decisions/2026-04-28-shopping-list-web-parity-hybrid.md`. Ported lifecycle interactions from mobile (per-row remove, clear-checked, slim progress bar) while keeping prototype-strip baseline for chrome. Share + Trash + Export deferred until web share format is designed. Test split: `shoppingListPrototypePort.test.tsx` keeps structural assertions; new `shoppingListInteractionParity.test.tsx` covers behaviours.
13. ✅ **F30 — Mobile "Log today" portion_multiplier double-application.** **SHIPPED Batch 3 (dc9196b) + Batch 15 (c37b52c).** `portion_multiplier: 1` since macros are post-portion; `generateSmartPlan` now drops zero-macro recipes.

### Group D — Cross-platform lies
14. ✅ **F4 — "Base and above" upsell to non-existent SKU.** **SHIPPED Batch 8 (c346ef8).** Both occurrences in `planner.tsx` now read "Available with Pro".
15. ✅ **F5 — Free-tier 7-day plan lock divergence.** **SHIPPED Batch 23 (commit 02b3b41)** — closed as a side-effect of F2-C. Web now gates `d > 1` for Free, matching mobile behaviour at `apps/mobile/app/(tabs)/planner.tsx:1736-1756`.
16. ✅ **PR-01 — "Base" tier half-deleted across surfaces.** **SHIPPED Batches 19+20+21 (commits bb9f4a8, 43739a0, 3c7091e).** monetisation-architect ratified Free+Pro per the 2026-04-27 strategic direction; Base features folded into Pro. Surfaces collapsed: PRICING_TIERS SSOT (Free/Base/Pro → Free/Pro), web `upgrade-paywall-dialog` (Variant A/B → single Free→Pro), `app/pricing/page.tsx` metadata + FAQ, mobile paywall (Base TierCard removed, `purchasing` + `focusedTier` types narrowed), Settings/Profile/UpgradePrompt tier label maps, `app/api/stripe/checkout/route.ts` (`tier: "base"` now rejected with 400). Internal `UserTier = "free" | "base" | "pro"` enum + Stripe `tierFromStripePriceIds("base")` lookup retained for legacy event safety. **Operational follow-up pending (Grace, manual):** Stripe dashboard archive Base price IDs; RevenueCat mark Base products inactive.
17. ✅ **D1 — Following filter parity drift.** **SHIPPED Batch 3 (dc9196b).** Mobile now matches `creatorId OR authorId`.
18. ✅ **D3 — Eating-out tap goes to different destinations on native vs web.** **SHIPPED Batch 8 (c346ef8).** Mobile now `router.push("/(tabs)")` (no search param).
19. ~~**CM5 — Cook web auto-logs meal on done; mobile doesn't.**~~ **RESOLVED 2026-04-28 (verified, no code change)** — re-audited: both platforms show a "Log this meal" button on the Done state and only fire the log on user tap. Web uses inline `handleLogMeal` → `addLoggedMeal`; mobile routes `/recipe/{id}?autoLog=1` → `addRecipeToTodayJournal()` via the recipe-detail useRef-guarded effect. Pattern differs but user-facing behaviour is identical. The original CM5 finding misread the web `setLogged(true)` call as an auto-fire on mount; it's an `onClick` callback. Pinned by `tests/unit/cookModeAutoLogFireOnce.test.ts`.

### Group E — Recipe creation
20. ✅ **CR-01 — Mobile recipe detail has NO Edit / Delete / Duplicate / Publish.** **SHIPPED Batch 5 (e773cd2).** `MoreHorizontal` overflow button (owner-only) with Alert action sheet → "Delete recipe".
21. ✅ **CR-02 — Recipe Delete doesn't exist anywhere.** **SHIPPED Batch 5 (e773cd2).** Best-effort orphan cleanup (`meal_plans.recipe_id = null`, `saves` rows removed).
22. ✅ **CR-03 — Mobile create Publish toggle has no attestation.** **SHIPPED Batch 5 (e773cd2).** `onSave` confirms via Alert when `publish === true`.

### Group F — System trust
23. ✅ **ERR-01 — Mobile has NO production error boundary.** **SHIPPED Batch 7 (af28509).** `RootErrorBoundary.tsx` class component wraps `RootLayout`.
24. 🟡 **EMAIL-01 — Zero email templates in repo.** **PARTIALLY SHIPPED — Batch 34:** the six Supabase Auth templates (Confirm signup / Reset password / Magic link / Change email / Invite / Reauthentication) now live at `docs/emails/supabase-auth/*.html` and can be copy-pasted into the Supabase Dashboard. Brand-aligned (Suppr gradient mark, voice per `docs/ux/brand-guidelines.md` §6, honest plaintext fallback link, real privacy footer). Defaults are now Suppr-branded; the "scammy default" finding is closed for the auth flow. **Still outstanding:** custom transactional emails (trial-ending / subscription / weekly digest / plan-build-failed) — needs vendor selection (Resend / SendGrid / SES / Postmark) which is a separate monetisation-architect + integration-manager call before code can ship. Tracked in `docs/emails/README.md`.
25. ✅ **CM1 — Cook screen crashes on malformed JSON `steps` query.** **SHIPPED Batch 1 (d11ef00).** Wrapped `JSON.parse(stepsJson)` in try/catch with type-narrowing.

### Group G — Settings / More structural debt
26. ✅ **Mobile-web "You" tab is one-screen dead end.** **SHIPPED Batch 10 (ce0bf0b).** YouSubTabPill component covers Settings/Profile/Progress.
27. 🟡 **"More" exists nowhere on web.** **IN FLIGHT — Group G IA verdict shipped via product-lead.** Decision: collapse You into 2 sub-tabs (Progress + Settings); Profile-as-row; kill standalone More tab. 5-batch plan in `docs/decisions/2026-04-28-group-g-ia-collapse.md`. Batch A shipped (commit a1b509e — mobile-web pill 3→2). Batches B-E pending (move sections, web parity, delete duplicates, cleanup).
28. 🟡 **Settings + More 80% overlap on native.** **IN FLIGHT — same plan as #27.** Resolved by the same Group G IA collapse; Batch B (move More sections into Settings) is the next chunk.
29. ✅ **Reset / Erase / Delete-Account stacked behind one modal.** **SHIPPED Batch 9 (eaf5635).** Two-step Alert + Alert.prompt requires user to type "delete" lowercase to confirm.
30. ✅ **L5 — Mobile-web Library↔Discover sub-tab pill bar missing.** **SHIPPED Batch 10 (ce0bf0b).** `RecipesSubTabPill` covers Library/Discover.

### Group H — Grace TestFlight live walkthrough (queued 2026-04-28)
*Reported by Grace mid-walkthrough; addressed in batches as captured below.*

31. ✅ **GW-01 — Library `Saved` tab is missing Discover bookmarks.** **SHIPPED Batch 36 (commit f1a730b) + migrations applied 2026-04-28.** data-integrity diagnosis identified the root cause: `scripts/seed-discover-recipes.ts:24` hard-coded Grace's UUID as `SEED_AUTHOR_ID`, so every saved Discover row matched `authorId === userId` and was misclassified as "imported". Fix: predicate moved to shared `src/lib/recipes/libraryEntryKind.ts` with `isSaved` ranked above authorship; Discover null-author filter removed; seeder now writes `author_id = NULL`; migration `20260503112000_unpoison_seed_author_ids.sql` set 15 affected rows to NULL. Additive RLS policy `recipes_select_via_save` (migration `20260503112100`) closes the latent F-7 contract gap (saved recipes stay readable to the saver after author unpublishes). 8 test cases pinned at `tests/unit/libraryEntryKind.test.ts`.
32. **GW-02 — Library `Vegetarian` filter returns meat-containing recipes.** Filter is either off the wrong field, off a `tags` string match that misses, or doesn't read `dietary_flags`. Direct contradiction of user dietary intent. **FIXED 2026-04-28 (Batch 14)** — `src/lib/recipes/libraryFilters.ts` now layers (1) `dietaryFlags` ⇒ trust `vegan`/`vegetarian`, (2) `allergens` ⇒ reject `fish`/`crustaceans`/`molluscs`, (3) expanded title keyword scan covering common dishes that don't name the meat (bolognese, schnitzel, kebab, biryani, paella, scallop, etc.). Both web + mobile loaders now thread `dietary_flags` + `allergens` through to the predicate. Pinned by `tests/unit/libraryFilters.test.ts`.
33. ✅ **GW-03 — Library `Created` filter returns recipes the user did not create.** **SHIPPED Batch 36 (commit f1a730b) + migrations applied 2026-04-28.** Same root cause as GW-01 — seeder poisoned 15 Discover rows with Grace's UUID, classified as "Imported" not "Created" because each row had `source_url`. Migration unpoisoned them; seeder fixed.
34. ✅ **GW-04 — Library `Imported` filter returns recipes the user did not import.** **SHIPPED Batch 36 (commit f1a730b) + migrations applied 2026-04-28.** Same fix as GW-03.
35. **GW-05 — Discover search placeholder is dishonest ("Search 48k recipes").** We don't have 48k recipes — that's a placeholder. Replace with "Search recipes" until a real count exists. (See M14-pattern: dishonest copy.) **FIXED 2026-04-28 (Batch 14)** — both platforms now read "Search recipes".
36. **GW-06 — Discover filters don't filter.** Tapping cuisine / time / fit / etc. doesn't change results. Either no-op handlers or predicate not wired into the query. **PARTIALLY FIXED 2026-04-28 (Batch 14)** — the "Quick" pill was passing through any recipe with `cookTimeMin == null` (most legacy imports), so it silently behaved like "All". Both platforms now require a real cook- or prep-time signal and apply a 30-minute total threshold. Other pills (For You / Following / Popular / High Protein / Low Carb) have correct predicates; "For You" intentionally pass-through and "Popular" requires `>= DISCOVER_POPULAR_MIN_SAVES` saves which can read as inert when no rows have hit that threshold.
37. **GW-07 — Plan card showing 0 cal / 0 macros for a recipe that has real macros.** Plan-level read pulls macros from the wrong column (raw row vs computed view), or the plan-row hasn't been backfilled with the recipe's macros at insert time. **Data-correctness violation per `.claude/CLAUDE.md`** — same family as F30.
38. **GW-08 — "Estimations and confidence tags across the app have no actual meaning or accuracy."** Blanket trust failure. TrustChip / confidence labels / "verified" badges / AI-source pills are all surface decoration unless tied to a real backing signal that the user can rely on. Audit every confidence-display surface and either:
    - back it with a real, calibrated signal (DB column, score threshold, source provenance), OR
    - remove the chip until we can.
    *Per `.claude/CLAUDE.md`: "If nutrition / ingredient matching is uncertain, do not guess."* This is the canonical violation in product form.
    **Status (2026-04-28, in flight):** nutrition-engine specialist completed full audit; mapped 17 distinct surfaces. Findings:
    - **2 honest** (USDA `Foundation/SR Legacy/Survey` flag in food search; FatSecret legal-attribution badge)
    - **3 honest-but-uncalibrated** (verifyRecipeResponse confidence; AI provenance via `isAiSourcedFoodHistoryItem`; gluten classifier)
    - **5 weak** (per-ingredient confidence load-time fabrication; VR-01 gate; planner `macrosAreEstimated`; verify-recipe `needsReview`; SourceDot on Today rows)
    - **6 decorative/always-true** (Discover hero TrustChip, Library card TrustChip web+mobile, Recipe Detail hero TrustChip, recipe `is_verified` write path, Discover SourceBadge, "fit %" Recipe Detail)
    - **Root cause:** `recipe_ingredients.is_verified` carries 3 different meanings at 3 different layers; the importer at `apps/mobile/lib/saveImportedRecipe.ts:210` writes `is_verified: (m?.calories ?? 0) > 0` (true on every successful LLM extract), and that bool propagates through every downstream chip claiming "USDA verified".
    - **Batch 16 (FIXED 2026-04-28):** removed source TrustChip from Discover hero (web+mobile), Library cards (web desktop+mobile-web grids, mobile native), Recipe Detail hero (web+mobile); removed always-85% fit pill on mobile Recipe Detail (mirroring F-45 Discover removal); fixed per-row `is_verified` write in `saveVerifiedIngredients` to gate on `confidence ≥ RECIPE_INGREDIENT_REVIEW_CONFIDENCE`. Tests `tests/unit/trustPostureSweepPhase4.test.tsx` + `apps/mobile/tests/unit/trustPostureSweepPhase4.test.tsx` flipped from positive to negative pins.
    - **Batch 17 (PENDING):** fix the import path's structural lie at `saveImportedRecipe.ts:210` — gate `is_verified` on real source (`m?.source ∈ {USDA, OFF, FatSecret, Edamam}`).
    - **Batch 18 (PENDING — needs migration):** persist + hydrate real per-ingredient `confidence` end-to-end so VR-01 gate, Verify screen confidence, and Recipe Detail trust signal all reflect calibrated values. The simplest correct approach: split `is_verified` into `match_source` (text) + `match_confidence` (numeric).

### Group I — CI gate (resolved)
39. ~~**CI-01 — `next build` fails on `/404` and `/500` prerender.**~~ **RESOLVED 2026-04-28** — phantom failure from stale `.next` cache (left over from an aborted build mid-stash). Clean `rm -rf .next && next build` passes. CI was already green on `main`. No code change needed.

---

## P1 — High-priority drift, decoy interactions, cheap-tier surfaces

(46 items — see individual audit docs for details)

- IM-01: "Recent imports — No recent imports" decoy + 4 dead source buttons (TikTok/Instagram/YouTube/Website have no onClick)
- IM-02: Web import 3-step animation is fake (step 1 hard-coded done)
- WEB-02: "Suppr Club" hero copy on Welcome — trademark risk
- LS-01: LogSheet Search tab is decoy on both platforms
- LS-02: Sub-tab pill clips Voice/Photo log on every viewport ≤430pt
- TR-01: `recipe-import/route.ts:43` accepts `http://` URLs as source attribution
- TR-03: Site-claimed JSON-LD nutrition preferred over verifyIngredients DB match
- M14: Build stamp visible to all production users
- M5: Daily targets reads "(defaults)" after onboarding completion
- M10: Apple Health row sub lies post-revoke
- M21: Help fallback opens mailto to privacy address
- Calendar button mislabelled (P1 sighted, **P0 for VoiceOver**)
- Imperial users see "kg" leak through on Journey card
- ProgressHeadline manufactures "Maintenance held steady" from hard-coded zeros
- Range picker decoy — overline "LAST 30 DAYS" but 5/7 cards from last 7
- Burn detail "Bonus so far" extrapolates future burn
- I18N-02: Currency `£` hardcoded — non-UK visitors see wrong currency
- A11Y-01..04: Modal focus, chart screen-reader, focus-visible ring, cookie banner trap
- ERR-02 / ERR-04: 404 missing on web; mobile silently redirects
- EMAIL-02: Web-only Pro users get no recap
- F25: Web regenerate silently rebuilds shopping, destroying checked-state
- F37: Plan ownership not surfaced (Shared with household / Private)
- F46: Shopping list shows no "from plan of {date}" timestamp

---

## P2 / P3 — see individual audit docs

47 P2 + 18 P3 findings spread across `docs/audits/2026-04-28-*.md`. Worth a sweep but not blocking.

---

## Audits on disk

1. `2026-04-28-customer-lens-first-session.md` — Today end-to-end (earlier sweep)
2. `2026-04-28-ui-critic-button-level.md` — Top 5 buttons-level
3. `2026-04-28-visual-qa-pixel-level.md` — pixel-level cheap-tier
4. `2026-04-28-2026-bar-button-level.md` — premium bar
5. `2026-04-28-sync-enforcer-parity.md` — cross-platform parity
6. `2026-04-28-library-discover-deep-audit.md` — Library + Discover + Cook + Recipe
7. `2026-04-28-more-settings-deep-audit.md` — Settings + More + Profile + Burn + Household + Notifications
8. `2026-04-28-progress-burn-weight-audit.md` — Progress + Burn + Weight + Digest
9. `2026-04-28-plan-shopping-audit.md` — Plan + Shopping (47 findings)
10. `2026-04-28-onboarding-3-platform-audit.md` — Onboarding web v2 + mobile legacy + mobile v2
11. `2026-04-28-landing-pricing-paywall-auth-audit.md` — Landing + Pricing + Paywall + Auth
12. `2026-04-28-logging-system-audit.md` — LogSheet + Voice + Photo + Health Sync + Notifications
13. `2026-04-28-recipe-creation-audit.md` — Upload + Import + Verify + Edit + Delete + Share + Go Public
14. `2026-04-28-app-wide-states-audit.md` — Errors + Offline + Loading + Empty + Toasts + Cookies + Emails + a11y + i18n + diversity
15. `2026-04-28-comprehensive-coverage-matrix.md` — coverage tracker

---

## Recommended sequencing

**Sprint 1 (this week, ship-blocking trust fixes):**
- MV-01 / MV-02 (mobile v2 completion + auth) OR kill switch the v2 flag
- WEB-01 / MV-03 (V2 state persistence)
- ML-01 / X-03 (legacy Skip writes lies to DB)
- CM1 (cook crash try/catch)
- VL-01 (voice log silent fail on Safari)
- HS-01 (Apple Health post-revoke detection)
- VR-01 (Confirm All gates is_verified)

**Sprint 2 (write-path / data correctness):**
- F1 (mobile generate-shopping-list dead code)
- F30 (portion_multiplier double-application)
- PL-01 (AI estimate provenance carry to Today)
- CR-02 (Recipe Delete + orphan cleanup)
- D1 (Following filter parity)

**Sprint 3 (cross-platform parity, conversion fixes):**
- PR-01 (Base tier consolidation)
- AU-01 (onboarding persistence on completion)
- F2 (Web Planner full feature parity)
- F3 (Web Shopping baseline)
- F4 / F5 (pricing copy + free-tier lock)

**Sprint 4 (system + trust infrastructure):**
- ERR-01 (mobile error boundary)
- EMAIL-01 (transactional email templates)
- A11Y-04 (cookie consent focus trap)
- OFF-01 / OFF-02 (offline indicator + retry queue)
- ERR-02 (web 404 page)

**Sprint 5 onwards:**
- Settings / More structural restructure (recommendation: collapse to 2 sub-tabs Progress/Settings + Profile-as-row)
- Mobile-web pill bars (YouSubTabHeader + RecipesSubTabHeader)
- 5 P1 visual refit specs already on disk → executor builds
- The 46 P1 + 47 P2 + 18 P3 cleanup items

**Insertion priority for Grace's live findings (Group H):**
- **GW-08 (estimations + confidence tags)** is the highest-leverage item — touches every nutrition surface. Should be a dedicated audit + remediation pass, not a sprint task.
- **GW-01..04 (Library predicates)** + **GW-06 (Discover filters)** are predicate-correctness bugs — straight repo-auditor + executor pass.
- **GW-05 (Discover placeholder)** is a one-liner copy fix.
- **GW-07 (Plan 0-macro card)** is a data-correctness write-path bug — same family as F30, treat with same severity.
- **CI-01** must precede any further push.

---

## Trust concerns ranked across all audits

1. ML-01 / X-03: DB lies about whether user set their targets (skip path)
2. MV-02: Apple Sign-In doesn't sign anyone in
3. VL-01: Pro voice log paid feature silently fails on Safari/Firefox
4. PL-01: AI estimates absorb into Today total without provenance
5. HS-01: Health "Connected" lies after iOS revoke
6. VR-01: Low-confidence rows promoted to verified
7. AU-01: Sign-up flow may not persist
8. PR-01: Phantom "Base" tier across surfaces
9. F4: "Base and above" upsell to non-existent SKU
10. EMAIL-01: Default Supabase emails read as scammy
11. ERR-01: Mobile crashes are invisible to user
12. A11Y-04: Cookie banner can be ignored; analytics may load pre-consent
13. F30: portion_multiplier double-application could silently inflate macros
14. F46: Shopping list with no timestamp + auto-purge — could buy ingredients for last week's plan
15. CR-03: Mobile Publish toggle has no attestation (copyright posture)
16. M5: Daily targets reads "(defaults)" after onboarding completion
17. M14: Build stamp visible to all users in production
18. IM-02: Web import 3-step animation is fake
19. TR-01: `http://` URLs accepted as source attribution
20. TR-03: Site-claimed nutrition preferred over our DB match without disclosure

---

## Verdict

**The product has dozens of P0 trust failures and write-path divergences across every surface.** Phase 6 is significantly more than a visual elevation pass — it's structural.

The visual refits already spec'd (Cook Mode, Onboarding, Progress stat grid, Planner summary, Shopping empty) are still valid but **secondary** to the trust + data-correctness fixes above.

Recommend: pause visual P1 implementation until Sprint 1 + 2 above are landed.
