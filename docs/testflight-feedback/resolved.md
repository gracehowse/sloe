# TestFlight → prod — resolved

Short log of tester-reported issues that were fixed in production (or schema), with enough context for release notes and drift audits.

## 2026-04-19 — Custom food form expansion — natural serving, micros, barcode

- **ASC feedback id:** `AE52_fIRZ-ZIupmoJ8T4yaI` (2026-04-19 01:32 UTC) — "Not enough detail on the add custom food - look at what mfp and lose it do". Screenshot showed the existing Create Custom Food modal capturing only name, brand, base grams, calories, protein, carbs, fat, and fibre. Tester explicitly compared to MyFitnessPal + LoseIt which capture a labelled serving size, a servings-per-container hint, detailed micros (sugar / saturated fat / sodium), and a barcode.
- **Cause:** `CreateCustomFoodSheet.tsx` (mobile) + `create-custom-food-dialog.tsx` (web) captured the minimal macro set from Batch 3.9 but nothing else. The `user_custom_foods` table had room for natural-portion shortcuts in `servings jsonb` but no columns for the other four fields, and the client libs / generated types didn't model them. This meant (a) search hits still rendered as "per 100 g" because the form never captured a canonical serving, even though fix A2 (`b3d4204`) had just taught the picker to surface a natural portion, and (b) users had no way to enter label values (sat fat / sugar / sodium) or a barcode for scan-same-package recall.
- **Fix:**
  - **Schema:** new migration `supabase/migrations/20260424100000_custom_foods_servings_micros_barcode.sql`. Idempotent `add column if not exists` for five optional columns (`servings_per_container numeric`, `sugar_g numeric`, `saturated_fat_g numeric`, `sodium_mg numeric`, `barcode text`), non-negative check constraints wrapped in `do` blocks so they re-apply cleanly, and a partial unique index `user_custom_foods_user_barcode_idx on (user_id, barcode) where barcode is not null` so a user cannot accidentally register two custom foods on the same package. Ends with `notify pgrst, 'reload schema'`.
  - **Generated types:** `src/lib/supabase/database.types.ts` + `apps/mobile/lib/database.types.ts` both gain the full `user_custom_foods` table entry (it was missing from the generated types altogether) including the five new columns. Nullable on Row, optional on Insert / Update.
  - **Shared lib** (`src/lib/nutrition/customFoods.ts`, `src/lib/nutrition/customFoodsClient.ts`):
    - `CustomFood` now carries `servingsPerContainer`, `sugarG`, `saturatedFatG`, `sodiumMg`, `barcode` (all optional).
    - New `validateCustomFoodBarcode(raw)` — trims, accepts 8 / 12 / 13 / 14 digits (EAN-8 / UPC-A / EAN-13 / GTIN-14), empty → unset, anything else → `{ok:false, reason:"Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank."}`. Constant `CUSTOM_FOOD_BARCODE_LENGTHS` keeps the set in one place.
    - `customFoodToMacrosPer100g` now scales sugar (1 dp) and sodium (integer mg) alongside the existing macros. Per-100g projection is deliberately consistent with `scaleMacrosForGrams` so picker previews agree to the byte.
    - New `customFoodToPrimaryServing(food)` — derives a `PrimaryServing` from `servings[0]` and the per-100g projection. Returns `null` when the food has no natural serving (display falls back to /100g only, unchanged).
    - `createCustomFood` + `updateCustomFood` round-trip the five new fields. Update accepts `null` to clear each nullable column. A malformed barcode throws with the same user-facing copy on create + update — never silently dropped.
  - **UI (both platforms, same field order):**
    1. Name (required) + optional brand.
    2. **Natural serving row** — label + grams + optional servings-per-container — prominent above the macro grid. Validation: both empty or both set; disallow half-filled combos.
    3. Macros per `base_grams` (default 100 g) with a live **"Per-serving preview"** underneath computed via the shared per-100g helper so it agrees with search + log-time math.
    4. Collapsed **"Add detailed nutrition"** disclosure hiding sugar / sat fat / sodium + the optional barcode input. Barcode input has a `number-pad` / `inputMode="numeric"` keyboard, `maxLength=14`, and a soft inline error using the shared copy. Disclosure auto-opens on edit when the food already has any detailed field set.
    5. Save button disabled until: name non-empty, `baseGrams > 0`, serving label / grams paired correctly, barcode valid.
  - **A2 wire-up** (fix B integrates with fix A2): `customFoodToRow` (mobile `FoodSearchModal.tsx`) and `customFoodToSearchResult` (web `FoodSearch.tsx`) now populate `primaryServing` from `customFoodToPrimaryServing(food)`. A custom food saved with `servings:[{label:"1 slice",grams:30}]` therefore renders in search with the same per-portion primary line A2 gave Pret sandwiches ("Homemade granola · 120 kcal · 1 slice (30 g)"), not "per 100 g".
- **Verify:**
  1. In TestFlight, open Today → Add Meal → "+ Create custom food". Form shows Name, Brand, Serving size row, Macros grid with live per-serving preview, "Add detailed nutrition" disclosure, and (when expanded) Sugar / Sat fat / Sodium / Barcode. Entering a half-filled serving (label without grams, or vice versa) surfaces the inline pair error and disables Save.
  2. Enter `"1 slice"` + `30` g, macros `240 / 9 / 45 / 3` per 100 g. Preview reads `"1 slice (30 g) ≈ 72 kcal · P 2.7 · C 13.5 · F 0.9"`. Save. Row appears in search with per-portion primary line and `"1 slice (30 g) · 240 kcal / 100 g"` secondary — matches the Pret path from A2.
  3. Enter a 7-digit barcode → inline error, Save disabled. Enter `5012345678900` → accepted.
  4. Edit the same food → detailed-nutrition disclosure auto-opens because sugar / sat fat / sodium / barcode are present.
  5. On prod (after migration): `select column_name from information_schema.columns where table_schema='public' and table_name='user_custom_foods' and column_name in ('servings_per_container','sugar_g','saturated_fat_g','sodium_mg','barcode');` returns five rows.
- **Tests:**
  - `tests/unit/customFoods.test.ts` — +18 tests: barcode validator (empty / GTIN-8/12/13/14 / lengths outside set / non-digit + user-facing copy), `customFoodToMacrosPer100g` sugar + sodium round-trip (1 dp / integer mg / 0-fallbacks), `customFoodToPrimaryServing` (happy path, non-100g base with two-step rounding pinned, null on no servings, null on invalid first serving, label casing preserved).
  - `tests/unit/customFoodsClient.test.ts` — +5 tests: full payload round-trip (natural serving → `servings[0]`, servings_per_container, sugar / sat fat / sodium, barcode trim), rounding precision (sugar / sat fat 1 dp, sodium integer mg), loud rejection of malformed barcodes on create + update, omit of non-positive `servings_per_container`, update-to-null clears every nullable field.
  - `apps/mobile/tests/unit/createCustomFoodFormParity.test.ts` (new, 7 tests) — structural pin that both surfaces carry every `CreateCustomFoodPayload` key, render the same 15 labelled inputs with matching a11y labels / `htmlFor` ids, gate Save on the same four validity rules, share the same barcode error copy (and that the copy is imported from the shared validator), import `validateCustomFoodBarcode` + `customFoodToMacrosPer100g`, and wrap detailed nutrition in the same disclosure copy.
  - All three suites green (`npx vitest run tests/unit/customFoods.test.ts tests/unit/customFoodsClient.test.ts` — 73 tests; mobile vitest — 207 tests).
- **Web parity:** landed in the same pass. `src/app/components/suppr/create-custom-food-dialog.tsx` captures the same fields in the same order with the same validation (including the soft barcode error and the disclosure affordance) and imports the same shared validator + per-100g helper. `src/app/components/FoodSearch.tsx` wires `customFoodToPrimaryServing` into `customFoodToSearchResult` so the web search row surfaces the natural-portion primary line on the same trigger as mobile. Parity test enforces both surfaces won't drift at the import or field-name level.
- **Out of scope (explicit, narrow, actionable):**
  - **Barcode scanner (camera).** Text-only for this pass. A camera-scan path in `CreateCustomFoodSheet` needs `expo-camera` + `expo-barcode-scanner` wired into the mobile config + the iOS camera permission string in `app.json`. Tracked for a follow-on pass.
  - **Photo + meal-category fields.** MFP + LoseIt have these; we deferred both — photo needs the image-upload pipeline (Supabase Storage policies, client compression, CDN read path) and meal category duplicates the Today meal-slot picker. Noted in the tester-feedback backlog, not this commit.
  - **Fix C (server-side push fan-out).** Separate track, not touched here.
- **Follow-up:** migration `20260424100000_custom_foods_servings_micros_barcode.sql` is **not yet applied to prod** — the sandbox cannot run `supabase db push`. The user must apply it with `supabase db push --linked` (or `supabase db query --linked -f supabase/migrations/20260424100000_custom_foods_servings_micros_barcode.sql` for a one-off) before any client write of the five new fields can land. Until then, creating a custom food with the old form field set (name + macros + `servings[]`) continues to work — the extra payload keys are simply dropped by the schema. After the migration applies, the form's new fields start persisting automatically (no client-release coordination needed).

## 2026-04-19 — Mobile keyboard covers submit buttons (systemic) — build 9 fix D

- **Source:** in-session tester report against TestFlight build 9 (2026-04-19). "On the login screen, the iOS keyboard does not collapse when it should — it covers the Sign In button." Tester also noted: "this appears elsewhere on the app too" — so the report is systemic, not a one-off.
- **Cause:** the textbook React Native pattern. Screens with text inputs need three things wired up together to avoid the symptom, and doing it inline per-screen had already drifted:
  1. `KeyboardAvoidingView` with the right `behavior` per platform so the layout lifts when the keyboard opens (`"padding"` on iOS, `"height"` on Android).
  2. `keyboardShouldPersistTaps="handled"` on the inner `ScrollView` so the first tap on a submit button doesn't get consumed by the auto-dismiss gesture (that's what made the user "tap Sign In twice").
  3. A background `Pressable` that calls `Keyboard.dismiss()` on tap so the user can deliberately collapse the keyboard.
  Login carried none of these. Onboarding + `CreateCustomFoodSheet` had a bare inline `KeyboardAvoidingView` without the other two. `FoodSearchModal` and `weight-tracker` had partial coverage. Five of the six surfaces had a different set of gaps.
- **Fix:**
  - **New shared primitive** `apps/mobile/components/KeyboardSafeView.tsx`. One narrow wrapper that bundles the three pieces above. Props: `scroll` (default true — renders inner `ScrollView` with `keyboardShouldPersistTaps="handled"` + `automaticallyAdjustKeyboardInsets` on iOS), `dismissOnBackgroundTap` (default true — wraps children in an `accessible={false}` Pressable that calls `Keyboard.dismiss()`), `keyboardVerticalOffset` (default 0 — tune for screens with a nav header), plus `behavior` override and `style` / `contentContainerStyle` pass-through.
  - **Applied to the six priority-screens** called out in the ticket (all of the highest-traffic mobile text-input surfaces):
    1. `apps/mobile/app/login.tsx` — the reported bug. No prior keyboard handling; wrapped with defaults.
    2. **Sign-up** — lives in `login.tsx` behind an `isSignUp` toggle (no separate `signup.tsx`). Covered by (1).
    3. `apps/mobile/app/onboarding.tsx` — had inline `KeyboardAvoidingView`; replaced with `KeyboardSafeView scroll={false} dismissOnBackgroundTap={false}` because the screen owns its own ScrollView + sticky bottom CTA.
    4. `apps/mobile/components/CreateCustomFoodSheet.tsx` — had inline `KeyboardAvoidingView`; replaced outer shell only (not touching form internals — coordinates with track B's expansion). `scroll={false}, dismissOnBackgroundTap={false}` because the backdrop Pressable already handles close.
    5. `apps/mobile/components/FoodSearchModal.tsx` — wrapped outer body; `scroll={false}, dismissOnBackgroundTap={false}` because the inner FlatList has its own scroll with `keyboardShouldPersistTaps="handled"`.
    6. `apps/mobile/app/weight-tracker.tsx` — wrapped outer body; added `keyboardShouldPersistTaps="handled"` to the existing inner `ScrollView` so the manual weight-entry Save button doesn't need the double-tap.
- **No new dependency.** `react-native-keyboard-controller` / `react-native-keyboard-aware-scroll-view` were considered; neither is currently a mobile dep and adding one for this pass would widen surface area beyond the fix. Built on core RN primitives (`KeyboardAvoidingView`, `ScrollView`, `Pressable`, `Keyboard.dismiss`, `Platform`).
- **Verify:** in TestFlight, Today → Login → focus email → keyboard lifts the form; Sign In button remains tappable in one tap (previously required dismiss + re-tap). Tapping the background outside inputs dismisses the keyboard. Same on the password field. For Create Custom Food sheet: keyboard opens, the Save CTA at the bottom lifts above the keyboard; the backdrop tap still closes the sheet. Onboarding height/weight/age steps: keyboard lifts, Continue CTA stays visible.
- **Tests:**
  - `apps/mobile/tests/unit/keyboardSafeView.test.tsx` — RNTL render test (14 assertions). Pins: scroll=true renders a `RCTScrollView` with `keyboardShouldPersistTaps="handled"`; `automaticallyAdjustKeyboardInsets` is true on iOS, false on Android; scroll=false renders no inner ScrollView; dismissOnBackgroundTap=true creates an `accessible={false}` Pressable that calls `Keyboard.dismiss` on press; dismissOnBackgroundTap=false renders no dismiss Pressable; behavior defaults to `"padding"` on iOS and `"height"` on Android; explicit `behavior` override wins; `keyboardVerticalOffset` forwards to the KAV.
  - `apps/mobile/tests/unit/keyboardSafeViewAdoption.test.ts` — structural grep test (15 assertions, same style as `householdCardParity.test.ts`). Pins: each of the five priority-screen consumer files imports `KeyboardSafeView` (via either the `@/components/...` alias or a relative `./KeyboardSafeView`), renders `<KeyboardSafeView>...</KeyboardSafeView>`, and carries no inline `KeyboardAvoidingView` or stray import — so the codebase can't drift back into two patterns.
- **Web parity:** **not applicable.** Browsers surface the software keyboard through the OS, not the web runtime. Focused inputs are auto-scrolled into view by the browser; the keyboard never covers in-page controls. There is no `KeyboardSafeView` counterpart to add on web. Noted here so a future reader doesn't chase phantom parity.
- **Known remaining (follow-up, not this pass):** 25 other mobile files reference `TextInput` and were not wrapped. The scope of this pass was deliberately bounded to the highest-traffic surfaces in the ticket (login, signup, onboarding text-input steps, Create Custom Food sheet, Food search modal, Weight tracker entry). A future sweep should evaluate each of the following, wrap where needed, and replace any remaining inline `KeyboardAvoidingView` with the shared primitive so we don't re-introduce drift:
  - `apps/mobile/app/(tabs)/index.tsx`, `search.tsx`, `library.tsx`, `discover.tsx`, `progress.tsx`, `more.tsx`, `settings.tsx`, `barcode.tsx`
  - `apps/mobile/app/profile.tsx`, `create-recipe.tsx`, `import-shared.tsx`
  - `apps/mobile/app/recipe/[id].tsx`, `apps/mobile/app/recipe/verify.tsx`
  - `apps/mobile/components/today/TodayAddFoodForm.tsx`, `TodayEditMealModal.tsx`
  - `apps/mobile/components/AddIngredientSheet.tsx`, `OverrideIngredientSheet.tsx`, `PlanTemplatesSheet.tsx`, `PhotoLogSheet.tsx`, `VoiceLogSheet.tsx`, `SaveMealSheet.tsx`, `RecipeNotesCard.tsx`, `HouseholdCard.tsx`, `BarcodeScannerModal.tsx`
  - Also: the inline `<KeyboardAvoidingView>` still present in `import-shared.tsx`, `create-recipe.tsx`, `BarcodeScannerModal.tsx`, `PhotoLogSheet.tsx`, `VoiceLogSheet.tsx`, `SaveMealSheet.tsx`, and `app/(tabs)/barcode.tsx` should be consolidated to `KeyboardSafeView`.
- **Out of scope this pass:** per-screen wrapping for the 25 files above; a new keyboard-controller npm dep; any non-RN input surfaces (camera / barcode scanners). Explicit track coordination — do not touch: `src/lib/nutrition/primaryServing.ts` (A2), `src/lib/push/*` / `app/api/push/*` (C), `supabase/migrations/2026042*` (schema), `CreateCustomFoodSheet.tsx` form internals (B) — only the outer shell was touched.

## 2026-04-19 — Server-side weekly recap push fan-out

- **ASC feedback ids:** `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0` — server-side delivery follow-up to the 2026-04-18 token-capture shipment (see the "APNs push token registration" entry below). The earlier pass populated `profiles.expo_push_token` when the user granted OS permission, but nothing on the server ever consumed that column — the only delivery path shipping was `apps/mobile/lib/weeklyRecapPush.ts`, which scheduled a **local** weekly notification on-device via `scheduleNotificationAsync`. The address book was full and no remote push had ever been delivered through Apple's APNs.
- **Cause:** no server-side fan-out existed. The weekly-recap user-journey implicitly assumed a backend path that had never been built.
- **Fix — client/server breakdown:**
  - **Shared Expo push helper** `src/lib/push/expoPush.ts` — pure, Next.js-free, chunkable at the Expo 100-message-per-POST limit. Validates every token against a permissive `^(?:Exponent|Expo)PushToken\[[^\]]+\]$` regex before spending a network round-trip. Retries exactly once on 5xx / network error with a bounded 250ms backoff; does not retry on 4xx (caller bug, not transient). Returns a tagged union `{ ok: true, tickets, deregisteredTokens, invalidTokens } | { ok: false, error, statusCode? }`. When Expo returns a ticket with `status: "error"` and `details.error === "DeviceNotRegistered"` the offending token is surfaced in `deregisteredTokens` for caller cleanup — the helper itself never writes to Supabase.
  - **Service-role admin client** `src/lib/supabase/serverAdminClient.ts` — thin wrapper around the existing `createSupabaseServiceRoleClient` in `serverAnonClient.ts`, re-exported under an explicitly-named "admin" module so server-to-server entry points (cron routes, scripts) have a dedicated import surface and accidental client-side imports stand out in review.
  - **Cron route** `app/api/push/weekly-recap/route.ts` — POST only, auth-gated via an `X-Cron-Secret` header that must match `process.env.SUPPR_CRON_SECRET`. Selects `profiles` where `weekly_recap_push_enabled = true` and `expo_push_token IS NOT NULL`, capped at 5000 rows per invocation. Accepts an optional `?weekStartDay=monday|sunday` query param for cohort-filtered runs (ignores any other value). Dedupes by skipping rows whose `last_weekly_recap_push_sent_at` is within 6 days of now. Fans out via `sendExpoPush` using copy aligned with the mobile local-push copy so users whose delivery flips between local and remote do not see different wording week-to-week. Post-send: stamps `last_weekly_recap_push_sent_at = now()` for successfully-ticketed user ids, and nulls `expo_push_token` for `DeviceNotRegistered` user ids so we stop pushing to dead installs. Emits one structured `console.log({…})` per invocation — no per-user logs.
  - **Migration** `supabase/migrations/20260424110000_weekly_recap_push_last_sent.sql` — `alter table public.profiles add column if not exists last_weekly_recap_push_sent_at timestamptz;` + `notify pgrst, 'reload schema';`. Idempotent.
  - **Generated types:** `src/lib/supabase/database.types.ts` and `apps/mobile/lib/database.types.ts` both carry the new `last_weekly_recap_push_sent_at: string | null` on Row / Insert / Update for `profiles`.
  - **Vercel cron wiring** new `vercel.json` at repo root with two entries: `/api/push/weekly-recap?weekStartDay=monday` at `0 18 * * 0` (Sunday 18:00 UTC — Monday-start cohort end-of-week), and `/api/push/weekly-recap?weekStartDay=sunday` at `0 18 * * 6` (Saturday 18:00 UTC — Sunday-start cohort end-of-week). Vercel crons fire in UTC; per-user timezone delivery is deferred (see Follow-up).
  - **Mobile-side coordination** (parity-critical) `apps/mobile/lib/weeklyRecapPush.ts:scheduleWeeklyRecapPush` — before scheduling the local `WEEKLY` notification, reads `LAST_PUSH_TOKEN_CACHE_KEY` from AsyncStorage. If a non-empty value is cached the helper cancels any existing local schedule and returns `null` so the user does not get both a local ping and the remote push on the same day. A leading comment explains why the local path is suppressed. Users without a token (permission denied, simulator, pre-upgrade installs that never ran the registration path) continue to get the local fallback so we do not regress a working nudge while server delivery rolls out.
- **Verify:**
  1. Apply the migration (see Follow-up).
  2. Set `SUPPR_CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` on Vercel production.
  3. Deploy; confirm Vercel picks up the two cron entries under Project → Settings → Cron Jobs.
  4. With a TestFlight install that has previously granted notifications, hit the route by hand: `curl -X POST "$HOST/api/push/weekly-recap" -H "X-Cron-Secret: $SECRET"` → expect `{ok: true, attempted, succeeded, deregistered}`. The device should receive one remote "Your week in Suppr" push.
  5. Re-run within 6 days → `attempted` decrements because `last_weekly_recap_push_sent_at` is now within the dedupe window for that user. No second push lands.
  6. Uninstall the app, re-run → the ticket comes back `DeviceNotRegistered`, the route nulls the `expo_push_token` row, and subsequent runs no longer attempt that user.
- **Tests:**
  - `tests/unit/expoPush.test.ts` (13 tests) — chunking at 100, single retry on 500 then success, no retry on 400, retry-then-fail on 503, retry on rejected network, `DeviceNotRegistered` extraction (echoed + fallback), non-DeviceNotRegistered errors not flagged, invalid-token regex rejection (empty, malformed, non-string), short-circuit when every token is invalid.
  - `tests/unit/weeklyRecapPushRoute.test.ts` (9 tests) — 401 on missing / wrong secret, 503 when `SUPPR_CRON_SECRET` is unset, happy-path fan-out with bookkeeping, 6-day dedupe skip, `DeviceNotRegistered` → null token, cohort forwarded to query, bogus cohort ignored, empty-eligible path returns zero counts.
  - `apps/mobile/tests/unit/weeklyRecapPushSuppression.test.ts` (4 tests) — cached token suppresses the local schedule, absent token preserves the fallback, empty-string cache value treated as no-token, opt-out (`enabled: false`) still cancels and returns null.
- **Parity:** route itself is server-only and therefore platform-neutral. Mobile is the parity-critical surface — the AsyncStorage-cached token gate prevents the double-delivery regression that would otherwise land the moment the cron starts firing.
- **Follow-up:**
  - **Apply the migration on prod:** `supabase db push --linked` (or idempotent one-off `supabase db query --linked -f supabase/migrations/20260424110000_weekly_recap_push_last_sent.sql`). Migration is NOT yet applied to prod.
  - **Env vars required on Vercel production:**
    - `SUPPR_CRON_SECRET` — generate a fresh 32-byte value (`openssl rand -hex 32`). NOT yet set.
    - `SUPABASE_SERVICE_ROLE_KEY` — copy from Supabase dashboard if not already present. Existing account-delete route already needs it, so it is likely set.
  - **Cron takes effect on next production deploy** — Vercel picks up `vercel.json` at build time.
  - **Per-user timezone delivery** is deferred. The two cohort crons at 18:00 UTC mirror what the existing local scheduler approximates; users outside UTC will see the ping earlier/later than the ideal end-of-week moment. Future pass: drive fan-out from Supabase `pg_cron` bucketing by profile timezone, or pre-compute next-fire timestamps per-row and pull rows whose fire time has passed. Not a blocker for this shipment.
  - **DeviceNotRegistered analytics** — we null the token but do not emit a PostHog event today. Nice-to-have once the baseline numbers on attempted/succeeded/deregistered settle.
  - **Route reuse for additional push types** (streak nudges, meal-plan reminders) is an explicit non-goal for this pass. The route is narrowly scoped to weekly recap; broaden only by adding new routes under `app/api/push/*` that reuse `sendExpoPush`.

## 2026-04-19 — Per-serving display in food search (Edamam + USDA)

- **ASC feedback id:** `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19 01:31 UTC) — "Everything still 100g rather than proper servings". Screenshot: Today → Search Foods for "pret sandwich" where every row — including `Pret a Manger UK · Pret tuna sandwich` (Edamam) and `Cuban sandwich` (USDA) — rendered as `211 kcal · P:10.3g C:24.1g F:7.7g per 100g`. Tester compared against MFP / LoseIt which default to the item's natural portion ("1 sandwich, 230 g, 480 kcal").
- **Cause:** the display layer read `macrosPer100g` and the `calsPer100g` badge from every source verbatim and never composed a per-portion primary line. Upstream, `/api/usda/search` didn't surface the branded `servingSize` / `servingSizeUnit` / `householdServingFullText` or the non-branded `foodPortions[]`, so there was no way for the row render to know a Pret sandwich weighs 230 g. Edamam already exposed `food.servingSizes[]` through `/api/edamam/search` — it just wasn't read.
- **Fix:**
  - **New shared helper** `src/lib/nutrition/primaryServing.ts`. Pure functions: `pickEdamamPrimaryServing`, `pickUsdaBrandedPrimaryServing`, `pickUsdaFoodPortionsPrimaryServing`, `parseOffPrimaryServing`, plus `scalePrimaryServingFromPer100g` (the macro math) and `primaryServingToPortionChip` (FoodPortion-shaped adapter). Source rules match MFP/LoseIt behaviour: Edamam picks the first `servingSizes[]` entry whose label is not `"Gram"` and whose quantity > 0; USDA Branded prefers `servingSize` + `servingSizeUnit` (`g` / `GRM` / `ml` treated as mass) with the human label from `householdServingFullText`; USDA Survey / Foundation / SR Legacy reads `foodPortions[]` and skips the `"Quantity not specified"` / `"1 g"` placeholders; OFF parses only unambiguous `"N g"` / `"N ml"` / `"1 slice (28 g)"` shapes and returns null for free-text like `"1 piece"`.
  - **Server widening:** `src/lib/usda/fdcClient.ts` now forwards `servingSize`, `servingSizeUnit`, `householdServingFullText`, and a narrow subset of `foodPortions[]` on each search hit. `/api/usda/search` passes them through. The `/api/edamam/search` envelope already carried `servingSizes[]`.
  - **Unified result type:** `UnifiedSearchResult.primaryServing` added. `apps/mobile/lib/verifyRecipe.ts` computes it inside `mergeResults` for every source.
  - **Row render (mobile + web):** when `primaryServing` is present, the primary line shows `{kcal} kcal · P/C/F` for the natural portion; a subdued secondary line shows `{label} ({grams} g) · {per100gKcal} kcal / 100 g`. Right-rail kcal number uses the portion value, not the /100g value. When `primaryServing` is null (generic USDA rows with no portions, Edamam rows that expose only `"Gram"`) the existing /100g-only display is unchanged.
  - **Preview default:** when a natural portion exists, the portion picker prepends it as the first chip (via `primaryServingToPortionChip`) and seeds `chosenPortion` to it with `quantity = 1`. Users can still switch to grams or any other chip — just not the default any more.
- **Verify:** Today → Search Foods → "pret sandwich" in TestFlight. Every Pret / USDA branded row renders the per-portion kcal primary with `1 sandwich (230 g)` secondary and the `/ 100 g` reference. Tapping opens the preview defaulted to the natural portion (not 100 g). Generic USDA rows with no portions still render /100 g as before.
- **Tests:** `tests/unit/primaryServing.test.ts` pins the six source-specific rules (Pret tuna scaled 100g → 230g math; Edamam Serving + Gram → picks Serving; Edamam Gram-only → null; USDA Branded 230 g + "1 SANDWICH" → scales & lowercases; USDA Survey "Quantity not specified" → skipped; OFF `"1 slice (28 g)"` / `"28 g"` → parsed, `"1 piece"` → null). `apps/mobile/tests/unit/foodSearchPrimaryServingParity.test.ts` is a structural parity test that greps both surfaces for the shared helper imports and checks the primary-line / `kcal / 100 g` secondary render on each side.
- **Web parity:** landed in the same pass. `src/app/components/FoodSearch.tsx` imports the same helpers from `src/lib/nutrition/primaryServing.ts`, renders the same primary + `/100 g` secondary format, and defaults the preview picker to the natural portion. Parity enforced by the structural test above.
- **Out of scope this pass:** logged-entry schema (`nutrition_entries`), custom-food form expansion (fix B), push fan-out (fix C), backfill of historic search caches.

## 2026-04-18 — Trial / payments "not hooked up" (mobile paywall silent fall-through)

- **ASC feedback id:** `AFE6h9Tlq0bUCugLAJfVGx8` — "None of the trial/payments stuff is hooked up".
- **Cause:** `apps/mobile/app/paywall.tsx:onStartTrial` had `if (!pkg) router.replace("/notifications-prompt")` — when RevenueCat returned no offerings (TestFlight + App Store Connect IAP not yet provisioned, or sandbox account not signed in), tapping **Start trial** silently routed to the next onboarding screen as if the purchase succeeded. From the tester's POV nothing happened — no Apple pay sheet, no error, no entitlement. Looked entirely unhooked.
- **Fix:** the `!pkg` branch now surfaces a labelled `Alert.alert` ("Subscriptions not available" + reason — "couldn't load any plans" vs "subscriptions aren't enabled in this build" depending on `isPurchasesApiKeyPresent()`) with two buttons: "Continue free" (explicit) and "OK" (stay on the screen). On a successful `purchasePackage` we now also verify `isProEntitled(customerInfo)` before advancing — a transaction can return `success:true` before the entitlement propagates, and we don't want to celebrate a non-entitled state.
- **Verify:** in TestFlight without provisioned IAP, tapping Start trial now shows the alert (no silent route). Once App Store Connect IAP products + RevenueCat dashboard offerings are configured, the alert path is bypassed automatically (a non-empty `packages` array triggers the real purchase sheet).
- **Out of scope (config, not code):** App Store Connect IAP product IDs + RevenueCat dashboard offerings still need to be provisioned for the live trial flow. That's a release-gate task for the monetisation milestone, not a TestFlight bug.

## 2026-04-18 — Edamam restaurant + branded foods integration

- **ASC feedback id:** `AOI9xgY88Dx-uphiXI8IzEk` — "Unclear if edamam is integrated yet? I would expect meals to show here from restaurants etc."
- **Cause:** `src/lib/edamam/client.ts` existed (configured server-side via `EDAMAM_APP_ID` / `EDAMAM_APP_KEY`) but it was only used inside `verifyIngredients` for ingredient-line resolution. There was no client-callable surface that exposed the food / restaurant database, and neither the Today food search nor Discover surfaced any Edamam content.
- **Fix:** wired Edamam into both surfaces the user asked for.
  - **API route** `app/api/edamam/search/route.ts` — auth-gated, rate-limited (30/min), wraps `edamamFoodSearch` and returns a `{ foodId, label, brand, calories, protein, … }` envelope shaped to match `/api/usda/search` so the mobile merger can absorb it. Supports `mode=foods` (general) and `mode=meals` (filters to restaurant + packaged categories for Discover).
  - **Today Add Meal (mobile)** — new `searchEdamam()` helper in `apps/mobile/lib/verifyRecipe.ts` runs in parallel with USDA + OpenFoodFacts; `searchFoods()` streams partial results as each source resolves so USDA stays instant. New `Edamam` source variant in `UnifiedSearchResult`; `FoodSearchModal` picks it up via the inline-macros tap branch (no extra fetch). Restaurant rows get a "Restaurant · {brand}" subtitle.
  - **Discover (mobile)** — new "Eating out" horizontal carousel above the recipe grid; only renders when the search query is ≥ 3 chars (debounced 350ms so each keystroke doesn't burn quota). Each card shows brand + label + per-100g kcal/protein. Tapping bridges to Today with the search prefilled. Empty / loading states are first-class.
- **Verify:** in TestFlight, open Today → Add Meal → search "eggs benedict" — Egg, Benedict (USDA generic) appears alongside any restaurant matches from Edamam. Open Discover → type "burger" — the "Eating out" row appears with brand-tagged restaurant items.
- **Web parity:** landed in the same pass (2026-04-18). `src/app/components/FoodSearch.tsx` now imports a `searchEdamam()` helper that calls the same `/api/edamam/search` route in parallel with USDA + OFF; merger widened to take a fourth source array. `src/app/components/DiscoverFeed.tsx` adds the same "Eating out" horizontal scroll row (debounced 350ms, hidden until the query is ≥ 3 chars). Mobile + web are now feature-equivalent for this surface.

## 2026-04-18 — Progress Daily Calories chart "not intuitive"

- **ASC feedback id:** `AISAWnLgU9cjRBOuEY-HuJU` — Progress tab "not intuitive" (screenshot retrieved 2026-04-18, showed bars in green/amber with no intake-target line and no legend).
- **Cause:** the bar colours encoded "at/under target" vs "over target" but there was no on-chart reference to show where the target sat, and no legend to explain the colours. Users couldn't read the chart without inspecting every bar.
- **Fix:** added (a) a dashed accent-coloured target line drawn across the full chart at `targets.calories`, positioned absolutely over the bar grid (`pointerEvents=none` so bars stay tappable); (b) an inline legend under the chart — green swatch "At or under target", amber swatch "Over target", dashed line "Target {N} kcal". `apps/mobile/app/(tabs)/progress.tsx`. The "Daily goal" text-only line below the chart is replaced by the legend.

## 2026-04-18 — Weight section: start-of-range callout + milestone-tent journey bar (follow-on)

- **ASC feedback id:** `AF7bS2DQrH_wZWxGosBJ3K8` (cosmetic polish, follow-on to the same item logged below).
- **Fix:** in `apps/mobile/components/charts/TrendLine.tsx`, added a start-of-range callout pill rendered next to the leftmost data point (label uses the same `formatValue` formatter as the rest of the chart). In `apps/mobile/app/weight-tracker.tsx`, replaced the bare progress bar in the Journey card with a tent (⛺) → bar → flag/trophy (🏁/🏆) anchored layout, with start-pill ("0 kg") and end-pill (total to lose) bracketing the fill — closer to the LoseIt reference. Tent emoji ⛺, finish flag 🏁 (or trophy 🏆 when goal hit) — emoji-only so no asset pipeline change.

## 2026-04-18 — Macro Detail "duplicate 79.4g" MFP rows

- **ASC feedback id:** `ABwH6OVJ-kJxC5LdcL3iEzc`. Screenshot: "Protein · Yesterday · 204.3g" split as Dinner 79.4g / Snacks 79.4g / Breakfast 45.5g — Dinner and Snacks showed **identical** numbers from the same MFP sync.
- **Cause:** the MFP bulk-sync collapse bug documented under "HealthKit macro inflation" below — multiple foods flushed at the same `startDate`/`endDate` were being summed into one entry, then the same summed value was being attached to different meal slots by the day-level breakdown.
- **Fix:** implicitly resolved by the P0-2 correlation-UUID fix in `apps/mobile/lib/healthSyncCorrelation.ts` (same pass, 2026-04-18). Once each energy sample gets its own correlation parent, the macro values attach to the right food and the breakdown no longer shows duplicate 79.4g rows.
- **Verify:** re-import a multi-meal MFP day from HealthKit; open Macro Detail → Protein for that day; each meal row should carry its own macro value matching what MFP showed, not duplicates.

## 2026-04-18 — Weekly-recap toggle "could not save"

- **ASC feedback id:** `AMsdTaWai1sJijvuX1VQJg4`. Screenshot: Settings → Weekly recap bottom sheet → "Could not save · We couldn't save your preference. Please try again." alert.
- **Cause:** same schema-drift family as the earlier alcohol-limit save failure. The toggle writes `profiles.weekly_recap_push_enabled` (shipped in migration `20260421170000_streak_freeze_weekly_recap.sql`) but the column was missing on prod when the tester submitted, so the update call errored.
- **Fix:** the 2026-04-18 `supabase db push --linked` through `20260421180000` applied that migration. Verified on prod: `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='weekly_recap_push_enabled';` returns one row.
- **Verify:** Settings → Weekly recap → toggle on/off → no "Could not save" alert; state persists across force-quit.

## 2026-04-18 — Weight section: delta stat + goal-line label

- **ASC feedback id:** `AF7bS2DQrH_wZWxGosBJ3K8` (5 screenshots — LoseIt references).
- **Cause:** The existing `apps/mobile/app/weight-tracker.tsx` showed current + goal as side-by-side stats but no **directional delta** (e.g. "↑ 1.4 kg past 3 months") in the chart-card header, and the dashed goal line on the chart carried no inline numeric label — both of which the tester's reference screenshots made prominent.
- **Fix (narrow):**
  - Added a `rangeDelta` memo to `weight-tracker.tsx` that computes `last − first` over the selected `TimeRange` and produces `{ arrow, magnitude, unit, label }`. Arrow is `↑ / ↓ / →`; label resolves to "past week / past month / past 3 months / past 6 months / past 9 months / past year / since <first date>".
  - Rendered the delta in the Weight card header, right-aligned next to the title.
  - Added an inline numeric goal label at the right edge of the dashed goal line inside `apps/mobile/components/charts/TrendLine.tsx` (new `SvgText` node) so the goal number is legible on the chart itself, not only in the legend underneath.
- **Deferred (logged, not shipped):** start-of-range callout pill ("54.1") at the leftmost chart point; milestone-tent progress bar in the Journey card. Both cosmetic polish; kept in `docs/planning/testflight-build-7-remaining.md` under P1-2 as follow-on polish.
- **Screenshots:** archived under `docs/testflight-feedback/data/screenshots/AF7bS2DQrH_wZWxGosBJ3K8/weight_{1..5}.jpg` (gitignored along with the rest of `data/`). Force-add if you want to preserve a snapshot for a design review.

## 2026-04-18 — APNs push token registration

- **ASC feedback ids:** `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`. Both: iOS notification prompt re-fires every cold launch and no notifications ever deliver.
- **Cause:** `apps/mobile/app/notifications-prompt.tsx` called `requestPermissionsAsync()` and stored nothing. There was no `getExpoPushTokenAsync` call anywhere in `apps/mobile/`, so no Expo push token was ever written to Supabase — the server had no address to push to. The prompt also re-appeared every launch because permission state was not persisted client-side after the first grant. `profiles` had no column to store the token in either.
- **Fix:**
  - **Schema:** new migration `supabase/migrations/20260423100000_profile_expo_push_token.sql` adds `profiles.expo_push_token text` (nullable, no default), idempotent, with `notify pgrst, 'reload schema'` at the end.
  - **Helper:** new `apps/mobile/lib/expoPushToken.ts` owns the lifecycle:
    - `registerExpoPushTokenForUser(userId)` — fetches the Expo token using `Constants.expoConfig.extra.eas.projectId`, writes `profiles.expo_push_token` for the current user, and caches the value in AsyncStorage under `expo_push_token_last_synced_v1`.
    - `refreshExpoPushTokenIfChanged(userId)` — focus-effect refresh; no-ops when the cached value matches, writes when the token has rotated (reinstall / restore-from-backup).
    - `markNotificationsPromptDismissed()` / `hasNotificationsPromptBeenDismissed()` — own the AsyncStorage flag `notifications_prompt_dismissed_v1` so the prompt screen and any future re-entry point share one source of truth.
  - **Prompt screen** (`apps/mobile/app/notifications-prompt.tsx`):
    - On mount: checks `hasNotificationsPromptBeenDismissed()` (AsyncStorage flag OR OS already reports `granted` / `denied`) and `router.replace`s away without rendering when truthy. Renders nothing during the check so the explainer never flashes.
    - On grant: calls `registerExpoPushTokenForUser(userId)` then `markNotificationsPromptDismissed()`.
    - On denial / skip: calls `markNotificationsPromptDismissed()` so a deliberate "no" doesn't re-nag every launch.
    - Errors swallowed via `console.warn` per existing notification-prompt error pattern (no crash on simulator / no-network / RLS hiccup).
  - **Token rotation:** `apps/mobile/app/(tabs)/index.tsx` adds a new `useFocusEffect` calling `refreshExpoPushTokenIfChanged(userId)`. Cheap because the helper short-circuits on cache hit.
  - **Generated types:** `apps/mobile/lib/database.types.ts` and `src/lib/supabase/database.types.ts` both updated by hand to add `expo_push_token: string | null` (Row, Insert, Update) so client writes type-check.
- **Verify:**
  1. Fresh install on TestFlight: open app, see explainer, tap "Turn on notifications", grant. Force-quit and re-launch → no prompt re-appears.
  2. Decline path: fresh install, tap "Skip" or deny in OS dialog → no prompt re-appears.
  3. After a successful grant, query `select expo_push_token from public.profiles where id = '<user>';` — non-null `ExponentPushToken[...]` value present.
  4. Send a test push from the Expo push tool (`https://expo.dev/notifications`) targeting that token — notification arrives.
- **Tests:** `apps/mobile/tests/unit/expoPushToken.test.ts` (17 tests) covers:
  - `hasNotificationsPromptBeenDismissed` — AsyncStorage flag, OS `granted` / `denied` / `undetermined` paths.
  - `registerExpoPushTokenForUser` — happy path (correct project ID, correct DB write, cache populated), null-user, fetch-failure, DB-failure.
  - `refreshExpoPushTokenIfChanged` — no-op on cache hit, write on rotation, skip when permission revoked.
  - Source-level pins on `notifications-prompt.tsx` (helpers wired on mount + both exit paths) and `(tabs)/index.tsx` (focus-effect refresh wired).
  - All 155 mobile vitest tests still pass.
- **Server-side delivery (still missing — NOT fabricated):** the existing weekly recap (`apps/mobile/lib/weeklyRecapPush.ts`) uses `expo-notifications` `scheduleNotificationAsync` with a `WEEKLY` trigger — that is a **local** notification and does not consume `profiles.expo_push_token`. There is no server route today that POSTs to `https://exp.host/--/api/v2/push/send`. This pass adds the column, the client write, and the suppression flag so the address book is finally being populated; building the server-side fan-out (and switching the recap from local to remote, if/when desired) is a separate piece of work tracked in `docs/planning/testflight-build-7-remaining.md` P0-1's follow-up — not invented in this commit.
- **Follow-up:**
  - Migration file is committed but `supabase db push --linked` was **not** run from this session (sandbox blocked the supabase CLI). The user must apply with `supabase db push --linked` (or `supabase db query --linked -f supabase/migrations/20260423100000_profile_expo_push_token.sql` for an idempotent one-off) before the client write can land in prod.
  - Once a server-side push delivery path lands, add an integration test that reads `profiles.expo_push_token` and forms a valid Expo push payload (skipped here per the "don't fabricate a server route" constraint).

## 2026-04-18 — HealthKit macro inflation (MFP bulk sync)

- **ASC feedback id:** `AJHZNp8NHTiFNk9TjQfdYBk` (TestFlight build 7) — a day imported from MyFitnessPal via Apple HealthKit showed carbs dramatically higher than the actual MFP daily total.
- **Cause:** `apps/mobile/lib/healthSync.ts:syncNutritionFromHealth` correlated dietary energy + macro samples by an `effectiveMinute|bundleId` key (`dietaryCorrelationKey`). MFP (and other third-party loggers) often flush an entire day's foods in a single batch where every food shares `startDate = local midnight` (or sync time). When N energy samples from the same `bundleId` landed in the same minute bucket, **all** their carbs / protein / fat were summed into one `nutrition_entries` row — a single inflated entry per day instead of one row per food.
- **Fix:** New pure helper module `apps/mobile/lib/healthSyncCorrelation.ts` keys dietary samples by their HealthKit food-correlation parent UUID:
  1. Build a `quantitySampleId → correlationParentId` map from `getFoodCorrelationSamples` (HKCorrelationTypeIdentifierFood rows already fetched alongside the dietary quantity samples).
  2. If a sample is in that map, bucket it by `corr|<parentId>|<bundle>` — separate foods land in separate buckets even when their wall-clock instants collide.
  3. Else, read `metadata.HKCorrelationUUID` directly off the sample (some bridges don't expose `getFoodCorrelationSamples` but do thread the parent UUID into per-sample metadata).
  4. Else, fall back to the legacy `effectiveMinute|bundleId` heuristic for writers that emit no correlation info at all (no behaviour regression for old imports).
- The HKCorrelationUUID metadata key is bridged under several names (`HKCorrelationUUID`, `HKMetadataKeyCorrelationUUID`, `HKFoodCorrelationUUID`, `correlationUUID`, `CorrelationUUID`) — all are accepted. Native type definitions for `getEnergyConsumedSamples` / `getProteinSamples` / `getCarbohydratesSamples` / `getFatTotalSamples` were widened to thread `metadata` and `id` through.
- **Diagnostic logging:** one `console.log("[healthSync] bulk-sync detected: N energy samples, bundles=[…]")` per sync cycle when ≥2 distinct correlation UUIDs share a single `effectiveMinute|bundle` — quiet in steady state, visible in TestFlight logs when MFP flushes.
- **De-dupe:** `health_sample_id` already uses each energy sample's HK UUID, which is per-sample — confirmed nothing is double-counted now that one bulk batch produces N rows instead of one.
- **Verify (manual):** import a multi-meal MFP day; the day's carb total in Today should match MFP's displayed daily carbs within ~5% (rounding) instead of being 2-4× inflated. TestFlight logs should show a single `[healthSync] bulk-sync detected` line per sync.
- **Tests:** `apps/mobile/tests/unit/healthSyncCorrelation.test.ts` (14 tests) — runs as a pure-helper test, no RN imports, so the known mobile vitest RN ESM loader issue doesn't apply. Covers: distinct correlation parents → separate entries; shared correlation → one summed entry; metadata-only path (no parent rows); legacy fallback (no correlation info); mixed batch (correlated + legacy in same minute don't contaminate); parent-row beats per-sample metadata; all five HKCorrelationUUID metadata key variants; bulk-sync detection true/false cases.
- **Follow-up:** none scoped — fix is mobile-only by design (HealthKit doesn't exist on web). If we later wire Health Connect on Android, the correlation strategy should mirror this (Health Connect has its own correlation primitive).

## 2026-04-18 — Alcohol limit / hydration maps not saving

- **ASC feedback id:** `AF0btCuj90Absuf-5cw2FMc` (screenshot + comment: can’t save alcohol limit).
- **Cause:** Production `public.profiles` was missing columns from migration `20260421110000_caffeine_alcohol_tracking.sql` (`target_alcohol_g_weekly`, `extra_alcohol_g_by_day`, plus caffeine columns shipped in the same migration). App updates failed without obvious schema errors in some paths.
- **Fix:** Applied idempotent DDL on the linked Supabase project via  
  `supabase db query --linked -f supabase/scripts/apply_caffeine_alcohol_columns.sql`  
  (same statements as the migration file), then `NOTIFY pgrst, 'reload schema'`.
- **Verify:** Settings alcohol weekly limit and Today alcohol quick-add persist after force-quit; no client error.
- **Follow-up:** Full **`supabase db push --linked`** through **`20260421180000`** completed 2026-04-18; see **[supabase-migration-drift-inventory.md](../planning/supabase-migration-drift-inventory.md)** for the playbook if drift reappears.

## 2026-04-18 — “Not intuitive” (open)

- **ASC feedback id:** `AISAWnLgU9cjRBOuEY-HuJU` — triage separately (UX / copy / layout); no prod change yet.

## 2026-04-18 — Mobile household create / join silently failed

- **ASC feedback id:** `AAegi1DJEiscjIFi_pYaep4` — “Nothing happens when I try to create a household” on iOS.
- **Cause:** `apps/mobile/components/HouseholdCard.tsx` was calling `fetch("/api/household", …)` with a relative URL. React Native has no origin, so the request either threw or resolved to garbage; the surrounding `try/catch` block carried a `// Household API may not be deployed yet — silently ignore` comment which masked the failure entirely. The same pattern was present in `createHousehold`, `joinHousehold`, and `leaveHousehold`.
- **Fix:** Mobile and web household flows now go direct to Supabase via the new shared client `src/lib/household/householdClient.ts`. The four functions (`createHousehold`, `getMyHousehold`, `joinHouseholdByInviteCode`, `leaveHousehold`) operate under existing RLS for create/get/leave; `joinHouseholdByInviteCode` calls a new `security definer` RPC `public.household_join_by_invite_code(p_invite_code, p_display_name)` introduced in migration `supabase/migrations/20260422100000_household_join_rpc.sql` because RLS cannot let a non-member look up a household by code to validate it. While porting the web component, also fixed a long-broken `Authorization` header that was stringifying an unresolved `Promise` (`HouseholdPanel.tsx` line 57 in the old version).
- **Verify:** TestFlight: open Today → Household card, tap Create. Card immediately shows the new household with invite code. Join with the displayed code from a second account; member count goes up. Owner-leave deletes the household; member-leave just removes the row. Errors (already-in-household, invalid code, 8-member cap) now surface via `Alert.alert` on mobile and inline error text on web.
- **Tests:** `tests/unit/householdClient.test.ts` (16 tests, mocked Supabase covers all four functions and every RPC error code); `apps/mobile/tests/unit/householdCardParity.test.ts` (structural pin: no `/api/household` fetches, both surfaces import the shared client).
- **Follow-up:** Web Next.js routes under `app/api/household/` are kept (no removal needed; not invoked by the UI any more — useful for any future server-rendered caller).
- **Release-gate:** ~~migration `20260422100000_household_join_rpc.sql` still needs `supabase db push --linked`~~ **Applied 2026-04-18.** Verified via `select proname, prosecdef from pg_proc where proname = 'household_join_by_invite_code';` — `prosecdef = true`.

## 2026-04-18 — Notes / templates "could not load" (schema reconcile)

- **ASC feedback ids:** `AHgJ5AK6VQowC5KkrKfdaxc` (could not load notes), `AOHTbpXsKXz9e63LN0j58FQ` (notes error half of the screenshot), `APU2FBCjLALmugeCLmQ4Ii0` (could not load templates), `ADpfDkX8c-Kez9HpJFpqmrQ` (can't save ratings — same `user_recipe_notes` family).
- **Cause:** Submissions pre-dated the 2026-04-18 `supabase db push --linked` through `20260421180000` that reconciled `user_recipe_notes` (`20260421140000`) and `user_plan_templates` (`20260421160000`). Same family as the alcohol-limit fix at the top of this file.
- **Verify:** `supabase db query --linked "select table_name from information_schema.tables where table_schema='public' and table_name in ('user_recipe_notes','user_plan_templates');"` returns both. Column shape matches `recipeNotesClient.ts` + `planTemplatesClient.ts`. RLS policies in place.

## 2026-04-18 — Gain-weight label when genuinely in deficit

- **ASC feedback id:** `ALkK-XrcMz_V-D6NrjuVYbo`.
- **Cause:** `projectWeight()` in `src/lib/weightProjection.ts` computed maintenance TDEE as `targetCalories + 500` for "lose" goals. For users whose real burn exceeds `target + 500` (high adaptive TDEE, lots of activity) this flagged genuine deficits as surpluses.
- **Fix:** `projectWeight()` now takes an optional `maintenanceTdeeKcal` — preferred when present, heuristic fallback otherwise. Both `src/app/components/ProgressDashboard.tsx:913` and `apps/mobile/app/(tabs)/progress.tsx:794` now pass the user's actual effective TDEE (adaptive when confident, else static Mifflin). Web Complete Day dialog (`src/app/components/suppr/today-complete-day-dialog.tsx`) threads `profileMaintenanceTdee`. Mobile Complete Day prop added but not yet wired locally (mobile Today tab doesn't hold TDEE in state; deferred — only the Progress projection was the user-visible bug).
- **Tests:** `tests/unit/weightProjection.test.ts` (5 tests).

## 2026-04-18 — Progress shows 0 steps while Today has the right count

- **ASC feedback id:** `AD6_JNUaEjoJ5phZ_N1kv6o`.
- **Cause:** `apps/mobile/app/(tabs)/progress.tsx` fired `syncHealthDataThrottled(userId)` and the `profiles` SELECT inside one `Promise.all` — a race. The SELECT usually won, returning `steps_by_day` without today's key.
- **Fix:** sync is now awaited before the profile read; `nutrition_entries` still runs in parallel with the sync (independent).

## 2026-04-18 — TDEE "1900 when it should be 1600" (silent moderate default)

- **ASC feedback id:** `AIIm60nKi_sTu3-4YjR-WR4`.
- **Cause:** Five read-sites fell back to `activity_level ?? "moderate"` (multiplier 1.55) whenever the profile column was null. For a sedentary user this over-inflates TDEE by ~14% (1682 kcal → 1927 kcal) — matches the tester's complaint exactly.
- **Fix:** swapped all five read-sites to default to `"sedentary"` (1.2):
  - `src/app/components/NutritionTracker.tsx:943`
  - `src/app/components/ProgressDashboard.tsx:196`
  - `apps/mobile/app/(tabs)/progress.tsx:181`
  - `apps/mobile/lib/calcTargets.ts:82,112`
  - `app/api/nutrition/adaptive-tdee/route.ts:127`
- Also swapped onboarding defaults from `"moderate"` → `"sedentary"` on both platforms (`app/onboarding/page.tsx:73`, `apps/mobile/app/onboarding.tsx:137`) so users who skip the activity step don't silently pick 1.55.
- **Verify:** Mifflin-St Jeor output is numerically correct (nutrition-engine audit confirmed 0% drift vs textbook reference). The bug was exclusively the silent default.
- **Follow-up (deferred, narrow):** TDEE explainability — onboarding TDEE preview ("Sedentary: X · Light: Y · Moderate: Z" using entered height/weight/age/sex), Today activity-bonus info popover, dedicated Maintenance tile. Queued against `AFdtq8z_FmWRCispqF04Lsk` and `AAtW7dYcCBPyBdsMU6UqiQQ`. There is also a goal-adjustment parity drift between web (`tdee.ts:calculateBudget` uses pace-based deficits) and mobile (`calcTargets.ts:goalCalorieAdjustment` uses flat ±500/0/+300) — flagged for `data-integrity` follow-up, not part of this pass.

## 2026-04-18 — Instructions rendering literal "/n"

- **ASC feedback id:** `AO4NtyNBpP4FJRgq7mCV5cs`.
- **Cause:** Not in current prod recipe data (the prod `instructions ilike '%/n%'` query returned 0 rows) — the offending recipe must have been a historical seed or an import that escaped newlines as literal `/n` or `\n` 2-char sequences. The renderer `.split(/\n+/)` then treated `"Instructions placeholder /n"` as a single step.
- **Fix:** defensive normalisation in both `apps/mobile/app/recipe/[id].tsx:580` and `src/app/components/RecipeDetail.tsx:503` — `replace(/\\n/g, "\n").replace(/\s\/n\s?/g, "\n")` before splitting, so future imports with the same shape render correctly.

## 2026-04-18 — Imported recipe title == full caption

- **ASC feedback id:** `AOHTbpXsKXz9e63LN0j58FQ` (caption-as-title half of the screenshot — notes side covered above).
- **Cause:** `extractRecipeFromCaption()` in `src/lib/recipe-import/extractSocialRecipe.ts` passed GPT's `title` through unclamped. When a post had no obvious headline, GPT returned the whole caption.
- **Fix:** new `sanitiseImportedTitle()` collapses whitespace, strips trailing hashtag/handle/URL runs, prefers the first sentence, caps at 120 chars. If still over the cap, returns `null` so the caller falls back to `meta.title` / `"Imported recipe"`.

## 2026-04-18 — Missing recipe source section at bottom

- **ASC feedback id:** `AMAxKVVxPZtUvGz8I6Yqo3w` — "we need a source section at the bottom".
- **Cause:** On mobile, the source card existed but sat mid-page (before Log-to-journal, Start Cooking, Notes).
- **Fix:** moved the source card to be the final element in the recipe scroll, below `RecipeNotesCard`. Top-of-page byline link remains as the primary entry (tester said "happy to keep the name at the top as is").

## 2026-04-18 — Hydration card: caffeine hide + bottom-of-Today position

- **Source:** in-session tester request, paired with the TestFlight pass.
- **Fix:** caffeine row now self-hides when `targets.caffeineMg === 0` (mirrors alcohol). Whole `HydrationStimulantsCard` moved to bottom of Today on both platforms (after `TodayActivityBonusCard`, before Complete Day). Water quick-add at the top of Today stays via the macro tile row.
- **Tests:** two new cases in `apps/mobile/tests/unit/hydrationStimulantsCardParity.test.tsx` (caffeine hidden when target 0, visible when > 0).
- **Decision log:** `memory/decisions_hydration_card_position_caffeine_hide_2026_04_18.md`.
