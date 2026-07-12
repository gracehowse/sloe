# Email-confirmation signup hardening + mobile deep-link spec (ENG-1395)

**Date:** 2026-07-09
**Status:** Superseded in part (2026-07-10) — read the "Current posture" block
below first. The web PKCE redirect fix (shipped) and the mobile deep-link build
(ENG-1474, shipped) stand; but the doc's original premise — that the farming fix
is re-enabling `enable_confirmations` — was abandoned, and its named replacement
(confirm-after-value AI-gating, ENG-1482) was then canceled. The body below the
Current-posture block is retained as historical record of the PKCE bug + the
deep-link spec.
**Area:** Auth / signup hardening / launch readiness

## Current posture (2026-07-10 — supersedes the framing below)

Two decisions landed the day after this doc was written; the sections below were
only partially reconciled to them, so read this block as authoritative:

1. **`enable_confirmations` stays `false` — the flip is abandoned, not deferred.**
   Re-enabling GoTrue email confirmation would kill the instant-session
   MFP-refugee funnel, which is the point of the launch. So the doc's original
   premise ("Grace's chosen fix … is re-enabling email confirmation") is **no
   longer the plan of record.** Every "before Grace flips `enable_confirmations`"
   framing below describes an event that will not happen.

2. **Confirm-after-value AI-gating (ENG-1482) was also canceled** — as vacuous,
   not deferred. With `enable_confirmations = false`, GoTrue **auto-confirms
   every signup** (verified 2026-07-10: all prod `auth.users` have
   `email_confirmed_at` set). An AI gate on `email_confirmed_at` would therefore
   reject **nobody**, and `auth.resend({type:'signup'})` errors for
   already-confirmed users. So the "confirmed-email AI-gating / nudge follow-up"
   this doc names as the flip's replacement (lines below) **does not exist** and
   won't be built under this premise.

**Where the account-farming vector actually lives now:** it is **not** handled by
"Layer C + the confirmed-email follow-up" as the body claims. It is:
- **tracked** in **ENG-1487 Finding 2** (fleet-wide AI DoS via cheap account
  farming — `launch-blocker`), and
- **mitigated (only) by the Layer C per-IP AI cap** (ENG-1395/#827), which
  currently ships **dark** (`AI_BUDGET_PER_IP_ENFORCEMENT_ENABLED` default off).
  The signup throttle/captcha half is unbuilt. So the vector is
  **tracked-but-unmitigated-in-prod** until Grace right-sizes + enables the
  Layer C cap and/or a signup throttle lands. That work is ENG-1487, not this
  doc.

**What still stands from this doc:** the web PKCE redirect fix (magic-link +
password-reset were live-broken and are now fixed — unrelated to the abandoned
flip), and the ENG-1474 mobile deep-link build. ENG-1474's value **survives** the
flip abandonment: `suppr://auth-callback` is still needed for mobile magic-link,
password-reset, and recovery round-trips (those emails send regardless of
`enable_confirmations`), even though it's no longer a prerequisite for a
confirmation flip that isn't happening.

## Problem

The 2026-07-05 deep audit (SEC-01/DI-04, ENG-1395) flagged account-farming:
signup runs with GoTrue email confirmation **off**
(`[auth.email] enable_confirmations = false` in `supabase/config.toml`), so
`signUp()` returns a usable session immediately, no email round-trip
required. A script can mint accounts as fast as it can generate email
addresses. Grace's chosen fix for the farming vector itself is **re-enabling
email confirmation** — this doc specs what has to be true before that flip is
safe, plus the per-IP call cap (Layer C, see
`docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`) as the code-side
backstop for whatever farming still gets through.

## Finding while researching this spec: the PKCE redirect bug (fixed in this change)

Auditing the existing confirm-email code path (`ENG-672`, 2026-05-26, which
already built a "confirm-email mode" interstitial for onboarding signup)
turned up a **live, currently-shipping bug**, not just a dormant gap:

- The web browser Supabase client (`src/lib/supabase/browserClient.ts`, via
  `createBrowserClient` from `@supabase/ssr`) is configured for **PKCE flow**
  (`@supabase/ssr`'s hard-coded default — confirmed in
  `node_modules/@supabase/ssr/dist/main/createBrowserClient.js`).
- Every GoTrue email template (`confirm-signup.html`, `magic-link.html`,
  `reset-password.html`, …) uses the standard `{{ .ConfirmationURL }}`
  variable. For a PKCE-initiated request, GoTrue's `/auth/v1/verify`
  redirects the browser to `redirectTo` (the value passed as
  `emailRedirectTo`/`redirectTo` in the original `signUp`/`signInWithOtp`/
  `resetPasswordForEmail` call) with **`?code=<auth_code>`** appended. That
  code must be exchanged via `supabase.auth.exchangeCodeForSession(code)`
  before a session exists.
- `app/auth/callback/route.ts` already implements exactly that exchange —
  but **none of the four web call sites pointed at it.** They pointed
  straight at a destination page:
  - `app/login/ui.tsx` `signUp()` → `emailRedirectTo: \`${origin}/\``
  - `app/login/ui.tsx` `sendMagicLink()` → `emailRedirectTo: \`${origin}/\``
  - `app/login/ui.tsx` `sendPasswordReset()` → `redirectTo: \`${origin}/reset-password\``
  - `src/app/components/onboarding/steps/signup.tsx` `signUp()` →
    `emailRedirectTo: \`${origin}/onboarding\``
- Net effect: a user who clicks **any** of these email links lands on the
  destination page with an un-exchanged `?code=` in the URL and **no
  session**. `/reset-password` would show a form that fails on submit
  ("Auth session missing"); `/onboarding`'s confirm-email interstitial would
  wait forever; a magic-link click would silently land on `/` logged out.
- **This is not gated by `enable_confirmations`.** Magic-link and
  password-reset emails are sent unconditionally today — this bug is live in
  production right now for anyone who has ever used "Sign in with email
  link" or "Forgot password." Signup-confirmation is the only one of the
  four that's currently dormant, because `enable_confirmations = false`
  means `signUp()` never needs the round-trip.

### Fix (shipped in this change)

Route all four `emailRedirectTo`/`redirectTo` values through
`/auth/callback`, using its existing `?next=` param
(`safeAuthRedirectPath` already guards it against open-redirect):

| Call site | Before | After |
|---|---|---|
| `login/ui.tsx` `signUp` | `${origin}/` | `${origin}/auth/callback` (next defaults to `/`) |
| `login/ui.tsx` `sendMagicLink` | `${origin}/` | `${origin}/auth/callback` |
| `login/ui.tsx` `sendPasswordReset` | `${origin}/reset-password` | `${origin}/auth/callback?next=%2Freset-password` |
| `onboarding/steps/signup.tsx` `signUp` | `${origin}/onboarding` | `${origin}/auth/callback?next=%2Fonboarding` |

This is a pure logic/API fix (no visual surface) — no feature flag needed
per the CLAUDE.md flag policy's explicit exemption. Regression pins:
`tests/unit/authRoutesPremium.test.ts` (source-assertion: every redirect
contains `/auth/callback`) and `tests/unit/onboardingSignupSessionGate.test.tsx`
(the exact `?next=` value the onboarding step passes).

No server-side change was needed — `/auth/callback`'s `exchangeCodeForSession`
handling is generic across signup/magic-link/recovery `code`s; only the
`next` destination differs per flow.

## What's still needed before Grace flips `enable_confirmations`

### 1. GoTrue config (founder action, not code)

- `supabase/config.toml` → `[auth.email] enable_confirmations = true`.
  **Not flipped in this change** — per CLAUDE.md, `supabase config push` (**done 2026-07-10** — pushed with the live Vercel-preview redirect entries unioned in, plus the Sloe-rebranded auth email templates that were committed-but-never-pushed)
  (the mechanism for this file, distinct from SQL migrations) is Grace's
  call, staged here for her to run once the mobile piece below is ready.
- `[auth]` `additional_redirect_urls` needs the mobile deep-link URL added
  (see below) before mobile signup-confirmation can round-trip back into
  the app. Currently only three web origins are allow-listed.

### 2. Mobile deep-link — **BUILT (ENG-1474, 2026-07-10)**

**Status:** implemented in this repo. The four steps below shipped exactly as
specced. What remains is **founder-gated**, not code:

- **On-device / TestFlight verification** (step 5) — custom-scheme deep links
  behave differently across Simulator Safari, Mail.app, and third-party mail
  clients (Gmail/Outlook, which sometimes rewrite links). Needs a real
  round-trip pass with a real inbox before relying on it in production.
- **`supabase config push`** — the `suppr://auth-callback` allow-list entry is
  **staged** in `supabase/config.toml` but not pushed. Same non-negotiable as
  SQL migrations: Grace's action, never MCP/agent-applied.

**`enable_confirmations` intentionally stays `false`.** The flip this doc
originally gated on is **no longer planned** (see Current-posture block above).
⚠️ **Correction (2026-07-10):** an earlier revision of this paragraph said the
farming vector is "handled by the per-IP call cap (Layer C) + the confirmed-email
AI-gating / nudge follow-up (separate ticket)." That follow-up was **ENG-1482,
now canceled** — it's vacuous because `enable_confirmations = false` means every
signup is already auto-confirmed, so an `email_confirmed_at` gate rejects nobody.
The farming vector is therefore mitigated by **Layer C alone** (ENG-1395/#827,
currently dark) and tracked in **ENG-1487 Finding 2**, not by a confirmed-email
gate. The ENG-1474 deep-link work still stands on its own merits (mobile
magic-link / password-reset / recovery round-trips), independent of any
confirmation gate.

**What shipped (ENG-1474):**

- `apps/mobile/lib/supabase.ts` — client switched to `flowType: "pkce"`,
  `detectSessionInUrl: false` preserved.
- `apps/mobile/app/auth-callback.tsx` — new Expo Router screen for
  `suppr://auth-callback`: parses `code` + optional `next`, calls
  `supabase.auth.exchangeCodeForSession(code)`, routes to the guarded `next`
  (default `/(tabs)`, `/onboarding` honoured) on success, `/login?error=oauth`
  on missing/failed code, with a minimal "Signing you in…" spinner while
  exchanging.
- `apps/mobile/lib/safeAuthRedirectPath.ts` — open-redirect guard mirroring
  web's `src/lib/auth/safeRedirectPath.ts` (relative in-app paths only;
  rejects absolute/custom-scheme/`//host`/backslash `next`).
- `apps/mobile/app/login.tsx` — `emailRedirectTo: "suppr://auth-callback"` on
  `signUp` + `signInWithOtp`; `redirectTo` on `resetPasswordForEmail`; reads a
  forwarded `?error=` and surfaces it via the existing `message` idiom.
- `supabase/config.toml` — `suppr://auth-callback` added to
  `additional_redirect_urls` (**staged, not pushed**).
- `apps/mobile/tests/unit/authDeepLinkCallback.test.ts` — PKCE + redirect +
  guard + config-allow-list regression pins.

The original "recommended shape" spec that this build followed is preserved
below for reference.

---

Mobile had **no code-exchange path** for any of these flows before ENG-1474:

- `apps/mobile/lib/supabase.ts`'s client (`createClient` from
  `@supabase/supabase-js`, not `@supabase/ssr`) sets
  `detectSessionInUrl: false` and does not override `flowType` — so it
  defaults to `auth-js`'s **implicit** flow, not PKCE. A signup/magic-link
  request made from the mobile app would get an email whose confirmation
  link carries `#access_token=...` in the fragment, not a `?code=`.
- No `emailRedirectTo` is passed in `apps/mobile/app/login.tsx`'s `signUp()`
  call at all, so GoTrue falls back to `site_url`
  (`https://suppr-club.com`) — a mobile user tapping the confirmation link
  opens the **web app in Safari**, not the native app they signed up in.
  Even if that web page happened to consume the implicit token (mismatched
  flow type vs. the web client's PKCE config makes this unreliable), the
  user experience is "I signed up in the app, the email opened a website" —
  broken regardless of whether a session technically lands somewhere.
- There is no `Linking.addEventListener` (or equivalent) anywhere in
  `apps/mobile/` that listens for an auth callback deep link and completes
  a session.

**Recommended shape** (mirrors the web PKCE fix, for consistency and
security — PKCE is the recommended flow for native app deep links since the
code-verifier prevents a link-interception attack from completing the
exchange):

1. Switch `apps/mobile/lib/supabase.ts`'s client to `flowType: "pkce"`
   (matching web), keep `detectSessionInUrl: false` (RN has no URL to
   auto-detect from; the deep-link handler drives the exchange manually).
2. Register a deep-link path under the existing `suppr://` scheme
   (`apps/mobile/app.json` → `"scheme": "suppr"`), e.g.
   `suppr://auth-callback`. Add it as an Expo Router route (or a root
   `Linking.addEventListener("url", ...)` listener in `_layout.tsx`) that:
   - Parses `code` (and optionally `next`) from the incoming URL.
   - Calls `supabase.auth.exchangeCodeForSession(code)`.
   - On success, routes to `/(tabs)` or `/onboarding` per `next` (mirroring
     web's `safeAuthRedirectPath` — same open-redirect guard needed here,
     since a malicious deep link could carry an attacker-controlled `next`).
   - On failure, routes to `/login` with an error toast (mirrors
     `/auth/callback`'s `?error=oauth` fallback).
3. Pass `emailRedirectTo: "suppr://auth-callback"` (optionally with a
   `next` query param) from `apps/mobile/app/login.tsx`'s `signUp`,
   `signInWithOtp` (if/when magic link ships on mobile), and any future
   `resetPasswordForEmail` call.
4. Add `suppr://auth-callback` to `supabase/config.toml`'s
   `additional_redirect_urls` (GoTrue rejects a `redirectTo` that isn't
   allow-listed) and push via `supabase config push` (same non-negotiable
   as the SQL-migration rule: this is Grace's action, not MCP/agent-applied).
5. Verify end-to-end on a real device or the simulator with a real inbox
   before flipping `enable_confirmations` in production — Universal Links
   vs. custom-scheme deep links can behave differently between Simulator
   Safari, Mail.app, and third-party mail clients (Gmail app, Outlook),
   and some mail clients rewrite/proxy links (click-tracking) in ways that
   can break a custom scheme redirect. This needs a manual TestFlight pass,
   not just a simulator screenshot.

This mobile work is **not implemented in this change** — it's a real,
sized follow-up, tracked as ENG-1474 (see Linear) rather than left as a
silent gap, per the CLAUDE.md no-silent-deferrals rule. Grace should not
flip `enable_confirmations` until it ships, or mobile signups will be
unable to complete confirmation at all (a worse regression than the
farming vector this is meant to fix).

### 3. Sizing / rate-limit sanity check (config already in place, revisit at flip time)

`supabase/config.toml`'s `[auth.email]` already has reasonable defaults that
apply the moment confirmations turn on:

- `max_frequency = "1m0s"` — throttles re-send spam on one address.
- `otp_expiry = 3600` (1h) — confirmation links expire in an hour.
- `[auth.rate_limit] email_sent = 2` per hour — this is the SMTP-level cap
  and is fairly tight; if legitimate resend requests get throttled during
  the mobile-deep-link rollout, Grace may need to widen it temporarily via
  `supabase config push` (no code change).

## Rollout sequence

1. **Shipped:** the PKCE redirect fix (web) — pure bug fix, live
   immediately, fixes magic-link and password-reset today regardless of the
   confirmation-flip timeline.
2. **Shipped (ENG-1474, 2026-07-10):** the mobile deep-link handler + mobile
   client switched to PKCE. On-device / TestFlight verification and the
   `supabase config push` of the allow-list entry remain founder-gated.
3. **Founder action:** Grace runs `supabase config push` to add
   `suppr://auth-callback` to the allow-list (staged in `config.toml`).
   **`enable_confirmations` is NOT flipped in this push** and won't be — the
   blanket flip is abandoned (Current-posture block). ⚠️ The
   "confirmed-email AI-gating / nudge follow-up" that an earlier revision said
   "replaces it" is **ENG-1482, canceled** (vacuous under auto-confirm). Nothing
   "replaces" the flip because nothing needs to: signup keeps its instant
   session, and the farming vector is carried by Layer C (dark) + **ENG-1487
   Finding 2**.
4. **Layer C (code, already shipped default-off)** remains the defence-in-depth
   backstop regardless of where (1)-(3) land — see
   `docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`.

## Rejected alternative

- **Ship only the mobile spec, defer the web PKCE fix too** ("it's all one
  signup-hardening effort, batch it"). Rejected: the web bug is *already*
  live and breaking magic-link/password-reset for any user who hits those
  paths today, independent of the ENG-1395 farming question entirely. Fixing
  it now is strictly additive — it doesn't wait on the mobile deep-link
  build or Grace's confirmation-flip decision.

## File map

- `app/login/ui.tsx` — 3 redirect fixes (signUp, magic link, password reset).
- `src/app/components/onboarding/steps/signup.tsx` — 1 redirect fix.
- `tests/unit/authRoutesPremium.test.ts` — source-assertion regression pin
  (all four redirects contain `/auth/callback`).
- `tests/unit/onboardingSignupSessionGate.test.tsx` — pins the exact
  `?next=` value for the onboarding call site.

**Mobile deep-link build (ENG-1474, 2026-07-10):**

- `apps/mobile/lib/supabase.ts` — `flowType: "pkce"` (+ `detectSessionInUrl:
  false` preserved).
- `apps/mobile/app/auth-callback.tsx` — new `suppr://auth-callback` screen.
- `apps/mobile/lib/safeAuthRedirectPath.ts` — mobile open-redirect guard.
- `apps/mobile/app/login.tsx` — `emailRedirectTo`/`redirectTo` deep link +
  `?error=` surfacing.
- `supabase/config.toml` — `suppr://auth-callback` allow-listed (staged).
- `apps/mobile/tests/unit/authDeepLinkCallback.test.ts` — regression pins.
