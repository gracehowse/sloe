# Platform Parity Audit — Web vs Mobile

**Date**: 2026-04-12
**Auditor**: Claude (automated)

---

## Summary

The **web app** was started first and has deeper functionality in several areas (AI meal planning, nutrition tracker with daily logging, recipe creation/publishing, Stripe billing, cook mode with timers). The **mobile app** was built more recently with significant improvements to nutrition accuracy, food search, onboarding, and recipe import — but is missing several web features entirely.

| Area | Web | Mobile | Gap |
|------|-----|--------|-----|
| Auth (email/password) | Sign in + Sign up + Magic link + Password reset | Sign in + Sign up + Apple Sign-In | Web has magic link; Mobile has Apple |
| Onboarding | Profile setup (2-column form, unit toggle, dietary prefs) | 14-step guided flow (TDEE calc, plan pace, strategy, fasting) | Mobile is much stronger |
| Discover/Browse | Infinite scroll feed, search, save | Card grid, search, save, clipboard import | Similar |
| Library | Filter/search saved recipes | List with macros, remove | Similar |
| Recipe Detail | Full page with SEO, JSON-LD, ingredients, instructions | Full screen with macro rings, bookmark, verify link | Web has SEO; Mobile has better macro display |
| Recipe Import | URL import via API | URL import + share intent + clipboard detect | Mobile is stronger |
| Nutrition Verification | None visible | Full verify screen with food search, barcode scan, portion picker | Mobile only |
| Food Search | None visible | Unified search (USDA + OFF), verified badges, inline macros | Mobile only |
| Nutrition Accuracy | Basic (USDA only, no aliases, old scoring) | Advanced (USDA + OFF + FatSecret, 50+ aliases, smart scoring) | Mobile is far ahead |
| Meal Planner | AI-powered, weekly view, drag-to-reschedule | Random assignment from saved recipes, 1/3/7 day | Web is much stronger |
| Nutrition Tracker | Full daily logging, quick-add, macro progress bars | Basic daily logging, quick-add, progress bars | Web is stronger |
| Shopping List | Generated from plan, checklist, export | Generated from plan, checklist, categorised | Similar |
| Cook Mode | Step-by-step with timer extraction | Step-by-step with timer extraction, keep awake | Similar |
| Recipe Creation | Full editor with ingredients, macros, instructions, publish | None | Web only |
| Profile/Settings | Full profile editor, dietary prefs, account management | Profile targets + settings (theme, notifications) | Web is more complete |
| Pricing/Billing | 3-tier pricing page, Stripe checkout | Paywall screen (placeholder, no real IAP) | Web has working billing |
| Notifications | Bell + inbox | Tab + inbox + push permission prompt | Similar |
| Barcode Scanner | None | Camera-based scanner (stubbed) | Mobile only |
| About Nutrition Data | None | Info page with source links | Mobile only |
| Dark Mode | Yes (next-themes) | Yes (theme context) | Both |

---

## Gaps: Mobile → Web (Mobile has, Web needs)

### P0 — Critical (core product functionality)

1. **Nutrition verification pipeline improvements**
   - Web's `verifyIngredients` is the same shared file (`src/lib/nutrition/verifyIngredients.ts`) — already updated
   - But web has NO verify UI — no way for users to review/fix ingredient matches
   - **Action**: Build a verify page/modal on web for recipe ingredients

2. **Food search with unified results**
   - Web has no food search UI at all
   - Mobile has: USDA + OFF unified search, verified badges, inline macros, dedup, title-casing
   - **Action**: Build food search component for web (can reuse the API, needs UI)

3. **Onboarding with TDEE calculation**
   - Web onboarding is a simple 2-column form — no plan pace, no nutrition strategy, no calorie schedule, no fasting, no projection
   - Mobile has 14-step guided flow with budget calculation
   - **Action**: Upgrade web onboarding to match mobile (can be fewer screens but same data collection + TDEE calc)

4. **Fiber/sugar/sodium saved to recipes table**
   - Migration applied to DB (works for both platforms)
   - But web recipe detail + components may not display fiber
   - **Action**: Verify web components read/display `fiber_g`, `sugar_g`, `sodium_mg`

### P1 — Important (user experience)

5. **UK/regional name aliases in search**
   - Already in shared `verifyIngredients.ts` — works for import pipeline on both platforms
   - But web food search (if built) should use same aliases

6. **Recipe import: amount/unit preserved**
   - Already in shared `recipe-import/route.ts` — works for both
   - `saveImportedRecipe` is mobile-only; web may have its own save logic
   - **Action**: Check web import save flow uses amount/unit

7. **Ingredient name updates on verify**
   - `saveVerifiedIngredients` writes `matchedName` as `name` — mobile-only lib
   - **Action**: If web gets verify UI, share this logic

8. **About nutrition data page**
   - Mobile has `/nutrition-sources` with USDA, OFF, FatSecret explanations
   - Web has `/help` page but no nutrition source info
   - **Action**: Add nutrition data section to web help page

### P2 — Nice to have

9. **Apple Sign-In** — iOS only, not applicable to web
10. **Barcode scanner** — camera-based, not applicable to web
11. **Share intent / clipboard detection** — mobile-specific
12. **Notification permission prompt** — mobile-specific

---

## Gaps: Web → Mobile (Web has, Mobile needs)

### P0 — Critical

1. **Recipe creation/upload**
   - Web has full recipe editor: title, ingredients with per-ingredient macros, instructions, image, publish to community
   - Mobile has NO recipe creation at all
   - **Action**: Build recipe creation screen on mobile (at least basic: title, ingredients, instructions, save as private)

2. **AI-powered meal planning**
   - Web has smart AI plan generation (considers macro targets, variety, dietary prefs)
   - Mobile randomly assigns saved recipes to slots
   - **Action**: Connect mobile planner to the same AI generation API, or improve the local algorithm

3. **Nutrition tracker daily logging**
   - Web has: meal slots, quick-add, search-to-log, daily macro progress with circular rings
   - Mobile has: similar but less polished, no search-to-log
   - **Action**: Add food search integration to mobile tracker (log from search results)

### P1 — Important

4. **Magic link authentication**
   - Web supports passwordless magic link sign-in
   - Mobile only has email/password + Apple
   - **Action**: Add magic link option to mobile login

5. **Password reset flow**
   - Web has full reset flow (send email → new password form)
   - Mobile has no password reset
   - **Action**: Add "Forgot password?" link to mobile login that opens reset in browser or in-app

6. **Dietary preferences**
   - Web onboarding collects: vegan, vegetarian, pescatarian, gluten-free, dairy-free, nut-free, halal, kosher
   - Mobile onboarding does not collect dietary preferences
   - **Action**: Add dietary preferences step to mobile onboarding

7. **Recipe publishing (Go Public)**
   - Web users can publish recipes to the community discover feed
   - Mobile has no publish flow
   - **Action**: Add publish option to mobile recipe detail (if user is author)

8. **Stripe billing / subscription management**
   - Web has working Stripe checkout for Base/Pro tiers
   - Mobile paywall is placeholder
   - **Action**: Implement RevenueCat/StoreKit on mobile (separate workstream)

9. **First-run checklist**
   - Web shows `FirstRunChecklist` component guiding new users
   - Mobile has no post-onboarding guidance
   - **Action**: Add a checklist card to mobile discover/home screen

### P2 — Nice to have

10. **Drag-to-reschedule meals** — web planner supports dragging meals between days; mobile could use long-press reorder
11. **Export shopping list** — web has export options; mobile doesn't
12. **Creator analytics** — web Pro feature; not needed on mobile yet
13. **Activity-adjusted calories** — web supports this toggle; mobile doesn't

---

## Intentional Platform Differences (Keep)

| Difference | Reason |
|---|---|
| Apple Sign-In (mobile only) | iOS-specific API, not available on web |
| Barcode scanner (mobile only) | Requires device camera |
| Share intent / clipboard (mobile only) | OS-level share sheet |
| Haptic feedback (mobile only) | No web equivalent |
| Keep screen awake in cook mode (mobile only) | Native API |
| Sidebar navigation (web) vs Tab bar (mobile) | Platform convention |
| SEO / JSON-LD on recipe pages (web only) | Not applicable to native app |
| Next.js SSR / static generation (web only) | Web-specific rendering |
| Deep link handling (mobile only) | OS-level URL routing |

---

## Bugs / Inconsistencies Found

1. **Web onboarding checks `target_calories` for completion; mobile checks `onboarding_completed`** — should use the same field
2. **Web `goal` field uses "cut"/"maintain"/"bulk"; mobile uses "lose"/"health"/"strength"** — should standardise
3. **Web profile stores `age` as integer; mobile onboarding collects DOB option but stores `age`** — consistent but DOB would be better (age changes)
4. **Mobile `saveVerifiedIngredients` writes fiber/sugar/sodium to recipes table; unclear if web recipe save does the same**
5. **Web recipe detail page doesn't query `fiber_g`/`sugar_g`/`sodium_mg` from recipes table** — missing from the SELECT

---

## Implementation Priority

### Phase 1 — Sync nutrition improvements to web (1-2 days)
- [x] Nutrition pipeline improvements already in shared code
- [ ] Update web recipe detail to display fiber/sugar/sodium
- [ ] Add nutrition sources section to web help page
- [ ] Standardise goal field values (web "cut" → "lose" etc.)
- [ ] Standardise onboarding completion check (use `onboarding_completed`)

### Phase 2 — Build missing web UI (3-5 days)
- [ ] Ingredient verification modal/page on web
- [ ] Food search component on web (reuse USDA/OFF APIs)
- [ ] Upgrade web onboarding to include TDEE calc + plan pace + strategy

### Phase 3 — Build missing mobile features (3-5 days)
- [ ] Recipe creation screen on mobile
- [ ] Dietary preferences in mobile onboarding
- [ ] Password reset flow on mobile
- [ ] First-run checklist on mobile home
- [ ] Food search integration in mobile tracker (log from search)

### Phase 4 — Platform polish (2-3 days)
- [ ] AI meal planning on mobile (or API-based)
- [ ] Magic link auth on mobile
- [ ] Recipe publishing on mobile
- [ ] Export shopping list on mobile

---

## Ongoing Sync Process

### Pre-merge Checklist

For every feature or fix, before considering it complete:

- [ ] Does this change affect shared code (`src/lib/`)? If yes, verify both platforms still work.
- [ ] Does this change a database schema? If yes, update both platform's types/queries.
- [ ] Does this change a user-facing flow? If yes, check the equivalent flow on the other platform.
- [ ] Does this change copy/labels? If yes, update the other platform to match.
- [ ] Does this change API routes? If yes, verify both platforms consume the new response shape.

### Shared Sources of Truth

| Asset | Location | Used by |
|---|---|---|
| Nutrition pipeline | `src/lib/nutrition/verifyIngredients.ts` | Web import + Mobile import |
| Ingredient parsing | `src/lib/recipe-ingredients/parseIngredientLine.ts` | Web + Mobile |
| USDA client | `src/lib/usda/fdcClient.ts` | Web API routes |
| OFF client | `src/lib/openFoodFacts/` | Web API routes + Mobile search |
| Estimation fallback | `src/lib/nutrition/estimateIngredientMacros.ts` | Web + Mobile |
| Gram conversion | `src/lib/nutrition/measureToGrams.ts` | Web + Mobile |
| TDEE calculator | `apps/mobile/lib/tdee.ts` | Mobile only — **should move to shared** |
| Name aliases | `src/lib/nutrition/verifyIngredients.ts` | Web + Mobile (via API) |
| Database migrations | `supabase/migrations/` | Both |

### Recommended: Move to shared

These mobile-only files should be moved to `src/lib/` so web can use them:
- `apps/mobile/lib/tdee.ts` → `src/lib/nutrition/tdee.ts`
- USDA search result types should be shared
- `FoodPortion` type should be shared

### Weekly Sync Ritual

1. Run `git diff --stat main` across both `app/` (web) and `apps/mobile/` directories
2. For each changed file, ask: "Does the other platform need this?"
3. Update the parity audit table when features are added
4. Keep this document updated as the single source of truth for platform state
