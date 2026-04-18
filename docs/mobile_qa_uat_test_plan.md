# Suppr Mobile (iOS / React Native) — Release-Grade QA + UAT Test Plan

Scope: `apps/mobile/` (Expo Router app named "Suppr"). Intended to be executed end-to-end by QA before any store submission. Enumerates interactive elements screen-by-screen, lists states, negative/edge cases, and UAT checks. Where behaviour is inferred from code but not verified on-device, items are marked **ASSUMED COVERAGE**.

**Primary target:** iOS (iPhone SE 2nd gen, iPhone 15, iPhone 15 Pro Max). Dev build only — Expo Go lacks Apple Sign-In, share-intent, HealthKit, camera, RevenueCat, image picker.

**Secondary target:** Android dev build (barcode camera, share intent, deep link forwarding).

**Legend:** EXP = expected / NEG = sad path / EDGE = boundary / UAT = experience / A11Y = accessibility / PARITY = compare web/mobile / FLAG = pre-existing concern surfaced during plan authoring.

---

## 0. Test environment & preconditions

- iOS dev build via `expo run:ios --device` or TestFlight internal lane.
- Supabase reachable (`hasSupabaseConfig()` true). Also test the degraded `false` state.
- Test accounts: `qa-free`, `qa-base`, `qa-pro`, `qa-new` (fresh per run), `qa-apple` (Apple hide-my-email relay), `qa-household` (member of multi-user household).
- Permissions start denied: Camera, Mic, Notifications, Apple Health, Photos.
- Build flavours to run full suite against: dev build (sim), dev build (physical iPhone), TestFlight, Android dev build.
- Dynamic Type: default, Accessibility XL, Accessibility XXL.
- Appearance: Light, Dark, Automatic.
- Network: full Wi-Fi, throttled 3G (Network Link Conditioner), Airplane mode, captive portal.

---

## 1. App launch, cold start, routing

### 1.1 Cold launch — authenticated, onboarding complete
- EXP: splash → `(tabs)` stack landing on Today. No flash of login.
- EXP: status bar matches theme per `RootLayoutInner`.
- NEG: `getSession()` fails at boot → spinner persists then login; no crash.
- EDGE: session expired mid-sleep → silent refresh by AuthProvider, else login.
- UAT: cold-launch to Today < 3s on iPhone SE.

### 1.2 Cold launch — authenticated, onboarding NOT complete
- EXP: brief spinner in `(tabs)/_layout.tsx` then `Redirect href="/onboarding"`.
- NEG: `profiles` row missing → treated as incomplete; onboarding shown.
- EDGE: `onboarding_completed=null` → treated incomplete (verify).

### 1.3 Cold launch — unauthenticated
- EXP: `Redirect href="/login"`. No peek of tab content.
- EDGE: `hasSupabaseConfig()=false` → login renders error banner only ("Sign-in isn't configured for this build. Use the web app or contact support.").

### 1.4 Deep link / share entry points (`_layout.tsx`)
- EXP: iOS share sheet "Open in Suppr" with Instagram/TikTok URL → `/import-shared?url=...`.
- EXP: `suppr://import?url=...` → import-shared.
- EXP: `suppr://` with no URL but a clipboard URL present → routes to `/` then `ResumeClipboardToImport` forwards to import.
- NEG: share-intent in Expo Go → disabled, no crash.
- NEG: non-allowlisted URL on clipboard (random blog) → NOT auto-forwarded; allowlist must equal Instagram, TikTok, plus the approved sources from product memory: fitfoodiefinds, downshiftology, minimalistbaker, pinchofyum, halfbakedharvest.
- EDGE: dual delivery via `Linking.getInitialURL` and `shareIntent.webUrl` → only one navigation (dedupe by `importInFlightRef`).
- EDGE: Android "Open with" launching cold while not signed in → after sign-in, clipboard URL still forwarded on next foreground.
- UAT: share entry from Instagram is one-tap; user never sees Discover first.

### 1.5 Backgrounding / foregrounding
- EXP: foreground after >30s idle → session valid; last screen restored.
- EXP: foreground with new clipboard URL → Discover prompts via `useFocusEffect`.
- EDGE: OS kills app while in Cook mode (`useKeepAwake` releases) → relaunch returns to Today; no crash.
- EDGE: backgrounded mid-fast → timer continues from persisted `start`.

### 1.6 Session expiry / server logout
- NEG: 401 on next API call → app routes to `/login`, no blank state. **ASSUMED COVERAGE** — verify `authedFetch` 401 handling.
- EDGE: account deleted on another device → mobile must sign out cleanly on next auth check; no stale profile data.

### 1.7 Not-found route
- EXP: `suppr://bogus` opens `+not-found.tsx`. Header title "Not found". Back returns to previous.

### 1.8 Siri / Shortcuts deep links (Batch 5.12)

Preconditions: user authenticated; Today tab mounts. Open the iOS **Shortcuts** app and create an **Open URL** action for each of the three Suppr deep links in turn, then run them.

- EXP: `suppr://log/water?ml=250` (cold launch) → app launches to Today, hydration card shows +250 ml. VoiceOver announces "Logged 250 millilitres of water". Analytics: `siri_action_invoked { kind: "log_water" }` then `hydration_logged`.
- EXP: `suppr://log/water?ml=500` (warm, app backgrounded) → foreground resume, Today flushes the pending action, +500 ml added. No duplicate log if the action is run twice in <1 s (single-slot queue overwrites).
- EXP: `suppr://log/water` (no ml param) → defaults to 250 ml.
- NEG: `suppr://log/water?ml=abc` → parser returns null, no state change, no log. Analytics not fired.
- NEG: `suppr://log/water?ml=0` or `?ml=-1` → rejected, no log.
- EDGE: `suppr://log/water?ml=999999` → clamped to 5000 ml; one row added, not ten.
- EDGE: 6-minute-old queued action → discarded on flush (TTL); no surprise log.
- EXP: `suppr://fast/start?hours=16` with no active fast → new session persisted in `profiles.fasting_sessions`, Today's fasting pill appears, ring on Fasting screen advances. VoiceOver announces "Starting a 16 hour fast".
- EXP: `suppr://fast/start?hours=18` → 18h session starts, same flow.
- NEG: `suppr://fast/start` with an already-active fast → no-op; existing session unchanged. Analytics still fires (invocation recorded) but no new row appended.
- EDGE: `suppr://fast/start?hours=500` → clamped to 48h. `suppr://fast/start?hours=0` → rejected.
- EXP: `suppr://today/remaining` → app opens to Today. VoiceOver announces "Opening today's remaining macros". No state mutation.
- NEG: `suppr://bogus/route` → parser returns null; existing social-share forwarder handles it (routes home). No Siri analytics event fires.
- A11Y: every invocation fires `AccessibilityInfo.announceForAccessibility` before navigation so VoiceOver speaks confirmation even if Today takes 1–2 s to load.
- PARITY: iOS-only feature. Web does not register the `suppr://` scheme. Document this in the user-facing `docs/user/shortcuts-and-widgets.md`.
- UAT: user sets up one shortcut in under 1 minute following the steps in the user guide.

### 1.9 iOS widget snapshot (Batch 5.12)

Preconditions: authenticated user on Today. `apps/mobile/lib/widgetSnapshot.ts` writes on every macro / fast change (debounced 500 ms).

- EXP: log a meal → within ~600 ms the snapshot key `pm:widget:snapshot` in AsyncStorage contains updated `kcalConsumed` and `updatedAt`; analytics `widget_snapshot_updated` fires.
- EXP: start a fast → snapshot next write has `fastActive: true`, `fastStartsAt`, `fastTargetHours`.
- EXP: end a fast → snapshot flips to `fastActive: false`; `fastStartsAt` / `fastTargetHours` removed.
- EXP: navigate to a prior day (view mode day, not today) → writer skips (`isToday === false`); yesterday's numbers never overwrite today's snapshot.
- EXP: after a debounce storm (5 edits in 300 ms) → exactly one write lands after the user stops typing.
- EDGE: `expo-file-system` unavailable at runtime → AsyncStorage write still succeeds; the file write is a best-effort no-op. `writeWidgetSnapshot` resolves `{ ok: true, writtenToFile: false }`.
- EDGE: AsyncStorage write fails (storage pressure) → effect swallows error, does not crash Today; analytics not fired.
- UAT (when native widget extension lands): add the widget to Home screen, confirm ring + remaining macros render within 15 s of a new log.
- PARITY: iOS-only. Documented as deferred for Android / web.

---

## 2. Authentication — `app/login.tsx`

Elements: email input, password input, submit, sign-up toggle, forgot-password link, magic-link link, Apple Sign-In, brand circle.

### 2.1 Email input (`testID="login-email"`)
- EXP: `keyboardType="email-address"`, `autoCapitalize="none"`, autofocus, placeholder "Email", return key "next" advances to password.
- EXP: paste from clipboard works; trimmed in submit (`email.trim()`).
- NEG: empty email + Submit → "Enter your email and password."
- EDGE: 200-char email scrolls horizontally, no overflow.
- EDGE: emoji in email accepted by input; backend rejects → friendly error.
- A11Y: `accessibilityLabel="Email input"`. VoiceOver reads "Email input, text field".
- UAT: placeholder contrast WCAG AA in both themes.

### 2.2 Password input (`testID="login-password"`)
- EXP: `secureTextEntry`. `autoComplete="off"` and `textContentType="none"` are intentional — verify this is desired (Keychain may still prompt). FLAG.
- EXP: return key "go" submits.
- NEG: empty password + submit → required error.
- EDGE: leading/trailing spaces NOT trimmed.
- EDGE: >72 char → backend bcrypt limit message via `formatAuthError`.
- A11Y: `accessibilityLabel="Password input"`.

### 2.3 Submit (`testID="login-submit"`)
- EXP sign-in: valid creds → AuthProvider updates → if onboarding complete `Redirect /(tabs)`, else `/onboarding`.
- EXP sign-up: label "Create Account"; same redirect logic post-success.
- EXP busy: label "Signing in..." / "Creating account..."; opacity 0.6; disabled.
- NEG bad creds: "No account found. Tap 'Create account' below to sign up." (verify exact wording).
- NEG network: "Can't reach the server. Check your connection and try again." (`formatAuthError`).
- EDGE rapid double-tap → `busy` blocks duplicate submit.
- EDGE sign-up with already-registered email → Supabase error surfaces unchanged; verify human-readable.
- EDGE race: tap Submit, toggle to sign-up before response → no crash.
- UAT: error text below form, red, no layout jiggle.

### 2.4 Sign-up toggle link
- EXP: flips `isSignUp`, clears `message`, button label updates.

### 2.5 Forgot password
- Visible when `isSignUp=false`.
- NEG: empty email → "Enter your email first, then tap Forgot password."
- EXP: with email → `resetPasswordForEmail` → "Password reset email sent. Check your inbox."
- EDGE: rate-limit 429 → friendly error.

### 2.6 Magic link
- Visible when `isSignUp=false`.
- NEG: empty email → "Enter your email to receive a magic link."
- EXP: `signInWithOtp` → "Magic link sent! Check your email inbox."
- EDGE: tapping link in Mail → deep link into Suppr → session populated. **ASSUMED COVERAGE** — confirm redirect URL registered for iOS scheme.

### 2.7 Apple Sign-In
- Visible only on iOS AND `AppleAuthentication.isAvailableAsync()=true`.
- EXP: tap → system sheet → success → `signInWithIdToken({provider:'apple'})` with rawNonce/SHA256(hashedNonce) match.
- NEG cancel: `ERR_REQUEST_CANCELED` swallowed silently — verify no error banner.
- NEG no identityToken: "Apple Sign-In failed — no identity token received."
- EDGE hide-my-email relay: onboarding works; display name falls back via `displayNameFromAuthUser`.
- EDGE re-sign-in: Apple returns name only first time; subsequent must not overwrite stored display name.

### 2.8 Supabase not configured banner
- EXP: form and Apple button hidden; only brand + error.

### 2.9 Post-auth redirect
- EXP: fires once after `onboardingChecked=true`.
- EDGE: missing profile → `needsOnboarding=true`.

### 2.10 Sign-out (originates in `more.tsx`)
- EXP: session cleared → redirect to `/login`.
- FLAG: only `supabase.auth.signOut()` called; AsyncStorage health prefs (`health_import_nutrition`, etc.) persist. Confirm intent.

---

## 3. Onboarding — `app/onboarding.tsx`

11 steps: goal → basic_info → activity → plan_pace → budget_confirm → strategy → dietary → calorie_schedule → fasting → projection → summary.

### 3.1 Top bar
- Back from step 2 onwards (hit slop 12pt).
- Skip: upserts default budget/macros + `onboarding_completed=true` → `/paywall`. Verify no `onboarding_step_completed` event fires for skipped steps.

### 3.2 Progress bar
- Width = `(step+1)/11 * 100%`, colour `Accent.success`. Final step fills 100%.

### 3.3 Step 1 — Goal
- 3 options (Lose weight / Eat healthier / Build muscle), auto-advance, haptic light.
- NEG: back from step 2 → selection still active.
- PARITY: labels byte-identical with web.

### 3.4 Step 2 — Basic info
- Name (text, autoCapitalize=words, optional, placeholder "Optional").
- Sex: Female / Male / "Prefer not to say" (2-line label — verify no clip at XXL).
- Age: number-pad, placeholder "25". EDGE: 0, 1, 13, 120, 200, "abc". Continue requires `parseInt > 0`.
- Height unit toggle (cm ↔ ft). FLAG: cm and ft/in tracked independently — switching does not convert; UAT note divergence.
- Height cm: decimal-pad. EDGE: 50cm (below threshold → Continue disabled), 250cm (out of range, allowed).
- Height ft/in: two decimal-pad inputs. EDGE: 5'15" allowed but invalid.
- Weight kg: decimal-pad. EDGE: 10kg (below `>10` threshold → Continue disabled), 500kg.
- Weight lb / st-lb variants behave identically.
- Goal weight (only `goalType='lose'`): EDGE goal == current → weeks=0 → projection has no date.
- Continue: enabled iff `hasAge && hasHeight && hasWeight && hasGoalWeight`. Disabled style `opacity 0.4`.
- EDGE: comma-decimal autofill ("1,80") — `parseFloat` returns 1; verify accept-or-reject behaviour.
- UAT: "Prefer not to say" must not degrade BMR.

### 3.5 Step 3 — Activity
- 5 options from `ACTIVITY_LABELS`; auto-advance.

### 3.6 Step 4 — Plan pace
- Horizontal pager (`pagingEnabled`) with 4 cards: relaxed (RECOMMENDED green), steady, accelerated, vigorous.
- Unsafe pace → "NOT RECOMMENDED" red badge + "Very low calorie — consult a doctor before starting".
- Select button commits `planPace` and auto-advances.
- EDGE: `goalType !== 'lose'` may collapse to one card — verify.
- A11Y: each card individually focusable.
- UAT: card height must not clip budget number on iPhone SE.

### 3.7 Step 5 — Budget confirmation
- 48pt budget number; pace sentence. Continue CTA only.
- EXP: matches `calculateBudget(tdee, planPace, goalType)` ±5 kcal.

### 3.8 Step 6 — Strategy
- 4 options: balanced / high_protein / high_satisfaction / low_carb. Each shows preview "P: …g  C: …g  F: …g  Fi: …g". Auto-advance.

### 3.9 Step 7 — Dietary
- Multi-select chips from `DIETARY_PREFERENCE_ENTRIES`. Continue always enabled.
- EDGE: 10+ selected wrap correctly on iPhone SE.

### 3.10 Step 8 — Calorie schedule
- Same every day vs Flexible weekender. Auto-advance.

### 3.11 Step 9 — Fasting
- Yes (sets `fastingEnabled=true`, `fastingWindow='16:8'`) / No.

### 3.12 Step 10 — Projection
- If lose: projected goal date "en-GB" (e.g. "16 July 2026"). FLAG: hard-coded locale; verify PARITY with web.
- Else: checkmark + "Your targets are set".
- Summary rows for budget, strategy, fasting.

### 3.13 Step 11 — Summary
- Sparkle icon, heading "Suppr is ready", "Get Started" CTA.
- EXP: `saveAndFinish` upserts profile incl. `onboarding_completed=true`, `user_tier='free'`, `target_water_ml` clamped 1500–4500.
- EXP: success haptic; `router.replace('/paywall')`.
- NEG save fails: Alert "Save failed" with retry; button re-enabled.
- EDGE: rapid Get Started while saving disabled.

### 3.14 Hydration on resume
- EXP: re-entering pre-fills from `profiles` via `mergeProfileIntoOnboarding`.
- EDGE: `measurement_system='imperial'` → units flip to lb/ft.
- EDGE: `hydrateSeq` ref must guard against late responses overwriting user-typed values.

### 3.15 Analytics
- `onboarding_step_completed` once per step with `step` and `step_name`. PARITY with web.

### 3.16 Keyboard handling
- KeyboardAvoidingView on iOS pushes CTA above keyboard.
- EDGE: physical keyboard return key on age input still progresses or dismisses.

---

## 4. Paywall — `app/paywall.tsx`

Elements: close (X), dark header, 4-item timeline, "No charge today", price text, Start Free Trial, Continue for free, Restore purchase, "Secured by Apple".

### 4.1 Load
- `paywall_viewed` analytics fires once on mount.
- `ensurePurchasesUser(userId)` then `getOfferings()` populates packages; annual preferred.
- NEG no packages: "We couldn't load subscription offers. You can still use the app on the free plan, or try again later from Settings."
- NEG purchases key missing (dev build): "In-app purchases are not configured in this build. Continue on the free plan, or use a build with the store keys set."

### 4.2 Close button
- Tap → `onContinueFree` → `/notifications-prompt`.
- FLAG: 36×36 below Apple's 44pt minimum; add hitSlop or enlarge.

### 4.3 Timeline
- 4 items (targets set, today, this week, trial ends). Last has no connector line.

### 4.4 Start Free Trial
- Disabled during `purchasing`; spinner replaces label.
- Success: tier synced (`syncTierToSupabase`), routes to `/notifications-prompt`.
- NEG cancel StoreKit → no state change; button re-enables; no alert.
- NEG fail: Alert "Purchase failed" with retry.
- EDGE no offerings: routes straight to notifications-prompt without purchase attempt.
- EDGE already subscribed Apple ID → RevenueCat behaviour verified.

### 4.5 Continue for free
- Routes to `/notifications-prompt`; copy non-punishing.

### 4.6 Restore purchase
- Spinner during; success routes if entitled; "No active subscription found" if not; "Restore failed" on net error.

### 4.7 UAT
- Local currency string ("£39.99 / year") on UK/US/AU storefronts.
- Dark header contrast in both themes.

### 4.8 PARITY
- Web uses Stripe; mobile RevenueCat. Surface features match: 7-day trial, annual, cancel anytime. Timeline copy verbatim.

---

## 5. Notifications prompt — `app/notifications-prompt.tsx`

### 5.1 Turn on notifications
- iOS first ask shows system prompt.
- NEG denied/cancel: Alert "Notifications are off" with Skip / Open Settings.
- EDGE second-ask after denial: iOS does not re-prompt — `Linking.openSettings()` path verified.
- EDGE Expo Go: import fails → Alert "Not available here".
- After any decision: routes to `/(tabs)/discover`.

### 5.2 Skip → Discover.

### 5.3 UAT
- Bell badge dot matches iOS style. Copy warm.

---

## 6. Tab bar — `app/(tabs)/_layout.tsx`

Visible: Today, Discover, Plan, Progress, Profile (more). Hidden: library, search, barcode, notifications, settings.

### 6.1 Appearance
- Height `56 + max(insets.bottom, 8)`. Active = accent; inactive = `tabIconDefault`. `HapticTab` haptic on tap.
- FLAG: `tabBarLabelStyle.fontSize: 9` is below iOS minimum recommendation; verify at XXL.
- A11Y: each tab labelled (verify IconSymbol exposes label via HapticTab).

### 6.2 Hidden tabs
- Tabs with `href: null` not in tab strip; reachable via router.push.

### 6.3 Tab switching
- State preserved per tab (Planner generation across switch; Today scroll position; Planner mid-generation continues).

### 6.4 Auth guard
- Session expiry mid-tab → next 401 on a fetch should drop to `/login`, not show stale data.

### 6.5 PARITY
- Confirm web/mobile IA divergence (mobile hides Library in More/Discover).

---

## 7. Today / Tracker — `app/(tabs)/index.tsx`

Single-screen super-feature (3073 lines). Treat sub-modules below as separate test scopes.

### 7.1 Header
- Date label ("Today" / "Yesterday" / long date).
- Pull-to-refresh refetches journal.
- DayStrip: 7-day horizontal scroller; tap changes `selectedDate`.
- EDGE: date outside `journalRangeBounds` → `clampJournalDate` snaps.
- EDGE: `?date=YYYY-MM-DD&_t=…` jumps; `_t` cache-busts repeats.

### 7.2 Journal calendar modal (`JournalDatePickerModal`)
- Tap header → modal with month grid; page prev/next within bounds.
- NEG: out-of-range day → no-op or disabled visual.
- UAT: selected highlighted; today outlined.
- EDGE: rapid open/close does not duplicate animations.

### 7.3 Calorie ring
- Consumed vs `effectiveCalorieGoal`.
- Tap toggles `calorieDisplayMode` (remaining/consumed). Verify persistence.
- EDGE: 0 logged → empty arc, "0".
- EDGE: over goal → colour shifts (verify matches web).
- EDGE: `preferActivityAdjustedCalories` + HealthKit burn → goal = target + addon (surplus over maintenance). Verify formula.
- UAT: tap target = whole ring.

### 7.4 Macro tiles
- Tap → `/macro-detail?macro=protein&date=…`.
- Default `['protein','carbs','fat']`; can include fiber/sugar/sodium per `tracked_macros`.

### 7.5 Ring expand toggle
- `ringExpanded` shows/hides macros block.

### 7.6 Week summary toggle
- `weekSummaryMode` rolling vs calendar. PARITY with web.

### 7.7 Meal slots — Breakfast/Lunch/Dinner/Snacks
- Header tap toggles `collapsedSlots`.
- Rows: title, portion×, macro line, optional timestamp, source badge.
- Swipe (`Swipeable`) reveals delete; destructive must confirm via Alert.
- Tap row → edit modal.
- "+ Add to Breakfast" → Quick Add or Food Search modal.
- EDGE: empty slot → "No meals yet" + Add CTA.
- EDGE: meal with null calories displays "—" not "0".

### 7.8 Edit meal modal
- Inputs: title, portion chips (0.5/1/1.5/2× + custom), kcal/protein/carbs/fat, slot picker.
- EXP: portion change recomputes macros via `editCanonicalRef` baseline.
- EXP: save persists row; modal closes.
- NEG: invalid macros (negative) → validation or server clamp.
- EDGE: switch slot mid-edit → save writes to new slot.
- EDGE: blank macro field — define behaviour (0 or previous?).

### 7.9 Quick-add bottom sheet
- Title/kcal/protein/carbs/fat. Add.
- NEG: missing title → error.
- NEG: missing kcal → defaults to 0 or error? Verify.
- EDGE: 200+ char title — stored full; row truncates to 2 lines.

### 7.10 FoodSearchModal
- Debounced search; results show source badge (USDA/OFF).
- Tap result → portion picker (unit + qty 0.25–99) → Add → `onFoodSelected`.
- NEG: empty query → no search; clear button resets.
- NEG: 0 results → "No results".
- NEG: offline → error + retry.
- EDGE: `initialAmount/initialUnit` from verify context pre-populates.
- EDGE: barcode inside modal → embedded BarcodeScannerModal.
- Nutrition rule: low-confidence flagged via `NutritionSourceBadge`.

### 7.11 BarcodeScannerModal
- Camera permission flow; deny → "Enable Camera in Settings" → `Linking.openSettings()`.
- Scan → `lookupBarcode` → product + serving size picker → Add.
- NEG product not found → manual entry (name + macros + serving).
- NEG dup barcode → deduped via `scanned` ref.
- EDGE damaged barcode → user can switch to manual.
- EDGE correction mode → `submitFoodCorrection`; auth required.
- A11Y: camera surface has accessibilityLabel.

### 7.12 FAB / quick-entry sheet
- Options: Scan, Search, Voice log, Photo log, Add manually, Add previous meal.
- NEG voice log without native build → alert `VOICE_LOG_NATIVE_BUILD_HINT`.
- NEG photo log → permission + OpenAI path; `photoAnalyzing` spinner; fallback to manual on fail.
- EDGE network fail mid-photo-analysis → retry, no partial meal.

### 7.13 Voice log input (Batch 5.13 — Pro)
Component: `apps/mobile/components/VoiceLogSheet.tsx`. Route: `/api/nutrition/voice-log`. Shared helper: `src/lib/nutrition/aiLogging.ts`.

**Pro gate**
- EXP: Free + Base users — tap Voice chip in quick-log strip → navigate to `/paywall?from=voice_log`; analytics `voice_log_paywalled`. No sheet opens, no audio permission prompt, no API call.
- EXP: Pro user — tap Voice chip → `VoiceLogSheet` opens with `stage="input"`; analytics `voice_log_started`.

**Capture — native build**
- EXP: press-and-hold the mic → `isRecording = true`, "Listening… release to stop." helper text. Release → transcript lands in the text input. Low-end devices: 10 s max duration automatically stops.
- NEG: speech recognition unavailable (Expo Go, no dev build) → mic button press is a no-op; the hint under the input tells the user to type. Typing falls through to the Parse flow.
- A11Y: mic button `accessibilityLabel="Record voice log"` with `accessibilityState.selected` reflecting `isRecording`. Text input `accessibilityLabel="Describe what you ate"`.

**Parse**
- EXP: tap Parse (or press Return on the text input) → `stage="parsing"`, spinner + "Parsing your description…". On OK response, render review list; on 403 upgrade_required (shouldn't happen for Pro), error dialog with factual copy "Voice logging is a Pro feature."
- NEG: empty / whitespace-only transcript → Parse button disabled.
- NEG: OpenAI not configured / network fail → `stage="error"`, `role="alert"` red card with factual copy, "Try again" button returns to input.
- NEG: API returns 0 items → error copy "No food items could be parsed. Try describing portions too."

**Review**
- EXP: each parsed item renders with name (editable TextInput), kcal/P/C/F inputs (keyboardType=numeric), a confidence dot (green ≥0.75 / amber ≥0.5 / red <0.5), and an "AI estimate" badge.
- EXP: items with confidence <0.5 are wrapped in an amber-tinted card and show a `role="alert"` note "Low confidence — please verify portion and macros before logging." The primary action label becomes "Log anyway".
- EXP: per-item X button removes the item locally; the summary row updates totals.
- EXP: edit kcal/P/C/F — input strips non-numeric chars, clamps to ≥0, rounds to int; totals re-render.

**Commit**
- EXP: tap Log all (or Log anyway) → for each reviewed item, a new `JournalMeal` is added with `source: "AI voice"` and the current clock time label; sheet closes. Analytics `voice_log_committed { itemCount, avgConfidence }`; `food_logged { source: "voice", count }`.
- EXP: every logged row appears in the Meals list and in the Quick Add Recent tab with a subtle "AI" badge beside the title.

**CLAUDE.md parity**
- Low-confidence items never auto-log; the user must confirm.
- Nutrition values are not invented — the API routes every parsed item through `verifyIngredients` which prefers USDA / OFF / FatSecret matches before falling back to local estimation.

### 7.13b AI photo log (Batch 5.13 — Pro)
Component: `apps/mobile/components/PhotoLogSheet.tsx`. Route: `/api/nutrition/photo-log`.

**Pro gate**
- EXP: Free + Base users — tap Snap chip → navigate to `/paywall?from=photo_log`; analytics `ai_photo_log_paywalled`. No permission prompt, no upload.
- EXP: Pro user — tap Snap → sheet opens at `stage="pick"`; analytics `ai_photo_log_started`.

**Capture**
- EXP: two buttons — Camera (launches `expo-image-picker` with `requestCameraPermissionsAsync`) and Library (launches library picker). Both request permission explicitly; denied permissions route to `stage="error"` with a factual copy line.
- EXP: picked image renders in a 16:9 preview with `resizeMode="cover"`.
- EDGE: picker cancelled → stays on pick stage; no error, no spinner.

**Analyse**
- EXP: Analyse button is disabled until an asset is present. Tap → `stage="analysing"`, spinner + "Analysing your photo…".
- NEG: 403 upgrade_required → factual error copy; doesn't happen for Pro in practice.
- NEG: >6 MB image → 413 from server → error copy "file_too_large".
- NEG: 0 items parsed → "No food items were identified. Try a clearer, well-lit photo."

**Review & commit**
- EXP: same review UI as voice log (confidence + AI badges, inline macro edit, low-confidence amber + alert). Items carry `source: "AI photo"`.
- EXP: tap Log all → `food_logged { source: "photo", count }` and `ai_photo_log_committed { itemCount, avgConfidence }`.

**Deferred**
- Android mic permission prompt for Voice log on Android dev builds — handled by Expo's generic request flow; UAT on a physical Android device before GA.
- Server-side Whisper audio upload — the current release uses OS STT + typed fallback only.

### 7.14 Quick add panel — Favourites / Frequent / Recent / My meals
- Components: mobile `apps/mobile/components/QuickAddPanel.tsx`, web `src/app/components/suppr/quick-add-panel.tsx`. Both are render-only wrappers around the shared helpers in `src/lib/nutrition/foodHistory.ts`, `favoriteFoods.ts`, `savedMeals.ts`, `savedMealsLogic.ts`. AI-source detection shared via `isAiSourcedFoodHistoryItem(row)` (audit H1, 2026-04-18).
- EXP: FAB → Previous opens the Quick add panel. Header reads "Quick add" with "Logging to {slot}" subtext.
- EXP: tab row — Favourites / Frequent / Recent / My meals. Default tab is Recent (matches prior "Previous Meals" behaviour).
- **Recent tab**: up to 20 unique meals ordered most recent first. Tap any row → logs a duplicate with a new timestamp to the active slot and closes the panel.
- **Frequent tab**: up to 20 unique meals ordered by count desc. Tap logs the same way.
- **Favourites tab**: loads from Supabase on mount (per `userId`). Empty state: "Star meals you log often for one-tap re-logging."
- **AI badge**: rows whose `source` matches the shared `isAiSourcedFoodHistoryItem` rule (`"AI voice"` / `"AI photo"` / `"voice"` / `"ai_voice"` / `"ai_photo"`, case-insensitive) render `<Badge variant="ai">AI</Badge>` next to the title on both platforms. Updating the rule in `foodHistory.ts` flips both platforms at once.
- **Star toggle** on each row: `Ionicons star` when favourited, `star-outline` otherwise. A11Y label `"Favourite this meal"` / `"Unstar meal"` and `accessibilityState.selected` reflects star state.
- Star toggle is **optimistic**: fills immediately, writes to `user_favorite_foods`, reverts with an Alert on Supabase error.
- EDGE: tapping star on a row that already exists in the DB (unique-violation) → treated as success; no duplicate row; star stays filled.
- EDGE empty `byDay` AND no favourites → empty copy per active tab. No crash.
- EDGE signed-out user taps star → Alert "Sign in to save favourites."
- PARITY: web `QuickAddPanel` shows the same four tabs inline above the Meals section on Today. Same prop contract (`byDay`, `activeSlot`, `supabase`, `userId`, `onLog`, `onLogSavedMeal`, `onOpenSaveCombo`, `savedMealsRefreshToken`, `defaultTab`), same tab order, same empty-state copy, same accessibility labels. **Divergent behaviour is a regression, not a style choice** (see `docs/product/web-mobile-parity-scope.md`).

### 7.14b Eat again card
- EXP: on Today (only when `isToday` is true), if `computeEatAgainForSlot(byDay, currentSlotFromTime, now)` returns a row, a banner appears above the meal slots. Header "EAT AGAIN", body shows title + `N kcal · Pg Cg Fg · into {slot}`.
- EXP: `LOG` button logs the suggestion into the slot matching the current clock time (Breakfast < 10h, Lunch < 14h, Snacks < 17h, else Dinner).
- EXP: `×` dismiss writes today's date-key to AsyncStorage `suppr-eat-again-dismissed`; banner stays hidden until the next local day.
- NEG: no prior days with a matching slot → banner hidden.
- NEG: only today has that slot → banner hidden (today is explicitly excluded so "eat again" doesn't suggest the meal the user just logged).
- EDGE: viewing a past or future day (`isToday=false`) → banner hidden.
- PARITY: web shows the same banner at the top of the Day view, dismissed state persisted in `localStorage` under the same key.

### 7.14d Saved meal combos (Batch 2.6)
Components: web `suppr/SaveMealDialog`, `suppr/SavedMealsTab`, `suppr/QuickAddPanel`; mobile `SaveMealSheet.tsx` + `QuickAddPanel.tsx` (first-class component as of audit H1, 2026-04-18 — previously inline in `app/(tabs)/index.tsx`). Shared helpers: `src/lib/nutrition/savedMeals.ts`, `savedMealsLogic.ts`.

**Save gate & entry point**
- EXP: in a meal slot with **1 item** logged today, the slot header row shows **no** "Save combo" chip.
- EXP: logging a **2nd item** into the same slot reveals the "Save combo" chip on that slot header.
- EXP: tapping "Save combo" on a slot with 2+ items opens `SaveMealSheet`. The name field is pre-filled with `"My {slot} combo"` (e.g. "My breakfast combo"), the default-slot chip for the source slot is preselected, and the items list reflects the slot's items in logged order.
- EDGE: signed-out user taps "Save combo" → Alert "Sign in to save meal combos."
- EDGE: user taps "Save combo" but the slot drops below 2 items before the sheet opens (race) → Alert "Save meal combo — Log 2 or more items in this slot first, then save the combo."

**Save form**
- EXP: name input has `accessibilityLabel="Meal combo name"` and `maxLength={80}`. Clearing it disables Save.
- EXP: default-slot chips (No default / Breakfast / Lunch / Dinner / Snacks) act as a radio group with `accessibilityRole="radio"` and `accessibilityState.selected`.
- EXP: each item row has chevron-up / chevron-down / remove buttons with per-item `accessibilityLabel`s (e.g. "Move Oatmeal up", "Remove Oatmeal from combo"). Chevron-up on index 0 and chevron-down on last item are disabled + dimmed.
- EXP: Save button dims and shows "Saving…" during the write. On success the sheet closes, the host bumps `savedMealsRefreshToken` so the Quick add panel refetches + auto-switches to "My meals" tab, and the new combo is visible. Same behaviour on web.
- NEG: items cleared down to 0 → Save is disabled, copy reads "No items left. Cancel and pick more items to save." with `accessibilityLiveRegion="polite"`.
- EDGE: items insert fails on the server → parent is deleted so no zombie combo; Alert "Could not save — We couldn't save that combo. Try again."

**Name dedupe / unique naming**
- EXP: saving a combo with the same name twice is accepted at the DB layer (no unique constraint by design — users can have two "My snack" combos if they want). The Quick add list shows both rows; user can rename or delete to tidy up.

**Re-log**
- EXP: "My meals" tab lists combos, newest-re-logged first. Each row shows name + "N items · XXX kcal · P / C / F". Row's `accessibilityLabel` includes the bundle totals ("Log My usual breakfast to Breakfast. 3 items, 470 kcal, protein 35 grams, carbs 65 grams, fat 8 grams. Long-press for more actions.").
- EXP: tap the `add-circle` on a row → every item is inserted as its own row into today's journal under the combo's `default_meal_slot` (falls back to active slot). Each row gets a fresh `id`; quick add closes; `log_count` bumps; list reorders so the just-logged combo sits at the top.
- EDGE: double-tap `+` rapidly → guarded by the optimistic pending set — only one batch of entries is inserted.
- EDGE: `incrementLogCount` fails → user-facing log still succeeds (the counter is a sort key, not a billing counter). Warning goes to console only.

**Rename / Delete**
- EXP: tap the `ellipsis-vertical` icon or long-press a saved-meal row → Alert action sheet with Rename / Delete / Cancel.
- EXP (iOS): Rename opens `Alert.prompt` pre-filled with current name. Trimmed empty or unchanged input is a no-op. Success persists; failure reverts optimistic update with "Could not rename — Please try again."
- EXP (Android): Rename surfaces "Renaming is coming to Android in a future update" copy; user deletes + re-creates to rename. Tracked as a follow-up item.
- EXP: Delete shows a confirm Alert with "Delete / Cancel". Confirm persists; child items cascade via FK. Failure reverts.

**Analytics**
- EXP: successful save fires `saved_meal_created` with `{ itemCount, defaultMealSlot }`.
- EXP: tapping `+` on a saved-meal row fires `saved_meal_logged` with `{ itemCount, slot }` exactly once per tap.
- EXP: confirming Delete fires `saved_meal_deleted` once.

**Parity**
- Web: `NutritionTracker.tsx` renders a "Save combo" chip on each meal-slot header when the slot has 2+ items; the chip calls the host's `handleOpenSaveCombo(slot, seedItems)` which opens the host-owned `SaveMealDialog` (audit H4, 2026-04-18 — replaced the prior `suppr:open-save-meal-dialog` CustomEvent bridge with a direct prop callback). `QuickAddPanel` also receives `onOpenSaveCombo` as a prop for parity + future use. Identical states, identical analytics events, identical labels.
- Mobile: same shape — `app/(tabs)/index.tsx` renders the "Save combo" chip on each meal-slot header, opens the host-owned `SaveMealSheet`, bumps `savedMealsRefreshToken` after persist, and hands the token plus `onLogSavedMeal` / `onOpenSaveCombo` to `<QuickAddPanel />`. The panel itself is render-only (audit H1, 2026-04-18).
- Intentional differences: mobile uses `Alert.prompt` for rename on iOS and a future-work copy on Android; web uses `window.prompt`. Both are documented and tracked.

### 7.14e Custom foods (Batch 3.9)
Components: web `suppr/CreateCustomFoodDialog`; mobile `CreateCustomFoodSheet.tsx`. Shared helpers: `src/lib/nutrition/customFoods.ts` (pure) + `customFoodsClient.ts` (Supabase CRUD). Storage: `public.user_custom_foods`.

**Create**
- EXP: in FoodSearchModal, a "+ Create custom food" row is always visible at the bottom of the results list, and is promoted (larger tap target, descriptive copy) when the query returns zero results.
- EXP: tapping it opens `CreateCustomFoodSheet` with the typed query pre-filled as Name. Fields: Name (required, max 120 chars), Brand (optional, max 80), "Macros per N grams" basis (default 100), kcal / protein / carbs / fat / fibre (fibre optional), and an empty serving row ready for input.
- EXP: Save button stays disabled until Name is non-empty and base grams is > 0. Every macro input has `keyboardType="decimal-pad"`.
- EXP: saving with all macro fields at zero is allowed; a soft "Macros not set. You can fill these in later." notice appears above the Save button with `accessibilityLiveRegion="polite"`.
- NEG: empty / whitespace-only name → Save disabled. Toast copy if somehow attempted: "Name is required."
- EDGE: name that already exists for this user (e.g. "Granola" twice) → client retries with "Granola (2)", "Granola (3)" … up to " (9)" automatically. The user sees the saved row with its resolved suffix.

**Create with brand**
- EXP: filling Brand = "Local bakery" and saving persists the brand. The row appears in search with "Local bakery · Granola" as the display name.

**Zero macros**
- EXP: save a custom food with only Name set (all macros zero). Row persists; the "Macros not set" soft notice is shown during the create flow but does not block. Logging it goes through with 0 kcal (the user is responsible for filling in macros later via Edit).

**Add / remove serving rows**
- EXP: "Add" button next to the Serving sizes header appends an empty row. Each row has label (text) + grams (decimal-pad) inputs, plus an `X` icon with `accessibilityLabel="Remove {label}"`.
- EXP: removing a row removes it from state immediately; live preview updates.
- EDGE: tapping Remove on the only row leaves zero serving rows; copy reads "No saved servings. You can still log this food in grams."

**Serving dedupe**
- EXP: entering "1 Bowl" in one row and "1 BOWL" in another → only the first is persisted (case-insensitive first-occurrence wins).
- EXP: a serving with empty label or grams ≤ 0 is silently dropped at save time (not shown as an error — the UI simply omits invalid rows).

**Live preview**
- EXP: with macros filled and a first serving "1 bowl = 80g", the preview reads "1 bowl (80g): N kcal · P X · C Y · F Z" and updates in real time as the user edits either the macros, the base grams, or the serving grams.
- EXP: with no serving rows, the preview falls back to "{baseGrams}g: …".
- EDGE: baseGrams = 0 shows the destructive "Base grams must be greater than zero." copy; Save is disabled and preview reads "Add macros above to see preview."

**Edit**
- EXP: long-press (mobile) / overflow menu (web) on a custom-food row in search results exposes Edit. Edit opens the same sheet pre-filled; Save persists via `updateCustomFood` and scopes the update to `(id, user_id)`.
- EXP: editing the name to one that already exists does NOT retry with suffixes (suffix fallback is only for create). The server returns a unique-violation and the sheet surfaces "Name already used — please choose a different name."

**Delete**
- EXP: long-press → Delete shows a confirm Alert. Confirm removes the row via `deleteCustomFood` scoped to `(id, user_id)`.
- NEG: deleting a custom food does NOT retroactively remove prior `nutrition_entries` rows that were logged from it — those keep the snapshot macros they were logged with. This is intentional (historical accuracy).

**Search surfaces custom foods**
- EXP: typing a query that matches a custom food's name or brand surfaces the custom food at the top of the results list with a "Custom" badge (`searchCustomFoods` runs `ilike` across both columns).
- EDGE: query with commas or parentheses (e.g. "bread, rolls (fresh)") — the client sanitises these before building the PostgREST `or()` filter so the query does not error.

**Portion picker scales correctly**
- EXP: picking a custom food with saved servings ["1 bowl = 80g", "1 tbsp = 12g"] opens the portion picker with a segmented control including those labels plus "grams". Choosing "1 bowl" sets quantity=1, grams=80. Scaled macros use `scaleMacrosForGrams` (linear from baseGrams).
- EXP: quantity × "1 bowl" = 2 → grams=160, macros 2× the per-bowl values.
- EDGE: a saved serving with grams=0 is never offered (UI filters it out); `resolvePortionToGrams` would throw on unknown labels — never silently log 0 kcal.

**Analytics**
- EXP: successful create fires `custom_food_created` with `{ hasBrand, servingCount }` once. Edit fires `custom_food_updated`; delete fires `custom_food_deleted`.
- EXP: logging a custom food fires `custom_food_logged` with `{ servingLabel?, grams }` in addition to the normal `food_logged` event (custom-food usage can be sliced without double-counting total logs).

**Parity**
- Web: same dialog, same payloads, same events, same unique-name suffix retry; edit/delete via row overflow menu. Intentional difference: mobile uses long-press to surface edit/delete; web uses a hover-visible overflow menu.

**Create-then-log end-to-end from FoodSearch**
- STEPS (mobile): Today → FAB → Search. Type "granola bowl". No USDA / OFF results surface for this exact query. Tap "+ Create custom food" at the bottom → sheet opens pre-filled with Name = "granola bowl". Fill baseGrams = 80, calories 300, protein 8, carbs 45, fat 9, add a serving "1 bowl = 80". Tap "Save food".
- EXP: sheet dismisses, the search modal immediately enters the portion picker for the new food with "1 bowl" selected (first saved serving) and the macros panel showing 300 kcal / P 8 / C 45 / F 9.
- EXP: tapping "Use this" logs the food to the active meal slot, writes through to `nutrition_entries`, fires `custom_food_created { hasBrand: false, servingCount: 1 }` once and `custom_food_logged { servingLabel: "1 bowl", grams: 80 }`.
- EXP (web parity): same flow in `FoodSearch.tsx` + `CreateCustomFoodDialog` — the dialog closes, the portion picker opens on the new food, "Use this" logs it.

**Edit a custom food from FoodSearch**
- STEPS (mobile): after the above, re-open Search. Type "granola" — the custom row appears at the top with the "Custom" badge. Long-press the row → Edit.
- EXP: the sheet opens pre-filled with the existing food's macros + servings. Change calories to 320 and save. The portion-picker preview (if open) refreshes so macros cannot drift from the saved row; the next search shows the updated calorie pill.
- EXP: fires `custom_food_updated` once.
- EXP (web parity): the overflow menu "⋯" on the custom row exposes Edit → same dialog, same behaviour.

**Delete a custom food from FoodSearch**
- STEPS (mobile): in Search, long-press the custom row → Delete → Confirm "Delete".
- EXP: the row disappears from the results immediately; `custom_food_deleted` fires once. Prior `nutrition_entries` rows logged from it keep their historic macros (not retroactively removed).
- EDGE: if the delete request fails, an Alert "Couldn't delete — Please try again." appears and the row stays in the list.
- EXP (web parity): the overflow menu "⋯" → Delete → `window.confirm` (placeholder until M7 replacement) → row removed.

**Search surfaces Custom badge at top**
- EXP: when at least one custom food matches the query's name or brand, custom matches render ahead of any USDA/OFF result with the same score. Each custom row shows a small "Custom" pill (accessibility label "Custom food") beside the name. Custom rows are never de-duped against USDA/OFF rows (even if names collide) — the user explicitly saved the custom version.

**Portion chips scale macros correctly**
- EXP: a custom food with saved servings ["1 bowl = 80g", "1 tbsp = 12g"] offers those chips plus "g". Default is "1 bowl" (first saved serving). Tapping "1 tbsp" resets quantity to 1 and grams to 12; macros panel recalculates to 12/baseGrams × the saved macros.
- EDGE: tapping "g" sets quantity to the food's `baseGrams` (or 100 if baseGrams is missing) and grams to 1 × quantity. The nutrition panel reads exactly the macros-per-100g projection from `customFoodToMacrosPer100g`.
- EDGE: raising the quantity on "1 bowl" to 2.5 yields grams = 200 and macros scale 2.5× linearly; no invented values.

### 7.14c Copy meal / Duplicate day (batch 1.4)
- EXP: long-press any logged meal row opens the action sheet with Edit / **Copy to another day** / Delete.
- EXP: selecting **Copy to another day** opens `CopyMealSheet` with a month calendar; default target is the source day + 1. The source day is always disabled in the calendar.
- EXP: tapping any valid day selects it. Quick-range chips at the bottom extend the target to "Next 2 days" / "Next 3 days" / "Next 7 days" starting from the primary date.
- EXP: **Copy** confirms. On success the user sees an Alert "Copied — Copied to Thu 17 Apr" (single) or "Copied to N days" (multi). All destination rows land in `nutrition_entries` with fresh UUIDs; the source row is unchanged.
- EDGE: user picks only the source day (quick-range chips off) → confirm button is disabled. If they somehow confirm an empty list, Alert "Copy meal — Nothing to copy".
- EDGE: user picks a source-day + 7-day range that includes the source day → source day is automatically excluded from the resulting list; summary reflects this.
- EXP: on the day view, when there are logged meals, a **Duplicate day…** chip appears at the top right of the meal-slots card. Tapping opens `DuplicateDaySheet`.
- EXP: `DuplicateDaySheet` has a **Single day / Date range** toggle. Single day copies to one target; Date range uses a two-tap start-then-end selection and shades the inclusive window.
- EXP: confirming **Duplicate** clones every meal from the source day into each target day. All rows land in `nutrition_entries`. Alert: "Duplicated to {date}" / "Duplicated to N days".
- EDGE: source day has zero meals → the sheet header states this and the Duplicate button is disabled; subtitle says "This day has no meals to duplicate."
- EDGE: target list collapses to zero after excluding source → Alert "Duplicate day — Nothing to duplicate".
- A11Y: each calendar cell has `accessibilityLabel` ("Pick Thu 17 Apr") and `accessibilityState.selected` / `.disabled`. Mode toggle has `accessibilityRole="tab"`. Confirm / Cancel buttons have `accessibilityRole="button"` and factual labels.
- PARITY: web uses `CopyMealDialog` + `DuplicateDayDialog` reached via row overflow menu and day-header chip; fires the same `meal_copied` / `day_duplicated` analytics events with the same property names.

### 7.15 Water widget (legacy — now part of HydrationStimulantsCard)
- +/− buttons; persisted to `extra_water_by_day`; optimistic.
- EDGE offline updates locally; syncs on reconnect.
- EDGE: water goal change in profile updates ring.

### 7.15b Hydration & stimulants card (Batch 2.5)
Component: `apps/mobile/components/HydrationStimulantsCard.tsx`. Rendered on the Today tab in day view above "Steps & activity".

- **Water row** — progress bar to `target_water_ml`; four quick-add chips: `+100 ml`, `+250 ml`, `+500 ml`, `+750 ml` on metric. Each tap calls `addWaterMl()` which updates `extra_water_by_day[dayKey]` and persists immediately. Chip's `accessibilityLabel` reads e.g. "Add 250 millilitres water". Secondary line reads "Includes N ml from logged food" when meals contribute water.
- **Water row (imperial)** — Settings → Measurements → Imperial. Re-open Today. EXP: progress line renders in `fl oz` (e.g. `"8 fl oz / 100 fl oz"`), the "from logged food" sub-line renders in `fl oz`, and chips switch to `+4 fl oz`, `+8 fl oz`, `+16 fl oz`, `+20 fl oz`. Chip `accessibilityLabel` reads "Add 8 fl oz water". Underlying storage stays millilitres — flipping back to metric on Settings and returning to Today shows the same water logged, just re-rendered (`237 ml` after logging a `+8 fl oz` chip). Audit fix 2026-04-18 (C3). Parity: identical behaviour on the web card via the shared `formatWaterAmount` helper.
- **Caffeine row** — progress bar to `target_caffeine_mg` (default 400 mg — FDA). Four quick-add chips: Espresso (+64mg), Coffee (+95mg), Filter coffee (+120mg), Black tea (+48mg). Each tap calls `addCaffeineMg()` and persists to `extra_caffeine_by_day`. EXP: over-target renders the amber "Over 400 mg" label; progress bar fills `Accent.warning` (not red).
- **Alcohol row** — hidden when `target_alcohol_g_weekly === 0`. When opted in, shows the week-rolling sum in grams against the weekly target. Four quick-add chips: Beer 500ml (+16g), Wine 150ml (+14g), Spirit 44ml (+14g), Cider 330ml (+12g). EXP: progress bar fills with the alcohol tone and switches to amber "Over limit" on exceed. Week boundary respects `week_start_day`.
- **Reset today** — tap the `ellipsis-horizontal` icon beside each row's value → modal with "Reset today" / "Cancel". Reset clears `dayKey` for that kind only, persists, and fires `hydration_logged` / `stimulant_logged` with `amount: 0, preset: "reset"`.
- **Analytics** — every chip tap fires `hydration_logged` (water) or `stimulant_logged` (caffeine/alcohol) with `{ type, amount, unit, preset }` where `preset` is the chip label (e.g. `"Coffee"`) or `null` for manual. Verify in PostHog after each tap in staging.
- **Apple Health round-trip (iOS native build only)**:
  - Inbound: in Settings → Apple Health, enable "Import meals from Health". Log a dietary caffeine sample via the Health app, return to Today, tap Refresh. EXP: today's caffeine row increments by the imported value. Re-sync does not double-count (`max(existing, imported)`).
  - Outbound: tap the "Export this day to Health" action. EXP: HealthKit now has a `Suppr caffeine` food sample for the day matching `extra_caffeine_by_day[dayKey]`.
  - Alcohol export is **not wired** — there is no Apple HealthKit dietary type for alcohol grams. Tracked as a backlog item.
- **Settings targets persistence** — More → Goals & Targets → "Caffeine limit": enter e.g. `300`, tap Save. EXP: `profiles.target_caffeine_mg` updates; Today card now shows `XX / 300 mg`. Same for "Alcohol limit (g/week)"; setting `0` hides the alcohol row.
- EDGE — legacy-schema env: on a deployment without the Batch 2.5 migration, the Today load falls back to the legacy select; water still works; caffeine/alcohol rows read as zeroes; targets reset to defaults. No crash, no console error.
- A11Y — every chip has `accessibilityRole="button"` and a label naming both quantity and stimulant, e.g. "Add Coffee: 95 milligrams caffeine". Reset buttons in the modal have labelled `accessibilityLabel`s.
- PARITY — web `HydrationStimulantsCard` (`src/app/components/suppr/hydration-stimulants-card.tsx`) uses identical presets, labels, week-sum logic, over-target copy, and analytics events via the shared helper `src/lib/nutrition/hydrationStimulants.ts`.

### 7.16 Steps / activity widget
- Shows `stepsByDay[dayKey]`. Tap → `/burn-detail?date=…`.
- NEG no Health → "Connect Apple Health" CTA → `/health-sync`.
- EDGE iPad without HK → widget hidden/disabled.

### 7.17 Activity-adjusted calories toggle
- Master `prefer_activity_adjusted_calories` and bonus-only `activity_bonus_calories`.
- EXP: persists; ring updates immediately.
- EDGE: no Health data → toggle no-op; UI explains.

### 7.18 Fasting widget
- If active session → countdown updated each minute.
- Tap → `/fasting`.
- EDGE clock drift on resume — recompute from `start`.

### 7.19 Target celebration
- First-time target hit fires animation; ref prevents re-fire same day even if user dips and re-hits.

### 7.20 First-run checklist (`FirstRunChecklist`)
- Visible until dismissed or all 3 steps done. Dismissal stored in AsyncStorage `suppr-checklist-dismissed`.

### 7.21 Household card (`HouseholdCard`)
- Member list + today's shared meals.
- Create: input name → invite code shown.
- Join: input invite code.
- NEG invalid code → error.
- EDGE owner sees "copy code" reveal.
- PARITY with web.

### 7.22 Offline banner
- `subscribeOffline` flips `isOffline=true` → banner.
- EDGE reconnect → banner animates out; pending mutations flush.

### 7.23 Loading / empty / error
- Initial: `hydrated=false` skeleton/spinner.
- Empty day: all slots empty + "Add your first meal" CTA.
- Error (`loadError` set): retry.

### 7.24 Pull-to-refresh
- RefreshControl spinner; data reloads. Concurrent pulls deduped.

### 7.25 Analytics on Today
- meal_added/edited/deleted, water_added, photo_log_started, voice_log_started — verify in PostHog.

### 7.26 PARITY
- Identical totals for same user/day on web. Calorie ring math identical including activity adjustment.

### 7.27 RemainingMacrosBar
- EXP: bar renders below calorie ring with 4 columns (KCAL / PROTEIN / CARBS / FAT).
- EXP: when `target_fiber_g > 0` on the user profile, a 5th FIBER column appears.
- EXP: values decrease as meals are logged.
- EDGE: any macro that exceeds its target shows "+N over" in the destructive colour; "left" suffix replaced by "over".
- EXP: "left" suffix and neutral foreground colour when within budget.
- PARITY: same column count, same over/under logic as web `suppr/RemainingMacrosBar`.

### 7.28 Fit-this-in preview (FoodSearchModal)
- EXP: when FoodSearchModal is opened from Today (not from recipe verify), each portion picker shows an "after" sub-row per column using the projected remaining helper.
- EXP: sub-row values update immediately when the user changes portion amount or unit.
- EXP: sub-row uses destructive colour for any projected over-budget macro.
- NEG: opening FoodSearchModal from recipe verify (no macro context supplied) must NOT show the "after" row.
- EDGE: candidate portion that takes one macro over but not others — only over-budget column flips colour.

---

## 8. Discover — `app/(tabs)/discover.tsx`

### 8.1 Header
- Title "Discover", subtitle "Recipes that fit your macros".

### 8.2 Search input
- Placeholder "Search or paste a link..."
- Title substring filter (case-insensitive).
- Pasting URL must NOT auto-import (verify).
- EDGE: long query → "No results for …".

### 8.3 Filter pills
- For You / Popular / Quick / High Protein / Low Carb (single-select).
- FLAG **theatrical**: Popular currently uses `(r.saves ?? 0) >= 50 || true` → always true. Either implement or remove.
- Quick: cookTimeMin ≤ 20.
- High Protein: protein ≥ 25g.
- Low Carb: carbs ≤ 30g.
- EDGE: search + filter both applied.

### 8.4 Import CTA → `/import-shared`.

### 8.5 My Library CTA → `/(tabs)/library`.

### 8.6 Recipe grid
- 2-column FlatList; card has hero, source badge, decoded title (2 lines), creator/time, macro dots, kcal, fit badge, saves/made.
- Tap → `/recipe/{id}`.
- EDGE: HTML entities decoded via `decodeEntities`.
- EDGE: missing image → gradient placeholder.
- A11Y: each card Pressable with accessible name.

### 8.7 Fit badge
- Great=green, Good=accent, High=warn (verify `FitBadge`).

### 8.8 Pull-to-refresh refetches `useDiscoverRecipes`.

### 8.9 Clipboard import prompt (useFocusEffect)
- Approved-source URL on clipboard → Alert "Import recipe? We noticed a recipe link on your clipboard." (Cancel / Import).
- NEG: same URL seen → no prompt.
- NEG: disallowed URL → no prompt.
- EDGE dismiss → next focus does not re-prompt for same URL.

### 8.10 Empty / loading
- Loading: spinner + "Loading recipes...".
- Empty (no search): "No recipes yet. Pull down to refresh, or check your connection."
- Empty (search): "No results for '{q}'. Try a different search term."

### 8.11 PARITY: identical filters and card structure on web.

---

## 9. Planner — `app/(tabs)/planner.tsx`

### 9.1 Controls
- Days 1/3/7. Free tier locked to 1; tapping 3/7 → upgrade Alert or paywall.
- Start offset: today / tomorrow / next week.
- Slot toggles: breakfast/lunch/dinner/snacks.
- Generate via `generateSmartPlan`.
- Plan renders per day with meals, macros per meal, totals.
- EDGE: no saved recipes → placeholders or fallback advice (`stripPlanPlaceholders` filters them out).
- EDGE: free user toggles slots until one remains — allowed.

### 9.2 Meal swap
- Up to 10 alternatives sorted by calorie proximity (`Math.abs(a.calories - slotTarget)`).
- Pick → portion clamped 0.25–2x; recompute totals.
- NEG no alternatives → Alert "No alternatives. Save more recipes to swap."
- NEG swap that takes day >10% over target → confirm Alert.
- EDGE missing recipeId (legacy) → still swap by title.

### 9.3 Save plan
- `upsertMealPlanJson`; regenerates shopping items via `upsertShoppingListJsonItems`; `shoppingItemCount` updates.

### 9.4 Shopping button
- Count badge; tap → `/shopping`.

### 9.5 Household context
- Plan respects shared meal assignments. **ASSUMED COVERAGE.**

### 9.6 Empty / loading / error
- Pre-generate: empty state with CTA.
- During: `generating=true` blocks re-tap.
- Error: Alert with retry.

### 9.7 Recipe drill-down
- Tap meal → `/recipe/{id}?portion={mult}`.

### 9.8 UAT
- Day totals = sum meals to the kcal.
- Macro distribution respects calorie schedule preference.

### 9.9 PARITY: web has drag-drop swap; mobile uses Alert. Document divergence; identical inputs must produce identical plans.

### 9.10 Move meal between days (Batch 3.10, mobile parity shipped 2026-04-18 audit C2)
- **Entry point**: long-press (~400 ms) any meal row in the planner. A medium-impact haptic fires, then `Alert.alert` opens with four options: "Move to another slot…", "Swap with another meal…", "Delete", "Cancel". Empty / placeholder slots omit Swap and Delete.
- EXP Move: tap "Move to another slot…" → `MoveMealSheet` opens with every (day × slot) cell in the current week. Source cell is visually marked `FROM` and disabled.
- EXP: tap "Thursday Lunch" → source day loses the meal, destination day gains it; totals on both days recompute.
- Accessibility: every destination row has `accessibilityRole="button"` and `accessibilityLabel="Move to {DayName} {Slot}"`. Backdrop has `accessibilityLabel="Close move meal"`. Source row carries `accessibilityState.disabled = true`.
- EDGE: move onto the same slot → no-op (shared `moveMealInPlan` returns input unchanged).
- EDGE: move onto an empty slot → source becomes empty placeholder; destination gets the meal.
- EDGE: move onto another non-empty slot → two-way swap; destination's slot label stays put (Breakfast stays Breakfast).
- EDGE parent-of-leftovers: if the source meal has downstream leftover copies, tapping "Move to another slot…" shows a factual confirm Alert "This will remove N leftover meals." with Cancel / Continue. Continue clears downstream leftovers via the shared `markLeftoversOnSwap` before opening the destination picker.
- EXP Delete: long-press → "Delete" → source slot becomes an empty placeholder; totals recompute; plan persists.
- Persistence: after a move or delete, the new plan is persisted via the same relational-tables-with-legacy-JSONB-fallback path the generate flow uses.
- Analytics: `meal_moved_in_plan` fires with `{ fromSlot, toSlot, crossDay }`.
- PARITY: semantics match web drag-drop + keyboard "Move" fallback. No native drag-drop on mobile by design — action sheet is the canonical entry point and `moveMealInPlan` is the single shared helper on both platforms.

### 9.11 Save plan as template (Batch 3.10)
- Templates button → PlanTemplatesSheet opens in "Save as template" mode when plan has ≥1 eligible meal; opens in "My templates" mode when plan is empty.
- EXP Save: name + day count → inserts row in `user_plan_templates`; fires `plan_template_created`.
- NEG Save empty week: inline error "This plan has no meals to save." — sheet stays open; no row inserted; no analytics event.
- NEG Duplicate name: "A template with that name already exists." (case-insensitive unique).
- EDGE Name > 80 chars: input is capped at 80.
- My templates list: Apply asks confirm Alert → overwrites current plan; fires `plan_template_applied`. Delete asks confirm Alert → row gone.
- PARITY: identical surface to web `PlanTemplatesDialog`; same validation and error strings.

### 9.12 Leftovers-aware plan (Batch 3.10)
- EXP: saved recipe has `servings=3`; plan has it on day 1 dinner; on generate, a `🍱 Leftover of [recipe]` badge appears on two matching subsequent slots (lunch or dinner). Macros on leftover rows equal the parent's scaled macros.
- EDGE: `servings=1` → no leftovers.
- EDGE: breakfast parent with `servings=3` fills only breakfast/snack slots on following days, never dinner.
- EDGE: subsequent slot already has a different meal → skipped; never overwrites.
- Swap parent: confirm Alert "This will remove N leftover meals." → confirm clears the downstream leftovers and recomputes totals.
- Analytics: `plan_leftovers_generated { parentCount, leftoverCount }` fires once per generation when any leftover is placed.

---

## 10. Progress — `app/(tabs)/progress.tsx`

### 10.1 Range selector (TimeRangeSelector 7d/30d/90d/1y) drives all charts.

### 10.2 Weight trend
- TrendLine of `weight_kg_by_day` + goal weight overlay.
- EXP tap point → tooltip. **ASSUMED COVERAGE.**
- EDGE no weight data → "Add your first weight" → `/weight-tracker`.
- EDGE 90 days → no lag.

### 10.3 Adaptive TDEE card
- Static vs adaptive + confidence label.
- Tap → explainer.
- EDGE low confidence (<14d) → "Building your baseline".

### 10.4 Metric tiles (Calories, Protein, Streak)
- Tap → `/progress-metric?metric=…`.
- EDGE streak 0 → "Start logging to build your streak".

### 10.5 Week report (`buildWeekStats`)
- Wins / over-under / best day.
- EDGE partial week → warns.

### 10.6 Steps chart (MiniBarChart)
- Daily bars + goal line. NEG no Health → CTA.

### 10.7 Pull-to-refresh reloads health sync + metrics.

### 10.8 Loading / error states.

### 10.9 PARITY: same metrics on web.

### 10.10 Streak freeze (Batch 4.11)
- EXP: Streak tile subtitle shows "logging streak · 2 freezes" when `availableFreezes(ledger, budgetMax)` > 0; drops the " · N freezes" suffix when 0.
- EXP: Today tab streak insight card also shows "❄️ 2 freezes available" sub-label under "You've logged meals N days in a row."
- EDGE: `streak_freeze_budget_max = 0` → no sub-label anywhere, no "Streak freezes" section on Progress.
- EDGE: freeze consumed on a prior zero-day → `computeProtectedStreak.protectedDateKeys` contains that key; the tile count still reads the protected value and the raw value is surfaced via the "Raw streak" disclosure row on web (mobile surfaces this via `/progress-metric?metric=streak` detail).
- A11Y: freeze sub-label wrapped in an accessible `View` with `accessibilityLabel="N streak freezes available"`.

#### 10.10.a Streak freeze earned moment (2026-04-18 audit H7)
- PRE: manually insert a fresh entry into `profiles.streak_freezes_earned_at` (for example `[{"earnedAt":"2026-04-18T14:30:00Z"}]`) greater than any previously stored value in `AsyncStorage` under key `suppr-last-seen-freeze-earned-at`, and ensure `availableFreezes(...) > 0`.
- EXP: next visit to Today, a compact row reading "You earned a freeze — N available" with a ❄ leading icon renders directly under the streak insight card's "freeze available" badge. Cyan 10% wash, 1px cyan 35% border; not a modal, not full-width shame copy.
- EXP: tap **Got it** → row hides immediately; `AsyncStorage.suppr-last-seen-freeze-earned-at` is written to the matching ISO; `streak_freeze_earned_seen { earnedAt }` analytics event fires exactly once.
- EXP: kill-and-relaunch the app → row does not reappear for the same `earnedAt`.
- EDGE: a second freeze earned later (newer `earnedAt` pushed onto the ledger) re-surfaces the row for the new entry; dismissing it advances the stored marker forward.
- EDGE: user who has **never** earned a freeze (`earnedAt` empty) → row never renders; the streak insight card looks identical to pre-H7 (additive only).
- EDGE: `AsyncStorage` unavailable (dev simulator with wiped store) → row still hides for the session after tap; no crash; analytics still fires.
- A11Y: row is an accessibility summary with label "You earned a freeze — N available". Got it button has `accessibilityLabel="Got it — dismiss earned freeze"`.
- PARITY: web renders the identical one-time row on `NutritionTracker.tsx` using `localStorage` key `suppr-last-seen-freeze-earned-at`. Same copy, same analytics event.

#### 10.10.b DayStrip "Freeze used" glyph (2026-04-18 audit H7)
- PRE: user has a protected streak where at least one in-streak date was absorbed by a freeze (e.g. log Mon, skip Tue, log Wed with `availableFreezes > 0` at the time; reopen Today on Wed).
- EXP: scrolling the DayStrip back to the protected week shows a small cyan ❄ glyph in the top-right of the Tuesday tile. The regular dot/checkmark/today chrome for neighbouring tiles is unchanged.
- EXP: VoiceOver focus on the protected tile announces "Freeze used on 2026-04-14" (substitute actual date key).
- EDGE: `streak_freeze_budget_max = 0` or empty `usedHistory` → no ❄ anywhere on the strip.
- EDGE: day view + week view both render the glyph (parent passes the same `protectedDateKeys` set to both DayStrip instances).
- PARITY: web `DayStrip` at `src/app/components/DayStrip.tsx` renders an equivalent Lucide snowflake overlay and an `aria-label="Freeze used on {dateKey}"` on the tile button.

### 10.11 Weekly Recap card (Batch 4.11)
- PRE: set device clock to Sun 18:30 local or Mon/Tue/Wed 10:00 local of a week where the user has ≥1 meal in the prior Mon..Sun window (Monday-start user).
- EXP: `WeeklyRecapCard` renders above the 2x2 stat grid with "WEEK RECAP", "Your week — Apr 6 – Apr 12", day count, Avg calories / Avg protein / Streak / Weight stats, optional Best day row, and Share / Got it buttons.
- EXP: Weight row reads "No weigh-ins this week" when <2 weigh-ins in the window; never "+0.0 kg".
- EDGE: zero logs in the previous week → card is suppressed entirely (no recap).
- EXP: tap Got it / close → `weekly_recap_dismissed { weekKey }` fires; card hides; `profiles.weekly_recap_last_seen_week_key` is written to match the current `weekKey`.
- EXP: tap Share → native share sheet opens with the formatted plain-text summary; `weekly_recap_shared { weekKey, platform }` fires.
- NEG: share sheet cancelled → no crash, no toast.
- EXP: re-open Progress after dismiss → card no longer renders until the next `weekKey` flips.
- EDGE: change `week_start_day` from Monday to Sunday mid-week → next Progress visit rebuilds the recap for the Sunday-start window and the push scheduler reschedules to Saturday 18:00 (ledger key changes).
- A11Y: card has an `accessibilityRole="header"` on the headline; dismiss and share buttons have explicit `accessibilityLabel`s.

### 10.12 Weekly Recap push (Batch 4.11)
- PRE: `weekly_recap_push_enabled = true` on the profile; OS notification permission granted.
- EXP: on next Progress visit, `scheduleWeeklyRecapPush` installs a `WEEKLY` trigger at 18:00 on Sunday (Monday-start) or Saturday (Sunday-start). The `weekly-recap-v1` identifier is reused, so no duplicates.
- EXP: `weekly_recap_push_sent { weekKey }` fires once when the schedule is installed.
- EXP: tap the notification → app opens to `/progress`.
- NEG: toggle `weekly_recap_push_enabled = false` → next launch cancels the scheduled notification; no push arrives the following week.
- NEG: OS notification permission denied → `scheduleWeeklyRecapPush` returns `null` gracefully; no analytics event fires.
- EDGE: Expo Go / simulator without native push → helper no-ops cleanly; no crash on `scheduleNotificationAsync`.
- EDGE: DST boundary — `WEEKLY` trigger continues to fire at the same local wall-clock time (18:00).

### 10.12a Weekly Recap Settings toggle (Batch 4.11 — H6 audit fix, 2026-04-18)
- PRE: `weekly_recap_push_enabled = true` on the profile (default), OS notification permission granted, Monday-start user.
- EXP: Open More → Connections → "Weekly recap" row. Sub line reads "Sunday 18:00 (respects your week start)". Tap opens a bottom-sheet modal with a Switch set to ON and the explainer "Get a one-tap reminder to open your weekly recap on Sunday at 18:00 local time.".
- EXP: Tapping the Switch OFF calls `cancelWeeklyRecapPush()` immediately — inspect via `expo-notifications` API that the `weekly-recap-v1` identifier is no longer scheduled. `profiles.weekly_recap_push_enabled` is `false`. `weekly_recap_push_enabled_toggled { enabled: false }` fires once. Row sub updates to "Off · re-enable to get the Sun/Sat 18:00 nudge".
- EXP: **No local notification arrives the next Sunday at 18:00.** Confirm with the Xcode scheduled-notifications inspector or a backdated test device.
- EXP: Tapping the Switch ON calls `scheduleWeeklyRecapPush({ enabled: true, weekStartDay })` — a fresh `WEEKLY` trigger is installed for Sunday 18:00 (or Saturday 18:00 for Sunday-start users). `weekly_recap_push_enabled_toggled { enabled: true }` fires once.
- NEG: Signed-out / `userId` null → toggle reverts to its previous value; Alert "Sign in required" surfaces; no DB write, no analytics.
- NEG: DB update errors (e.g. RLS rejection, offline) → toggle reverts; Alert "Could not save. Please try again." surfaces; no analytics.
- EDGE: Switch `week_start_day` from Monday to Sunday while the toggle is ON → next Progress visit (or next open of the modal) reconciles the schedule to Saturday 18:00 via the existing Progress-visit scheduler; no user action required.
- EDGE: Toggle off on device A, then open device B with a cached `true` — device B's Progress-visit effect re-reads the column, sees `false`, and cancels any lingering scheduled notification before it fires.
- A11Y: Switch carries `accessibilityRole="switch"` + `accessibilityLabel="Weekly recap push notifications"` + `accessibilityState={{ checked }}`. Modal dismiss Pressable has `accessibilityRole="button"` and `accessibilityLabel="Dismiss"`.

---

## 11. Profile / More tab — `app/(tabs)/more.tsx`

### 11.1 Avatar + name
- First initial of email; name from `user_metadata.display_name` || email prefix || "Your Profile".
- EDGE Apple hide-my-email → email prefix until display name set.

### 11.2 Stat pills (Recipes / Streak / Score)
- Score = `min(100, streak*40/7 + saved*30/10 + 30)`. Verify formula.
- Tap Score → Alert explainer.

### 11.3 Upgrade banner (free only) → `/paywall`.

### 11.4 Goals & Targets section
- Daily Targets → `/profile`.
- Dashboard Widgets → widget picker modal.
- Week Starts On → Sunday/Monday picker modal.

### 11.5 Connections
- Apple Health → `/health-sync`. Sub: "Connected" if `isHealthSyncAvailable()` else "Not connected". UAT FLAG: this only checks runtime, not user consent.
- Notifications → `/(tabs)/notifications`.

### 11.6 Recipes — Create Recipe → `/create-recipe`.

### 11.7 App
- Appearance → `/(tabs)/settings`.
- Export Data → JSON via native Share. EDGE >10MB Share may truncate; NEG fail → Alert.
- Help & Information → web `/help` else mailto.

### 11.8 Legal
- Privacy → web `/privacy`. Terms → web `/terms`.
- NEG missing web base → Alert "Unavailable".

### 11.9 Danger zone — Reset modal
- "Reset plan" → clears meal plans, resets defaults, sets `onboarding_completed=false` → `/onboarding`.
- "Erase all app data" → `nukeAllUserAppData` + AsyncStorage health prefs cleared → `/onboarding`.
- NEG fail → Alert.
- EDGE double-tap → `resetting` disabled.

### 11.10 Sign Out
- `supabase.auth.signOut()` → `/login`.
- EDGE offline → local cleared; server sync on reconnect.

### 11.11 Modals: widget picker, week start, reset (backdrop tap dismiss).

### 11.14 Week-start-day picker
- EXP: modal shows two options — Sunday / Monday. Active option highlighted.
- EXP: selecting an option writes `profiles.week_start_day` and dismisses modal.
- EXP: Today DayStrip and Progress weekly view update on next load to reflect the new start day.
- PARITY: same options and same Supabase field as web Settings.
- EDGE: switching while on the Progress screen — next pull-to-refresh redraws the week starting on the new day.
- NEG: network fail on save — modal stays open, error shown, selection reverts.

### 11.12 Safe areas
- Top `insets.top + 18`; bottom `insets.bottom + 40`.
- UAT iPhone Pro Max: Sign Out not under home indicator.

### 11.13 PARITY: web /settings divergence; same destructive actions and Supabase mutations.

---

## 12. Library (hidden tab) — `app/(tabs)/library.tsx`

### 12.1 Header + count badge + sort (Recent → Calories → Protein → Recent). A11Y label updates per sort.

### 12.2 Search
- Title substring.
- Empty (query) → "No results for '…'".
- Empty (no query) → "No saved recipes" + CTAs to Discover + Import.

### 12.3 Recipe row
- Image, title (2 lines), macro line, log icon, trash.
- Tap card → `/recipe/{id}`.
- Log icon → `/recipe/{id}` (verify intent — could be quick journal log).
- Trash → Alert "Remove from library?" (Cancel / Remove destructive).

### 12.4 Pull-to-refresh via `useSavedLibraryRecipes.refresh`.

### 12.5 Loading spinner before first cache.

### 12.6 `useFocusEffect` refreshes after detail edits.

---

## 13. Search (hidden tab) — `app/(tabs)/search.tsx`

USDA dev/debug screen.

- Default query "apple". Search button.
- NEG `apiBase` empty → "Food search isn't available in this build yet."
- NEG empty → "Enter a food name."
- NEG fetch non-ok → "Search failed."
- NEG net err → "Network error."
- EXP up to 15 results with FDC ID.
- UAT FLAG: not production-linked; verify hidden in shipping build.

---

## 14. Barcode (hidden tab) — `app/(tabs)/barcode.tsx`

### 14.1 Camera permission
- First use prompt; deny → Settings link; restricted (parental) → permanent disabled + manual CTA.

### 14.2 Recognition
- Scan → `lookupBarcode` (OFF) → product; grams pre-fills from servingSizeG or 100g.
- NEG not found → error + manual CTA.
- EDGE dup → debounced via `last===e.data`.

### 14.3 Serving size
- Comma/period accepted; min >0, max 10000g (`Math.min(10_000, …)`); macros scale live.

### 14.4 Manual mode
- Name/kcal/protein/carbs/fat. Save → logs to Snacks slot.
- NEG missing name → validation.
- NEG zero kcal — verify allowed?

### 14.5 Correction mode
- Edit scanned macros → `submitFoodCorrection`. NEG not authed → Alert.

### 14.6 Log
- Writes `nutrition_entries` with Snacks slot + time label.
- NEG no user → Alert "Sign in".
- EDGE same product twice → two rows allowed.

### 14.7 A11Y: camera view labelled.

---

## 15. Notifications (hidden tab) — `app/(tabs)/notifications.tsx`

### 15.1 List
- Recipe-publish + app notifications, sorted by date. Unread badge in header.

### 15.2 Item tap
- Navigate to recipe if `recipeId`; mark `read_at`.
- EDGE missing recipe → "Recipe unavailable" toast.

### 15.3 Mark all as read — **ASSUMED COVERAGE.**

### 15.4 Pull-to-refresh debounced via `refreshDebounceRef`.

### 15.5 Loading / empty / error.

### 15.6 Deep link from push → opens screen or recipe directly. **ASSUMED COVERAGE** — verify `configureNotificationPresentation`.

---

## 16. Settings (hidden tab) — `app/(tabs)/settings.tsx`

### 16.1 Theme segmented (Auto / Light / Dark) persisted via theme context.
- EDGE OS appearance change while backgrounded → auto resyncs on resume.

### 16.2 Notification preference switches
- New recipes / Meal reminders / Weekly report / Creator updates / Show meal timestamps. Writes `notification_prefs`.
- EDGE rapid toggle — debounce or last-write-wins; no race.

### 16.3 Week summary mode segmented (Rolling / Calendar) writes `notification_prefs.weekSummaryMode`.

### 16.4 Activity-adjusted calories toggle persists `prefer_activity_adjusted_calories`.

### 16.5 Promo code
- NEG empty → "Enter a promo code."
- NEG invalid/expired → "That code is not valid, has expired, or has reached its use limit."
- NEG not authed → "Sign in again, then try the code."
- EXP success → tier upgraded; Alert.
- EDGE: case-sensitivity / trimming verified via `normalizeRedeemPromoRpcData`.

### 16.6 Loading / error banner.

### 16.7 UAT: every toggle saves visibly.

---

## 17. Recipe detail — `app/recipe/[id].tsx`

Tabs: Ingredients / Steps / Nutrition. Plus save heart, share, cook mode, log to journal, yield edit, portion scaling.

### 17.1 Header
- Back (safeBack to Discover).
- Save heart toggles `saves` row optimistically.
- Share opens `Share` with `webRecipeDeepLink`.

### 17.2 Image
- `image_url` or DEFAULT_IMAGE; broken URL → placeholder.

### 17.3 Title, author, source
- Author avatar + display_name.
- Source chip → TikTok/Instagram handle if detectable.

### 17.4 Servings (yield edit modal)
- Numeric input → save → recompute per-serving macros, persist `recipes.servings`.
- NEG ≤0 → clamped to 1.
- NEG non-numeric → validation.

### 17.5 Log portion picker
- Chips 0.5/1/1.5/2× + custom; scales preview macros.

### 17.6 Log to journal
- Inserts `nutrition_entries` for today's slot inferred from `meal_type`.
- NEG no user → Alert.
- NEG net fail → retry.
- EDGE portion 0 → button disabled.

### 17.7 Ingredients tab
- Name, amount, unit, macros, source badge.
- Tap ingredient → FoodSearchModal to reassign.
- Low confidence (`< RECIPE_INGREDIENT_REVIEW_CONFIDENCE`) → warning + Verify CTA.
- Nutrition rule: never silently auto-use low-confidence.
- UAT XXL type readable; amounts right-aligned.

### 17.8 Steps tab
- Numbered (leading "1. " stripped).
- Start cook mode → `/cook?recipeId=…&title=…&steps=JSON`.
- EDGE no instructions → "No instructions available"; Cook button disabled.

### 17.9 Nutrition tab
- MacroRings vs daily targets.
- Sugar/sodium bars vs `REF_SUGAR_G=50`, `REF_SODIUM_MG=2300`.
- Re-verify nutrition POSTs to `/api/nutrition/verify-recipe` with ingredients.
- NEG no session → button disabled.
- NEG verify fail → Alert.
- EDGE rate limit → friendly retry.

### 17.10 Delete recipe (owner only)
- Confirm via Alert (destructive red). Hidden if not author.

### 17.11 PARITY: identical macros for shared recipe on web.

---

## 18. Cook mode — `app/cook.tsx`

### 18.1 Elements: Exit (red), step counter, progress bar, step number pill, step text, Start/Stop Timer, Previous/Next nav (Next on last step → "Done!"), Done state.

### 18.2 `useKeepAwake` prevents sleep; released on exit.

### 18.3 Navigation
- Previous disabled at step 0; Next on final step advances to done.

### 18.4 Timer
- Count-up MM:SS. Stop resets to 0.
- EDGE Next while timer running → `stopTimer` called.

### 18.5 No steps edge → "No instructions available" with Go back.

### 18.6 UAT: 17pt step text readable from arm's length; verify XXL.
- FLAG: Exit has no confirmation; consider for accidental taps.

---

## 19. Create recipe — `app/create-recipe.tsx`

### 19.1 Fields: Title (required), Description, Servings (numeric, default 1), Instructions (multiline), Ingredients (FoodSearchModal), Meal type picker, Publish switch, Image (library).

### 19.2 Image picker
- NEG Expo Go → Alert "Image picker unavailable. Image upload requires a development build. It is not supported in Expo Go."
- EXP picks → preview → uploads to `recipe-images` storage on save.

### 19.3 Add ingredient via FoodSearchModal; trash removes (no confirm).

### 19.4 Live totals + per-serving (servings 0 → fallback 1 via parseInt).

### 19.5 Save
- NEG not signed in → Alert.
- NEG missing title → Alert.
- NEG no ingredients → Alert.
- EXP inserts row; redirects to detail.
- EDGE image upload fails → recipe saved without image; placeholder shown.

### 19.6 Publish switch — published true makes recipe show in Discover.

---

## 20. Import shared — `app/import-shared.tsx`

States: idle → checking → importing → review → saving → success/error. Steps: ingredients, nutrition, macros.

### 20.1 Manual URL input
- NEG empty → inline error.
- NEG non-URL → error.
- NEG unsupported host → error + "View supported sites" link.

### 20.2 Auto-import via deep link / share intent / clipboard
- URL param triggers import; `importInFlightRef` dedupes.

### 20.3 Progress UI
- Three step indicators fill in order.
- UAT: labels clear ("Parsing ingredients", "Checking nutrition", "Calculating macros").

### 20.4 Review state
- Title, image, ingredients with source badges, macros, servings editor (modal), meal tags via `MealTypePicker`.

### 20.5 Save
- `saveImportedRecipe` writes recipe + ingredients + saves link.
- Success → toast + nav to recipe detail.
- NEG → error state with retry.

### 20.6 How this fits your day — preview vs targets; defaults notice if missing.

### 20.7 Error state copy for: unsupported host, paywall-blocked Instagram, parser empty, backend 500.

### 20.8 UAT: end-to-end Instagram share → import → saved < 20s.
- Nutrition rule: every low-confidence ingredient renders Estimated badge with unblocked "Fix" link.

---

## 21. Weight tracker — `app/weight-tracker.tsx`

### 21.1 Add weight: date picker (today default), weight input (decimal-pad).
- EDGE duplicate date → overwrites.
- NEG ≤0 → validation.

### 21.2 Chart: TrendLine across selected range + goal line; tap point → tooltip.

### 21.3 Apple Health lookback selector (presets `HEALTH_BODY_LOOKBACK_PRESETS`); changing resyncs.

### 21.4 Journey progress %; past-goal celebratory state.

### 21.5 Refresh adaptive TDEE button (debounced).

### 21.6 Time range selector 7d/30d/90d/1y.

### 21.7 Empty state: first-time → "Log your first weight".

---

## 22. Progress metric detail — `app/progress-metric.tsx`

Metric in {calories, protein, streak}.
- Per-day bar chart over selected range.
- Tap bar → jump to that day's Today.
- Streak view highlights contributing days.
- EDGE gap days → muted zero bar.

---

## 23. Macro detail — `app/macro-detail.tsx`

- Header with macro + colour + total.
- List of contributing meals + amounts.
- EDGE 0 → "No {macro} logged today."
- EDGE water → ml.

---

## 24. Meal nutrition — `app/meal-nutrition.tsx`

- Title, slot, macros, P/C/F% calorie pie.
- Micros via `listMicroNutrientsCompleteDisplay` if present.
- NEG invalid id → error + back.
- EDGE no micros → hide section.

---

## 25. Burn detail — `app/burn-detail.tsx`

- Active + resting burn, steps, maintenance kcal, workouts list.
- EDGE past day no Health → zeros + explanation.
- EDGE Apple Watch workout (e.g. Strength, 45 min, 312 kcal) → row renders correctly with source.

---

## 26. Fasting — `app/fasting.tsx`

### 26.1 Ring (16:8 default). Animated reanimated Circle. Pct = elapsed / fastMs (clamp 1).

### 26.2 Start/Stop write to `profiles.fasting_sessions`; capped at MAX_SESSIONS=90.
- EDGE active session survives app kill (read on mount).

### 26.3 Window editor
- Change to 18:6, 20:4, etc. Persists.
- NEG invalid "abc" → fallback 16:8.

### 26.4 Complete state at pct=1: success colour, "Fast complete" banner.

### 26.5 History: last N sessions with duration/date.

### 26.6 UAT: ring smooth; updates each second without jank.

---

## 27. Health sync — `app/health-sync.tsx`

### 27.1 Connect
- `requestHealthPermissions` opens Apple Health auth.
- NEG Expo Go → Alert about dev build.
- NEG simulator without HK → disabled state.
- NEG partial-deny → partial-connected, explain missing categories.

### 27.2 Toggles (import nutrition / generic labels / export nutrition) persist in AsyncStorage.
- EDGE import ON triggers initial sync; OFF does not delete already-synced rows.

### 27.3 Sync button
- Calls `syncHealthData` + `syncNutritionFromHealth`. Result string shows count.
- NEG fail → string error.

### 27.4 Permissions revoked mid-session → next sync graceful + reconnect prompt.

---

## 28. Shopping — `app/shopping.tsx`

### 28.1 List
- Items grouped by category. Check toggles `checked`.
- Relational table first; fallback to JSONB via `fetchShoppingListJsonItems`.
- EDGE: item from multiple recipes → `from` combined.

### 28.2 Actions
- Share via native Share. Open in Maps **ASSUMED COVERAGE.** Clear checked. Add custom item.

### 28.3 Empty state → CTA to Planner.

### 28.4 UAT: strike-through checked items; easy to uncheck.

---

## 29. Nutrition sources — `app/nutrition-sources.tsx`

### 29.1 Elements: back, INFO title, heading, intro, three source cards (USDA / OFF / FatSecret), disclaimer footer.

### 29.2 Tap link → `Linking.openURL`.
- FLAG: no `.catch` here (other screens do); add for robustness.

### 29.3 UAT: disclaimer visible without scroll on Pro Max; needs scroll on SE.

---

## 30. Profile (targets editor) — `app/profile.tsx`

### 30.1 Fields: display name, calories/protein/carbs/fat/fiber/water (decimal-pad), dietary preference chips multi-select.

### 30.2 Save: upsert.
- NEG calories 0 → fallback to default or error.
- NEG fail → Alert.

### 30.3 Recalculate from stats — re-runs `resolveTargets` from height/weight/activity; confirms overwrite.

### 30.4 UAT: macro fields show calorie equivalence (e.g. "Protein: 150g = 600 kcal"). Verify presence.

---

## 31. Recipe verify — `app/recipe/verify.tsx`

### 31.1 Per-ingredient expand
- Amount, unit, macros, source. Options: Search, Scan, Edit manually.

### 31.2 Standard units always available: g / oz / tbsp / tsp / cup / ml.

### 31.3 Save all writes verified ingredients back; recomputes recipe macros. NEG net fail → Alert.

### 31.4 UAT: low-confidence flagged amber until resolved.

---

## 32. Cross-cutting — Copy review

For every screen above:
- No typos. Consistent capitalisation: "Suppr" (brand), "Apple Health", "kcal", "g", "ml".
- Smart quotes for apostrophes. No "Lorem ipsum" or placeholder copy in shipping build.
- Numbers via `toLocaleString` for UK/US/DE locales.
- Date formatting: currently mixed `en-GB` (onboarding projection, plan cards) and device default elsewhere. FLAG: pick one policy or make user-preference driven.
- Brand tone: warm, supportive, non-clinical; never shaming.
- Error strings carry no stack traces or raw IDs.
- Truncation: row titles accept 80+ char recipes without breaking layout; consistent `numberOfLines`.
- Dynamic Type XL/XXL: no clipped labels, no overlapping controls. FLAG `tabBarLabelStyle.fontSize: 9`.
- Hard-coded strings: audit for localisation-readiness.

---

## 33. Cross-cutting — UI / UX

- Safe areas: top `insets.top`; bottom CTAs above home indicator; horizontal respects notch on landscape (verify orientation in `app.json`; appears portrait-locked).
- Tap targets ≥44×44 (Pressables smaller need `hitSlop`). Audit paywall close (36×36) — FLAG.
- Keyboard avoidance on every form: login, onboarding basic_info, create-recipe, import-shared manual URL, today quick-add, profile, weight-tracker.
- Keyboard types: email-address on login; number-pad whole numbers; decimal-pad for macros / weights / heights.
- Scroll momentum natural; refresh tints accent.
- Dark mode: audit hard-coded colours (e.g. paywall header `#1a1a2e`).
- Animation budget: cook progress 300ms, onboarding fade 120+200ms — none block input.
- Haptics on meaningful success only; do not fire on every scroll.
- Landscape: not supported (verify); audit if iPad supported.
- Small device (iPhone SE 375×667): verify nothing cut off (paywall CTA, onboarding basic_info).
- Large device (Pro Max): no stretched elements; charts use full width.
- iPad: ASSUMED COVERAGE — confirm support target.

---

## 34. Cross-cutting — Navigation

- Edge-swipe back works on stack screens; consider confirm on cook exit.
- Hardware back on Android returns to previous; tab roots verified.
- Deep links `suppr://recipe/{id}`, `suppr://import?url=...`, `suppr://` → handled per `_layout.tsx` forwarders.
- Modal-resume: BarcodeScannerModal open, backgrounded, resumed → modal still open; camera resumes.
- Interrupted flows: phone call mid-onboarding → step preserved.
- Session expiry mid multi-step (e.g. saving recipe) → user lands on login; FLAG: typed data lost.

---

## 35. Cross-cutting — Data

- Saved state across relaunches:
  - Today journal: server-side.
  - Theme preference: AsyncStorage.
  - First-run checklist dismissal: `suppr-checklist-dismissed`.
  - Health sync toggles: `health_import_nutrition`, `health_export_nutrition`, `health_import_generic_labels`.
  - Pending water/meal edits: offline queue durability via `subscribeOffline`. **ASSUMED COVERAGE** — confirm.
- Sync conflicts (two devices same meal): last-write-wins; no data loss.
- Stale data: pull-to-refresh on Today, Discover, Library, Progress, Notifications, Shopping.
- Duplicate submissions: every async button disabled during request.
- Retry after network: offline meal adds re-sync without duplication.
- Partial completion: import aborted mid-review → no orphan recipes.

---

## 36. Cross-cutting — System scenarios

- Airplane mode on launch: app opens, read-only state, banner.
- Throttled 3G: spinners must time out / retry.
- App kill + relaunch during import: clean.
- OS force-quit during cook mode: no crash on relaunch.
- Low Power Mode: animations reduced; timers tick.
- Permissions revoked mid-session (Camera / HealthKit / Notifications / Photos): graceful + Settings link.
- OS update / data migration: AsyncStorage retained; Supabase session refresh succeeds.
- Large data sets: 500+ library recipes, 365+ days nutrition entries, 90+ weight entries, 30+ household meals — lists responsive with `keyExtractor` + windowed rendering.

---

## 37. Cross-cutting — Accessibility

For every interactive element:
- `accessibilityLabel` set; never rely on emoji-only labels.
- Roles correct: Pressables `accessibilityRole="button"`.
- Focus order = reading order.
- Dynamic Type up to XXL: no clipping; rings/labels scale or truncate gracefully.
- WCAG AA contrast both themes.
- Disabled state announced.
- Custom controls (rings, charts) expose accessibility actions — most charts today lack a11y alternatives. FLAG.
- Haptics paired with visible state change.
- Screen reader announces nav changes ("Recipe, Chicken Piccata, opened").
- Audit: login, onboarding (each step), paywall, Today tiles, Discover card, Recipe detail tabs, Cook mode, Create Recipe, Import Shared, Settings toggles.

---

## 38. Cross-cutting — Web/mobile parity

For every shared feature, verify behaviour matches `apps/web/`:
- Onboarding steps, copy, math.
- TDEE / macro calc (shared `src/lib/…`).
- Recipe import pipeline (same backend).
- Meal plan algorithm (same `mealPlanAlgo`).
- Nutrition source ranking + confidence thresholds.
- Calorie ring math incl. activity adjustment.
- Dietary preferences list (`src/constants/dietaryPreferences`).
- Analytics events (same names + properties).

Documented divergences (not bugs): Apple Health (mobile only), Apple Sign-In (mobile only), RevenueCat (mobile) vs Stripe (web), share intent / clipboard forwarding (mobile only), drag-drop plan swap (web) vs Alert picker (mobile).

Parity risks to verify: Discover "Popular" filter (mobile no-op — FLAG), date locale, week start default.

---

## 39. Regression surface — Shared components

Any change to these requires regressing every screen that uses them:

- `components/FoodSearchModal.tsx` → Today (Add food), Create Recipe, Recipe Verify, Barcode fallback.
- `components/BarcodeScannerModal.tsx` → Today (FAB → Scan), Recipe Verify, Barcode tab.
- `components/JournalDatePickerModal.tsx` → Today, Progress.
- `components/MealTypePicker.tsx` → Create Recipe, Import Shared.
- `components/HouseholdCard.tsx` → Today.
- `components/FirstRunChecklist.tsx` → Today.
- `components/NutritionSourceBadge.tsx` → Recipe ingredients, Food search results, Today rows.
- `components/BarcodeCameraView.tsx` → BarcodeScannerModal, Barcode tab.
- `components/charts/CalorieRing.tsx` → Today.
- `components/RemainingMacrosBar.tsx` → Today (below calorie ring), FoodSearchModal (fit-this-in "after" row).
- `components/charts/DayStrip.tsx` → Today.
- `components/charts/MacroRingSmall.tsx` → Recipe Nutrition tab + smaller summaries.
- `components/charts/TrendLine.tsx` → Weight tracker, Progress.
- `components/charts/MiniBarChart.tsx` → Weight tracker, Progress.
- `components/charts/TimeRangeSelector.tsx` → Weight tracker, Progress.
- `components/haptic-tab.tsx` → tab bar.
- `components/ui/icon-symbol.tsx` → tab bar + many screens.
- `components/themed-text.tsx` / `themed-view.tsx` → typography/layout consumers.

Shared lib regression triggers:
- `src/lib/nutrition/remainingMacros.ts` → Today (RemainingMacrosBar), FoodSearch/FoodSearchModal (fit-this-in preview). Any change requires regression of both web and mobile consumers.
- `src/lib/nutrition/weekSummaryWindow.ts` + `src/lib/nutrition/progressWeekReport.ts` / `apps/mobile/lib/progressWeekReport.ts` → Today weekly view, Progress weekly stats, week-start-day picker effect.
- `lib/tdee.ts`, `lib/calcTargets.ts` → onboarding, Today, Recipe detail, Import, Weight tracker, Progress.
- `lib/nutritionJournal.ts` → Today, Macro detail, Meal nutrition, Burn detail.
- `lib/recipes.ts` → Discover, Library, Recipe detail, Planner.
- `lib/healthSync.ts` → Today, Progress, Weight tracker, Health sync, Burn detail.
- `lib/analytics.ts` → every screen emitting events.
- `lib/supabase.ts` / `authedFetch.ts` → every networked screen.
- `context/auth.tsx` → login, _layout, tabs layout.
- `context/theme.tsx` → every screen.

---

## 40. Nutrition accuracy UAT scenarios

Run with a scratch account:
1. Import `https://www.fitfoodiefinds.com/...` → ingredients + macros populate; confidence badges render.
2. Import Instagram reel by approved creator → resolves to approved-source match or surfaces "Manual entry required".
3. Log "1 large banana" via Food Search → count-to-weight normalisation (~118g); kcal ~105.
4. Log "100 g chicken breast grilled" → kcal ~165, protein ~31g.
5. Scan packaged barcode → product found, serving size prefilled.
6. Edit recipe yield 4 → 2 → per-serving macros double; already-logged entries unaffected.
7. Scale portion 1.5× on log → macros scale 1.5×; portionMultiplier stored.
8. Ingredient with confidence < threshold → recipe detail shows Verify CTA; never silently used.
9. Voice log "two scrambled eggs and toast" → two line items with estimated badges.
10. Photo log ambiguous photo → low-confidence candidates and prompt user to pick.
11. Household meal logged by another user → appears today with correct portion.

---

## 40.1 Batch 2.7 — Add ingredient + per-ingredient override UAT

Run on `recipe/verify.tsx` after importing an approved-source URL so there are real rows.

### 40.1.1 Add ingredient (with match)
- EXP: "+ Add ingredient" row visible at the bottom of the ingredient list.
- EXP: Tapping opens `AddIngredientSheet` with autofocus on the name field.
- EXP: Typing "cheddar cheese", amount `30`, unit `g`, then "Find match" — match card populates with a USDA / OFF source and per-row macros.
- EXP: Save inserts a new `recipe_ingredients` row with `added_by_user=true`; totals card at the top of the verify screen updates immediately.
- EXP: `recipe_ingredient_added { recipeId, hasMatch: true }` fires once in PostHog.
- A11Y: Inputs use `keyboardType="decimal-pad"` + `inputMode="decimal"`; every Pressable has an `accessibilityLabel`.

### 40.1.2 Add ingredient (no match, manual macros)
- EXP: Typing an obscure name and tapping "Find match" shows "No confident match" and auto-expands the manual macros section.
- EXP: Entering calories/protein/carbs/fat and tapping "Add" persists the row with `added_by_user=true`, `override_macros={...}`, `confidence` < 0.5 (so `is_verified=false`).
- EXP: Row renders with both "Added" and "Override" badges and the `needsReview` alert icon is suppressed while the override exists.
- EXP: `recipe_ingredient_added { recipeId, hasMatch: false }` fires once.

### 40.1.3 Override an existing ingredient
- EXP: Expanding any row shows an "Override nutrition" action under the search/scan buttons.
- EXP: Opens `OverrideIngredientSheet` pre-filled with the current effective macros (matched values when no prior override).
- EXP: Saving new numbers persists `override_macros`; a persistent "Override" badge appears on the row and the row's calories display the overridden value.
- EXP: Totals card updates live using `recomputeRecipeTotals`.
- EXP: `recipe_ingredient_overridden { recipeId, ingredientPosition }` fires once.

### 40.1.4 Reset an override
- EXP: Re-opening the sheet on an overridden row shows the "Reset" destructive-colour action on the left.
- EXP: Tapping Reset clears `override_macros` (UPDATE with `null`); badge disappears; row falls back to the matched macros.
- EXP: Tapping Save with all fields cleared behaves the same as Reset (sanitise returns `null`).
- EXP: `recipe_ingredient_override_cleared { recipeId, ingredientPosition }` fires once.

### 40.1.5 Live totals
- EXP: Totals card at the top of the verify screen and calories-per-serving footer both reflect add + override edits before the user taps "Save Changes".
- EDGE: Recipe `servings` manually set to 0 in the DB → totals card divides by 1 (never NaN) via `recomputeRecipeTotals` clamp.

### 40.1.6 Persistence survives re-entry
- EXP: After Save, leaving and re-entering `recipe/verify.tsx` re-hydrates `override_macros` and `added_by_user` on each row (verified via `fetchIngredientsForVerification`); badges render again.

### 40.1.7 Non-authors
- NEG: Opening a community recipe you don't own — "+ Add ingredient" and "Override" actions are hidden or surface a permission error on Supabase (RLS gates `recipe_ingredients` writes to the owner).

---

## 41. Analytics QA

Required events (from `AnalyticsEvents`): verify firing once, with correct properties, no duplicates:
- `onboarding_step_completed` (per step).
- `paywall_viewed`.
- All other `track(...)` call sites — enumerate via grep before release.

Checklist:
- PostHog dev project receives events from dev build.
- Prod build points at prod project; no cross-contamination.
- No PII (email, raw weight) in event properties.
- Session/user identity set after login; identify reset on sign-out.

---

## 42. Release-gate checklist

- [ ] Sections 1–31 walked on physical iPhone 15 Pro and iPhone SE 2nd gen.
- [ ] Sections 32–38 spot-checked on every major screen.
- [ ] Section 40 nutrition scenarios pass.
- [ ] Section 41 analytics validated in PostHog.
- [ ] Parity audit against web — divergences signed off.
- [ ] VoiceOver pass on critical flows.
- [ ] Airplane mode smoke test.
- [ ] Crash-free session > 99.5% across 50 TestFlight sessions.
- [ ] Maestro flows `00_connect.yaml` … `34_profile_targets.yaml` all green.
- [ ] No `console.error` / unhandled promise rejections in dev build during core flows.

---

## 43. Theatrical / FLAGGED items surfaced during this plan

Escalate rather than test around:
- Discover Popular filter is `(r.saves ?? 0) >= 50 || true` — always true.
- Tab label `fontSize: 9` — below iOS recommendation.
- Paywall close 36×36 — below 44pt.
- `Linking.openURL` in `nutrition-sources.tsx` lacks `.catch` (other screens have it).
- Mixed date locale (`en-GB` vs device default).
- Login fields disable autofill (`autoComplete="off"`, `textContentType="none"`) — verify intent (Keychain may still prompt).
- Sign Out does not clear AsyncStorage health prefs — verify intent.
- Cook mode Exit has no confirmation.
- Allowlist in `isSocialShareRecipeUrl` must match product memory: fitfoodiefinds, downshiftology, minimalistbaker, pinchofyum, halfbakedharvest + Instagram + TikTok.
- Onboarding: cm and ft/in tracked independently — switching units does not convert.
- Login: unsuccessful auth bounces to login losing typed form — consider preserving on session-expiry case.

---

## Sign-off

This plan must be executed and passed before a release candidate ships. Any unflagged regression in sections 1–31 is a blocker. Sections 32–38 are release-quality bars — failing them is a blocker unless explicitly accepted by product. Document owner: QA. Re-run on every meaningful change per the project workflow.
