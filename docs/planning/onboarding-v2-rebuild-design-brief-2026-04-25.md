# Onboarding v2 Mobile Rebuild — Design Brief (2026-04-25)

**Owner:** `ui-product-designer` (brief), `executor` (implementation)
**Status:** READY FOR EXECUTOR
**Gates closed when shipped:** T9 + T10 + T11 (Phase 2 of the [2026-04-24 full-sweep ship verdict](../decisions/2026-04-24-full-sweep-ship-verdict.md)).

---

## 0. Design intent

Returning users get back in. New users finish auth, set permissions, and land on Today with their real targets — not 2,000 kcal defaults. Every failure is recoverable and named in plain English. Premium feel means: no spinners without context, no dead ends, no mock data dressed up as real.

---

## 1. Signup step (`apps/mobile/components/onboarding-v2/steps/signup.tsx`)

### 1.1 Apple Sign-In

**Granted** — `signInWithApple()` returns identity token → `supabase.auth.signInWithIdToken({ provider: 'apple', token })` → `set({ authMethod: 'apple', userId })` → `go(next)`. No toast. Transition is the reward.

**Denied (user cancels Apple sheet)** — Apple throws `ERR_REQUEST_CANCELED`. Stay on step. No error banner. CTA returns to default state. Microcopy unchanged.

**Revoked-then-re-presented** — Apple returns a token without email/name (expected on second presentation). Use cached values from first attempt if present in our store; otherwise proceed with token-only and let Supabase backfill. Never block.

**Network drop mid-handshake** — timeout at 15s. Show inline error below the Apple button, not a toast: "Couldn't reach Apple. Check your connection and try again." Retry button restores idle state.

**Identity-token rejected by Supabase** — log to Sentry with `auth.apple.token_rejected`. Show: "Something went wrong on our side. Try again, or use email instead." Reveal email path inline. Do not auto-fall-through.

### 1.2 Email path

Email + password fields. Password min 8 chars, validated client-side before submit. Submit calls `supabase.auth.signUp({ email, password })`.

| State | Trigger | UI |
|---|---|---|
| Invalid email | Regex fail on blur or submit | Inline red helper under field: "Enter a valid email address." Submit disabled until valid. |
| Weak password | < 8 chars on submit | Inline helper under password: "Use at least 8 characters." |
| Email collision | Supabase returns `user_already_registered` | Replace form with single card: "Looks like you already have an account." Primary CTA "Sign in" routes to `/login` with email pre-filled via param. Secondary "Use a different email" returns to form. |
| Rate limit (429) | Supabase 429 | Inline error: "Too many attempts. Try again in a minute." Disable submit for 60s with countdown on the button. |
| Server 500 | Any 5xx | Inline error: "We couldn't create your account. Try again." Sentry-log with request id. |

### 1.3 Persistence write failure (both paths)

Auth succeeded but `persistOnboardingV2` POST fails. Do **not** abort. Cache the unsynced payload to AsyncStorage under `onboarding_v2.pending_persist`. Continue the flow. On Today mount, retry once. If still failing, the user has a working account with default targets and a non-blocking banner: "Finish setup" → re-runs persist with cached data.

### 1.4 Returning users — Welcome "Sign in"

Welcome step gets a real `Pressable` (not Text-in-Text) below the primary CTA. Label: "Already have an account? Sign in". Routes to `/login` (mobile route exists). On successful login, skip onboarding entirely — route straight to Today. Do not re-run permissions; that lives in Settings.

---

## 2. Permissions step (`apps/mobile/components/onboarding-v2/steps/permissions.tsx`)

Two requests, sequenced: HealthKit first, then Notifications. One screen, two rows, each with its own state.

### 2.1 Four end states

| HK | Notifs | Behaviour |
|---|---|---|
| Granted | Granted | Both rows show check + "Connected". Continue button enabled, primary. Register push token immediately. |
| Granted | Denied | HK row check. Notifs row "Off — turn on in Settings" with chevron deep-linking to `Linking.openSettings()`. Continue still primary. |
| Denied | Granted | Mirror of above. HK row "Off — turn on in Settings". |
| Denied | Denied | Both rows in muted state with Settings deep-link. Continue label changes to "Continue without". No guilt copy. |

### 2.2 First-launch vs returning

Use `Notifications.getPermissionsAsync()` and the HK `getRequestStatusForAuthorization` (iOS 17+) to detect already-decided state on mount. If both already decided, auto-advance after 400ms with a brief "Permissions already set" confirmation row — never silently skip (user needs to know why a screen flashed).

### 2.3 Sticky deny

iOS hides the system prompt after first deny. Detect this: if `requestPermissionsAsync` returns the same status it had on mount, treat as sticky-denied. Row copy switches from "Allow" CTA to "Open Settings" CTA. Do not call `request*` again — it's a no-op and looks broken.

### 2.4 Pre-iOS-17 fallback

`HKHealthStore.getRequestStatusForAuthorization` requires iOS 17+. On older OS, skip the pre-check and call `requestAuthorization` directly. Result reads as `granted` even if the user denied (HK API quirk). Treat the row as "Permission requested" with a help link rather than asserting a state we can't verify.

### 2.5 Push token

Only on notifs-granted. Call `registerExpoPushTokenForUser(userId)` inside the granted branch, fire-and-forget with Sentry catch. Do not block the UI.

---

## 3. Import step — verdict: **(c) Skip-prominent, "import comes later"**

Justification: real import requires the parsing pipeline + paywall + tier logic + low-confidence handling, all on the most fragile step of onboarding. Failure here kills activation. The fake-import setTimeout is worse than nothing — it's dishonest. A clearly framed "you can import later from the Discover tab" preserves the narrative beat without lying.

### 3.1 Spec

Single screen. Headline: "Bring your favourite recipes". Body: "Import from any URL, your camera roll, or paste a recipe. We'll match each ingredient to verified nutrition data." Below: a static visual (three sample chips: "URL", "Photo", "Paste") — **no animation, no progress bar, no fake result**. Two CTAs: primary "Continue" advances. Tertiary "Try one now" routes to Discover with a return-to-onboarding flag (post-MVP — not in this brief).

### 3.2 Why no failure modes here

This step has no network calls. The only failure is render. Done.

---

## 4. Terminal step — Continue handler order

```
1. persistOnboardingV2(payload)        [await, abortable]
2. analytics: onboarding_v2_completed  [fire-and-forget]
3. registerExpoPushTokenForUser()      [fire-and-forget, only if notifs granted]
4. router.replace('/paywall?source=onboarding_v2')
```

**Recoverable vs abort:**

- (1) fails → cache to AsyncStorage as in §1.3. Continue to (2)–(4). User reaches paywall with a "Finish setup" banner pending on Today. Not aborted.
- (2) fails → silent. PostHog has its own retry queue.
- (3) fails → silent. Token registration retries on next app foreground via existing logic.
- (4) cannot fail (router). If somehow it does, fall back to `/today`.

**Hard abort condition:** none. The user has an authenticated account by this point; they always reach a usable surface.

The reveal step's computed targets (kcal, protein, carbs, fat) are part of the persist payload. Verify the payload shape matches what `persist.ts` expects — see web `web-flow.tsx:103` for the canonical call site.

---

## 5. Ramp gate (T11) — signals to justify 0% → 10%

Three measurable gates, all must be green for 7 consecutive days on internal/dogfood cohort before flag bumps:

1. **Auth completion rate ≥ 95%** of users who tap "Get started" reach the permissions step. Measured: `onboarding_v2_signup_completed` / `onboarding_v2_started`.
2. **Persist success rate ≥ 99%** of users reaching the terminal step have a non-default `daily_kcal_target` in `profiles` within 60s of `onboarding_v2_completed`. Measured: server-side join, not client event.
3. **Zero P0 Sentry issues** tagged `onboarding_v2` in the 7-day window. P0 = crash, auth-state corruption, or data loss.

If any gate fails, root-cause and reset the 7-day clock. Do not ramp on partial green.

---

## 6. Out of scope

- Phone-number auth, Google Sign-In, magic-link.
- Real import flow inside onboarding (deferred — see §3).
- Paywall redesign — terminal step routes to existing paywall as-is.
- Re-running permissions outside onboarding (lives in Settings, already shipped).
- Web parity changes — web already does this correctly. Sync-enforcer should not flag mobile catching up as drift.
- Tier sync via `syncTierToSupabase` — T6 webhook owns this; do not touch from onboarding.
- Reveal-step copy or visual changes — targets math is correct, only persistence is missing.
- Marketing/welcome copy A/B — separate workstream.

---

## 7. Acceptance criteria

1. Welcome "Sign in" is a `Pressable` that routes to `/login` with no console warnings.
2. Apple cancel does not show an error.
3. Email collision routes to `/login?email=...`, not a generic error.
4. Permissions step detects sticky-deny and swaps CTA to "Open Settings".
5. Push token registers within 5s of notifs grant.
6. Import step makes zero network calls.
7. Terminal Continue persists targets to Supabase before paywall mounts (verified by reading `profiles.daily_kcal_target` server-side).
8. Persist failure caches payload and surfaces a "Finish setup" banner on Today.
9. No `setTimeout`-driven fake content anywhere in the flow.
10. Sentry tag `onboarding_v2` present on every error path listed above.

---

## 8. Open questions before executor starts

- **product-lead**: confirm "Try one now" deferred to post-ramp (§3.1).
- **legal-reviewer**: Apple Sign-In email-relay copy on the consent surface — does current text need updating for the new persist-failure path?
- **analytics-engineer**: confirm `onboarding_v2_completed` event schema includes auth method + permissions outcome for the §5 gate-2 server-side join.

---

## Relevant repo paths

- `apps/mobile/components/onboarding-v2/steps/welcome.tsx`
- `apps/mobile/components/onboarding-v2/steps/signup.tsx`
- `apps/mobile/components/onboarding-v2/steps/permissions.tsx`
- `apps/mobile/components/onboarding-v2/steps/import.tsx`
- `apps/mobile/components/onboarding-v2/steps/reveal.tsx`
- `apps/mobile/components/onboarding-v2/mobile-flow.tsx`
- `src/app/components/onboarding-v2/web-flow.tsx` (canonical reference)
- `src/lib/onboarding/v2/persist.ts`
- `apps/mobile/lib/expoPushToken.ts`
