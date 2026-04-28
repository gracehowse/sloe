# Phase 6 — MASTER P0 PRIORITY LIST

**Aggregated from 9 deep audits across every surface.** All 3 platforms (mobile native, mobile-web, desktop-web) + onboarding + landing + emails.

This is the **single ranked action list** for executor sprints. Audits are on disk under `docs/audits/2026-04-28-*.md`.

---

## P0 — Trust failures + write-path divergences + broken core flows

### Group A — Onboarding broken
1. **MV-01 — Mobile v2 has NO completion handler.** User picks 5 recipes, taps "Build my first week", nothing happens. `apps/mobile/components/onboarding-v2/mobile-flow.tsx`. Block flag rollout until fixed.
2. **MV-02 — Mobile v2 Signup is FAKE AUTH.** Apple button creates no account; email field has no password input, no `supabase.auth.signUp` call. Should not ship to TestFlight.
3. **WEB-01 / MV-03 — V2 state does NOT persist.** Refresh, app-background, email-confirm redirect → all answers gone. Both providers initialise from `DEFAULT_ONBOARDING_STATE` with zero localStorage / AsyncStorage hydration.
4. **AU-01 — `/onboarding/v2` may not persist on completion.** Page comment: "doesn't persist anything yet (OB2-1 in TODO.md)". Front door of product. `app/onboarding/v2/page.tsx:36-39`.
5. **ML-01 / X-03 — Legacy mobile Skip writes FICTIONAL targets flagged as user-set.** 28-year-old, 70 kg, 165 cm, "unspecified-sex" defaults persisted with `target_calories_source: "onboarding"` like the user personalised them. `apps/mobile/app/onboarding.tsx:387-411`.

### Group B — Logging trust failures
6. **VL-01 — Voice log silently fails on Safari + Firefox.** Press-and-hold flips green ring, MediaRecorder captures audio, releases, **nothing happens.** Recording is never uploaded. Pro feature paid + broken. `src/app/components/suppr/voice-log-dialog.tsx:92-165`.
7. **PL-01 — Photo log AI estimate commits as if verified nutrition.** Today's `JournalMeal` rendering doesn't surface `source: "ai_photo"` provenance — becomes one of N entries in clean kcal/protein/carb total. Per CLAUDE.md: *"If nutrition / ingredient matching is uncertain, do not guess."*
8. **HS-01 — Apple Health "Connected" persists after iOS revoke.** AsyncStorage boolean never re-validated. Already flagged in More audit M10. **Still here.**
9. **VR-01 — "Confirm All" promotes low-confidence rows to `is_verified=true`.** `verifyRecipe.ts:1318` sets unconditionally. Recipe gets green Verified TrustChip on detail.

### Group C — Plan / Shopping write-path
10. **F1 — "Generate Shopping List" unreachable on mobile after regenerate.** Dead code block (`{false && plan && (...)}`). Loop. Stuck. `apps/mobile/app/(tabs)/planner.tsx:2391`.
11. **F2 — Web Planner is ~30% of mobile's surface.** Missing day-count picker, snacks slot, slot toggles, free-tier lock, templates, named slots, portions, leftovers, household, "Add slot back". Project rule violation.
12. **F3 — Web Shopping list missing baseline interactions.** No share, export, clear-all, clear-checked, per-row remove, progress bar.
13. **F30 — Mobile "Log today" portion_multiplier double-application.** `portion_multiplier: currentMult` persisted while `meal.calories` already baked it in. Silent macro inflation. Data-correctness violation per `.claude/CLAUDE.md`.

### Group D — Cross-platform lies
14. **F4 — "Base and above" upsell to non-existent SKU.** `planner.tsx:1604, 1740`. Pricing copy lies.
15. **F5 — Free-tier 7-day plan lock divergence.** Mobile gates; web doesn't. Same user gets different access by platform.
16. **PR-01 — "Base" tier half-deleted across surfaces.** Visible on landing, hidden on `/pricing`, hidden on mobile paywall, but name leaks into copy ("Everything in Base, plus"). Conversion-killing.
17. **D1 — Following filter parity drift** (from Library/Discover audit). Mobile `creatorId` only; web `creatorId` OR `authorId`. **Silent data divergence.**
18. **D3 — Eating-out tap goes to different destinations on native vs web.**
19. **CM5 — Cook web auto-logs meal on done; mobile doesn't.** Write-path cross-platform divergence.

### Group E — Recipe creation
20. **CR-01 — Mobile recipe detail has NO Edit / Delete / Duplicate / Publish.** No overflow menu. User who creates on mobile and types a typo has no way to fix it on mobile.
21. **CR-02 — Recipe Delete doesn't exist anywhere.** Orphan-handling at `recipes.ts:332-340` is observation-only — logs to console, never warns user. Planner entries silently disappear.
22. **CR-03 — Mobile create Publish toggle has no attestation; web requires GoPublicDialog.** User can publish someone else's content under own name on mobile.

### Group F — System trust
23. **ERR-01 — Mobile has NO production error boundary.** TestFlight crash → black screen → force-quit. User has no recovery.
24. **EMAIL-01 — Zero email templates in repo.** Welcome / verify / reset / trial-ending / subscription / digest — none owned by Suppr. Default Supabase emails are scammy on first signup.
25. **CM1 — Cook screen crashes on malformed JSON `steps` query** (no try/catch). `apps/mobile/app/cook.tsx:39`.

### Group G — Settings / More structural debt
26. **Mobile-web "You" tab is one-screen dead end.** Cannot reach Settings, Sign Out, Subscription, Help, Reset, Notifications inbox without typing `?view=settings` in URL bar.
27. **"More" exists nowhere on web** (desktop sidebar = Progress/Profile/Settings; mobile = Progress/Settings/More; mobile-web = nothing).
28. **Settings + More 80% overlap on native.** Both have Sign Out, Export CSV/JSON, Manage subscription, Notifications row.
29. **Reset / Erase / Delete-Account stacked behind one modal.** Account-delete buried second-most-prominent in an erase-data dialog.
30. **L5 — Mobile-web Library↔Discover sub-tab pill bar missing.** From Library, no surfaced path to Discover.

### Group H — Grace TestFlight live walkthrough (queued 2026-04-28)
*Reported by Grace mid-walkthrough; addressed in batches as captured below.*

31. **GW-01 — Library `Saved` tab is missing Discover bookmarks.** Recipes the user bookmarked from Discover do not appear under Saved. Predicate is wrong or the bookmark write doesn't match the read filter. Trust failure — user thinks bookmarks are lost. **Status (2026-04-28):** code paths look correct on both platforms. Probable cause is RLS — `recipes_select_published_or_own` (`supabase/migrations/20260419100000_recipes_rls_published_only.sql`) blocks reads of any saved recipe that was later unpublished. Need DB inspection of Grace's saves rows + the `published` column on each referenced recipe. **Deferred until DB inspection.**
32. **GW-02 — Library `Vegetarian` filter returns meat-containing recipes.** Filter is either off the wrong field, off a `tags` string match that misses, or doesn't read `dietary_flags`. Direct contradiction of user dietary intent. **FIXED 2026-04-28 (Batch 14)** — `src/lib/recipes/libraryFilters.ts` now layers (1) `dietaryFlags` ⇒ trust `vegan`/`vegetarian`, (2) `allergens` ⇒ reject `fish`/`crustaceans`/`molluscs`, (3) expanded title keyword scan covering common dishes that don't name the meat (bolognese, schnitzel, kebab, biryani, paella, scallop, etc.). Both web + mobile loaders now thread `dietary_flags` + `allergens` through to the predicate. Pinned by `tests/unit/libraryFilters.test.ts`.
33. **GW-03 — Library `Created` filter returns recipes the user did not create.** Likely matching off the wrong owner column (`created_by` vs `imported_by` vs `user_id`) or showing the global library scoped to "any source" instead of user-owned. **Status (2026-04-28):** mobile predicate is `authorId === userId AND sourceUrl IS NULL → "created"` — code path is correct. If this is firing on recipes Grace didn't create, root is stale `author_id` rows in the DB (e.g. seeded data assigned to her UUID). **Deferred until DB inspection.**
34. **GW-04 — Library `Imported` filter returns recipes the user did not import.** Same root as GW-03 — owner-column mismatch. **Status (2026-04-28):** same code path as GW-03 (`authorId === userId AND sourceUrl IS NOT NULL`). **Deferred until DB inspection.**
35. **GW-05 — Discover search placeholder is dishonest ("Search 48k recipes").** We don't have 48k recipes — that's a placeholder. Replace with "Search recipes" until a real count exists. (See M14-pattern: dishonest copy.) **FIXED 2026-04-28 (Batch 14)** — both platforms now read "Search recipes".
36. **GW-06 — Discover filters don't filter.** Tapping cuisine / time / fit / etc. doesn't change results. Either no-op handlers or predicate not wired into the query. **PARTIALLY FIXED 2026-04-28 (Batch 14)** — the "Quick" pill was passing through any recipe with `cookTimeMin == null` (most legacy imports), so it silently behaved like "All". Both platforms now require a real cook- or prep-time signal and apply a 30-minute total threshold. Other pills (For You / Following / Popular / High Protein / Low Carb) have correct predicates; "For You" intentionally pass-through and "Popular" requires `>= DISCOVER_POPULAR_MIN_SAVES` saves which can read as inert when no rows have hit that threshold.
37. **GW-07 — Plan card showing 0 cal / 0 macros for a recipe that has real macros.** Plan-level read pulls macros from the wrong column (raw row vs computed view), or the plan-row hasn't been backfilled with the recipe's macros at insert time. **Data-correctness violation per `.claude/CLAUDE.md`** — same family as F30.
38. **GW-08 — "Estimations and confidence tags across the app have no actual meaning or accuracy."** Blanket trust failure. TrustChip / confidence labels / "verified" badges / AI-source pills are all surface decoration unless tied to a real backing signal that the user can rely on. Audit every confidence-display surface and either:
    - back it with a real, calibrated signal (DB column, score threshold, source provenance), OR
    - remove the chip until we can.
    *Per `.claude/CLAUDE.md`: "If nutrition / ingredient matching is uncertain, do not guess."* This is the canonical violation in product form.

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
